#requires -Version 5.1

param(
    [switch]$Round1Only,
    [switch]$Round2Only,
    [switch]$SkipInstall,
    [switch]$SkipBrowserInstall,
    [switch]$KeepBackend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 中文输出编码，避免日志中出现乱码。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 统一路径定义，确保脚本可从任意当前目录调用。
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ApiDir = Join-Path $RepoRoot 'apps/api'
$WebDir = Join-Path $RepoRoot 'apps/web'
$LogDir = Join-Path $RepoRoot 'logs'
$ArtifactsRoot = Join-Path $RepoRoot 'artifacts'
$TimeStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$RunArtifactDir = Join-Path $ArtifactsRoot "playwright-$TimeStamp"

$ApiStdOutLog = Join-Path $LogDir 'api-stdout.log'
$ApiStdErrLog = Join-Path $LogDir 'api-stderr.log'
$backendProcess = $null

function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Assert-DirectoryExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Hint
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "目录不存在：$Path。$Hint"
    }
}

function Get-MajorVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$VersionText
    )
    $normalized = $VersionText.Trim().TrimStart('v')
    if ($normalized -notmatch '^(\d+)') {
        throw "无法解析版本号：$VersionText"
    }
    return [int]$Matches[1]
}

function Wait-BackendHealthy {
    param(
        [int]$TimeoutSeconds = 120
    )

    # 通过健康检查端点轮询，避免后续测试在服务未就绪时启动。
    $healthUrl = 'http://localhost:3000/api/v1/health'
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Host "后端健康检查通过：$healthUrl" -ForegroundColor Green
                return
            }
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }

    throw "后端健康检查超时（$TimeoutSeconds 秒）：$healthUrl。请查看日志：$ApiStdErrLog"
}

function Stop-BackendProcess {
    if ($null -ne $backendProcess -and -not $backendProcess.HasExited) {
        Write-Host "停止后端进程 PID=$($backendProcess.Id) ..." -ForegroundColor Yellow
        Stop-Process -Id $backendProcess.Id -Force
        Write-Host "后端进程已停止。" -ForegroundColor Green
    }
}

try {
    Write-Step '步骤 1/9：进入项目目录并校验结构'
    Assert-DirectoryExists -Path $RepoRoot -Hint '请确认脚本位置为 scripts/run-playwright-tests.ps1。'
    Assert-DirectoryExists -Path $ApiDir -Hint '缺少 apps/api。'
    Assert-DirectoryExists -Path $WebDir -Hint '缺少 apps/web。'
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot '.git'))) {
        throw '未检测到 .git 目录，请确认仓库已完整克隆。'
    }
    Write-Host "仓库根目录：$RepoRoot"

    Write-Step '步骤 2/9：环境检查（Node / npm / Chrome / 磁盘 / 网络）'
    $nodeVersionText = node -v
    $npmVersionText = npm -v
    $nodeMajor = Get-MajorVersion -VersionText $nodeVersionText
    $npmMajor = Get-MajorVersion -VersionText $npmVersionText
    if ($nodeMajor -lt 16) {
        throw "Node.js 版本过低：$nodeVersionText（要求 >= 16.x）"
    }
    if ($npmMajor -lt 8) {
        throw "npm 版本过低：$npmVersionText（要求 >= 8.x）"
    }

    # 检查 Chrome 常见安装路径，满足 Playwright channel=chrome 的运行前提。
    $chromeCandidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
        "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
    )
    $chromeExists = $false
    foreach ($candidate in $chromeCandidates) {
        if (Test-Path -LiteralPath $candidate) {
            $chromeExists = $true
            break
        }
    }
    if (-not $chromeExists) {
        throw '未检测到 Chrome 浏览器，请先安装 Google Chrome。'
    }

    # 按仓库所在盘符校验剩余空间，避免报告与视频写入失败。
    $driveName = (Get-Item -LiteralPath $RepoRoot).PSDrive.Name
    $drive = Get-PSDrive -Name $driveName
    $freeMB = [math]::Round($drive.Free / 1MB, 2)
    if ($freeMB -lt 500) {
        throw "磁盘剩余空间不足：$freeMB MB（要求 >= 500 MB）"
    }

    try {
        $pingResponse = Invoke-WebRequest -Uri 'https://registry.npmjs.org/-/ping' -Method Get -TimeoutSec 15
        if ($pingResponse.StatusCode -ne 200) {
            throw 'npm registry 响应异常。'
        }
    }
    catch {
        throw "网络检查失败：无法访问 npm registry。错误：$($_.Exception.Message)"
    }

    Write-Host "Node.js：$nodeVersionText"
    Write-Host "npm：$npmVersionText"
    Write-Host "磁盘剩余：$freeMB MB"
    Write-Host '环境检查通过。' -ForegroundColor Green

    if (-not (Test-Path -LiteralPath $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir | Out-Null
    }
    if (-not (Test-Path -LiteralPath $ArtifactsRoot)) {
        New-Item -ItemType Directory -Path $ArtifactsRoot | Out-Null
    }

    if (-not $SkipInstall) {
        Write-Step '步骤 3/9：安装后端依赖'
        Set-Location $ApiDir
        npm install

        Write-Step '步骤 4/9：启动后端服务（后台）'
        if (Test-Path -LiteralPath $ApiStdOutLog) { Remove-Item -LiteralPath $ApiStdOutLog -Force }
        if (Test-Path -LiteralPath $ApiStdErrLog) { Remove-Item -LiteralPath $ApiStdErrLog -Force }

        # 使用 npm.cmd 启动后台进程并将日志重定向到文件，便于失败排查。
        $backendProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start:dev' -WorkingDirectory $ApiDir -RedirectStandardOutput $ApiStdOutLog -RedirectStandardError $ApiStdErrLog -PassThru
        Write-Host "后端已启动，PID=$($backendProcess.Id)"
        Wait-BackendHealthy -TimeoutSeconds 120

        Write-Step '步骤 5/9：安装前端依赖'
        Set-Location $WebDir
        npm install
    }
    else {
        Write-Step '已跳过依赖安装与后端启动（-SkipInstall）'
        if (-not $KeepBackend) {
            Write-Host '提示：你选择了 -SkipInstall，默认假设后端已手动启动。' -ForegroundColor Yellow
        }
        Set-Location $WebDir
    }

    if (-not $SkipBrowserInstall) {
        Write-Step '步骤 6/9：安装 Playwright 浏览器'
        Set-Location $WebDir
        npx playwright install chromium
    }
    else {
        Write-Step '已跳过浏览器安装（-SkipBrowserInstall）'
    }

    Write-Step '步骤 7/9：执行 Playwright Round 1 / Round 2'
    Set-Location $WebDir
    $round1ExitCode = 0
    $round2ExitCode = 0

    if (-not $Round2Only) {
        Write-Host '开始执行 Round 1 ...' -ForegroundColor Cyan
        npm run test:e2e:round1
        $round1ExitCode = $LASTEXITCODE
        if ($round1ExitCode -ne 0) {
            Write-Host "Round 1 执行失败，退出码=$round1ExitCode" -ForegroundColor Red
        }
        else {
            Write-Host 'Round 1 执行通过。' -ForegroundColor Green
        }
    }

    if (-not $Round1Only) {
        Write-Host '开始执行 Round 2 ...' -ForegroundColor Cyan
        npm run test:e2e:round2
        $round2ExitCode = $LASTEXITCODE
        if ($round2ExitCode -ne 0) {
            Write-Host "Round 2 执行失败，退出码=$round2ExitCode" -ForegroundColor Red
        }
        else {
            Write-Host 'Round 2 执行通过。' -ForegroundColor Green
        }
    }

    Write-Step '步骤 8/9：收集测试结果'
    if (-not (Test-Path -LiteralPath $RunArtifactDir)) {
        New-Item -ItemType Directory -Path $RunArtifactDir | Out-Null
    }

    $resultJson = Join-Path $WebDir 'test-results/results.json'
    $reportDir = Join-Path $WebDir 'playwright-report'
    $resultDir = Join-Path $WebDir 'test-results'

    if (Test-Path -LiteralPath $resultDir) {
        Copy-Item -Path $resultDir -Destination (Join-Path $RunArtifactDir 'test-results') -Recurse -Force
    }
    if (Test-Path -LiteralPath $reportDir) {
        Copy-Item -Path $reportDir -Destination (Join-Path $RunArtifactDir 'playwright-report') -Recurse -Force
    }
    if (Test-Path -LiteralPath $ApiStdOutLog) {
        Copy-Item -Path $ApiStdOutLog -Destination (Join-Path $RunArtifactDir 'api-stdout.log') -Force
    }
    if (Test-Path -LiteralPath $ApiStdErrLog) {
        Copy-Item -Path $ApiStdErrLog -Destination (Join-Path $RunArtifactDir 'api-stderr.log') -Force
    }

    if (-not (Test-Path -LiteralPath $resultJson)) {
        Write-Host '警告：未检测到 results.json，请检查测试是否完整执行。' -ForegroundColor Yellow
    }
    if (-not (Test-Path -LiteralPath $reportDir)) {
        Write-Host '警告：未检测到 playwright-report 目录，请检查 reporter 配置。' -ForegroundColor Yellow
    }

    Write-Host "结果归档目录：$RunArtifactDir" -ForegroundColor Green
    Write-Host "JSON 报告：$resultJson"
    Write-Host "HTML 报告目录：$reportDir"

    Write-Step '步骤 9/9：停止后端服务'
    if (-not $KeepBackend) {
        Stop-BackendProcess
    }
    else {
        Write-Host '已保留后端进程（-KeepBackend）。' -ForegroundColor Yellow
    }

    # 若任一轮失败，统一返回非零退出码，便于 CI 或人工快速判定失败。
    if ($round1ExitCode -ne 0 -or $round2ExitCode -ne 0) {
        throw "测试执行完成但存在失败：Round1=$round1ExitCode, Round2=$round2ExitCode"
    }

    Write-Host "`n全部步骤执行完成。" -ForegroundColor Green
}
catch {
    Write-Host "`n执行失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host '故障排查建议：' -ForegroundColor Yellow
    Write-Host '1) 查看 logs/api-stderr.log 定位后端启动问题。'
    Write-Host '2) 查看 apps/web/test-results 与 playwright-report 定位测试失败详情。'
    Write-Host '3) 检查 3000/5173 端口占用与网络代理。'
    exit 1
}
finally {
    if (-not $KeepBackend) {
        Stop-BackendProcess
    }
}
