# Playwright 测试执行指南与操作检查表
> 版本：v1.0 | 日期：2026-05-01 | 负责角色：QA专家 | 状态：已审核

## 文档目标
本指南用于在 Windows + PowerShell 环境中一键执行本仓库前端 Playwright 自动化回归（Round 1 + Round 2），并完成结果收集、缺陷分级与修复闭环。

## 0. 执行范围与约定
- 前端工程目录：apps/web
- 后端工程目录：apps/api
- Playwright 配置文件：apps/web/playwright.config.ts
- Round 1 用例入口：apps/web/tests/round1.flow-editor.spec.ts
- Round 2 用例入口：apps/web/tests/round2.flow-editor.spec.ts
- JSON 报告输出：apps/web/test-results/results.json
- HTML 报告输出：apps/web/playwright-report/

## 1. 前置条件检查清单
- [ ] Node.js 版本 >= 16.x（建议 18.x，与当前前端 README 说明一致）
- [ ] npm 版本 >= 8.x
- [ ] Chrome 浏览器已安装（Playwright 配置使用 Desktop Chrome channel）
- [ ] 磁盘空间 >= 500MB（建议 >= 2GB，避免视频与报告占满）
- [ ] 网络连接正常（需访问 npm registry 与 Playwright 下载源）
- [ ] Git 仓库已克隆

## 2. 一键执行脚本（PowerShell）
推荐直接使用脚本：scripts/run-playwright-tests.ps1

### 2.1 5 分钟快速执行
```powershell
Set-Location "<你的仓库根目录>"
PowerShell -ExecutionPolicy Bypass -File .\scripts\run-playwright-tests.ps1
```

### 2.2 脚本执行步骤总览
脚本将自动执行以下步骤：
1. 进入项目目录
2. 安装后端依赖
3. 启动后端服务（后台）
4. 安装前端依赖
5. 安装 Playwright 浏览器
6. 运行第 1 轮测试
7. 运行第 2 轮测试
8. 收集测试结果
9. 停止后端服务

### 2.3 分步骤说明（含预期输出与故障排除）

#### 步骤 1：进入项目目录
- 执行内容：定位到仓库根目录，校验 apps/api 与 apps/web 存在。
- 预期输出：显示当前路径与目录校验通过。
- 失败排查：
  - 若提示目录不存在，确认你在 flowchart-collaboration 根目录执行。
  - 若使用 VS Code PowerShell，优先用 Set-Location 切换路径。

#### 步骤 2：安装后端依赖
- 执行内容：在 apps/api 执行 npm install。
- 预期输出：added/changed package 统计，npm audit 提示可忽略为信息项。
- 失败排查：
  - EAI_AGAIN / ETIMEDOUT：重试并检查网络代理。
  - 权限错误：使用管理员 PowerShell 或修复目录 ACL。

#### 步骤 3：启动后端服务（后台）
- 执行内容：后台启动 npm run start:dev，日志写入 logs/api-stdout.log 与 logs/api-stderr.log。
- 预期输出：显示后端进程 PID，健康检查 http://localhost:3000/api/v1/health 返回 200。
- 失败排查：
  - 端口占用：处理 3000 端口冲突后重试。
  - 健康检查超时：查看 logs/api-stderr.log 具体错误。

#### 步骤 4：安装前端依赖
- 执行内容：在 apps/web 执行 npm install。
- 预期输出：依赖安装完成，无阻断错误。
- 失败排查：
  - 包锁冲突：删除 node_modules 与 package-lock.json 后重装（团队允许时再执行）。
  - 网络异常：设置 npm registry 镜像后重试。

#### 步骤 5：安装 Playwright 浏览器
- 执行内容：在 apps/web 执行 npx playwright install chromium。
- 预期输出：下载并安装 Chromium 成功。
- 失败排查：
  - 下载失败：检查防火墙或代理，必要时手动配置 HTTPS_PROXY。
  - 空间不足：清理磁盘后重试。

#### 步骤 6：运行第 1 轮测试
- 执行内容：npm run test:e2e:round1。
- 预期输出：Round1 用例执行结束，失败时保留截图/视频。
- 失败排查：
  - 页面未加载：确认 5173 前端服务可访问（Playwright webServer 会自动拉起）。
  - 鉴权失败：检查后端是否可签发 token。

#### 步骤 7：运行第 2 轮测试
- 执行内容：npm run test:e2e:round2。
- 预期输出：Round2 用例执行结束，产出 JSON + HTML 报告。
- 失败排查：
  - UI 不稳定：查看视频与 trace，必要时增加断言等待或超时时间。
  - 低分辨率场景失败：确认窗口高度 500px 场景在当前机器可复现。

#### 步骤 8：收集测试结果
- 执行内容：收集 apps/web/test-results、apps/web/playwright-report 与 logs 到 artifacts/playwright-时间戳。
- 预期输出：输出归档目录路径。
- 失败排查：
  - 结果文件缺失：先确认 Playwright 是否实际执行（检查控制台总用例统计）。
  - 目录复制失败：确认目标目录权限。

#### 步骤 9：停止后端服务
- 执行内容：停止步骤 3 启动的后台进程。
- 预期输出：显示 PID 已停止。
- 失败排查：
  - 进程未退出：使用 Stop-Process -Id <PID> -Force。
  - 端口仍占用：用 netstat 二次确认并清理残留进程。

## 3. 测试结果收集清单
- [ ] 确认 apps/web/test-results/results.json 已生成
- [ ] 确认 apps/web/playwright-report/ 文件夹已生成
- [ ] 截图和视频位置确认（通常在 apps/web/test-results/ 对应用例子目录）
- [ ] 日志文件位置确认（scripts 执行日志在 logs/；可附加终端输出）
- [ ] 错误消息收集（失败断言、HTTP 错误、控制台报错）

## 4. 结果分析模板
按轮次分别填写以下模板。

### Round 1 分析模板
- 总用例数：
- 通过数：
- 失败数：
- 通过率：
- 失败用例列表（按优先级）：
  - P0：
  - P1：
  - P2：
  - P3：
- 错误日志摘要：
- 结论：

### Round 2 分析模板
- 总用例数：
- 通过数：
- 失败数：
- 通过率：
- 失败用例列表（按优先级）：
  - P0：
  - P1：
  - P2：
  - P3：
- 错误日志摘要：
- 结论：

### Bug 分类建议（P0/P1/P2/P3）
- P0：阻断发布、核心主链路不可用、数据错误不可恢复。
- P1：核心功能可用但存在高概率失败或严重体验问题，需发布前修复。
- P2：非核心路径功能异常或中等体验问题，可在迭代内修复。
- P3：低风险体验/文案/样式问题，不影响主流程。

## 5. 常见问题与解决方案

### 5.1 端口占用（3000/5173）
- 识别命令：
```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```
- 处理方案：
  - 定位 PID 后结束冲突进程。
  - 确保没有遗留的 npm run dev / start:dev 进程。

### 5.2 Playwright 浏览器安装失败
- 现象：npx playwright install chromium 失败。
- 处理方案：
  - 检查代理与网络白名单。
  - 重试安装，必要时更换网络。
  - 预先清理缓存后再安装。

### 5.3 网络超时（建议增加超时）
- 现象：页面导航或断言等待超时。
- 处理方案：
  - 在 Playwright 配置中提高 timeout / navigationTimeout。
  - 只在确认为环境抖动时调大，避免掩盖真实性能问题。

### 5.4 内存不足
- 现象：测试中浏览器崩溃、系统卡顿、视频写入失败。
- 处理方案：
  - 关闭高占用程序后重试。
  - 降低并发（当前已 workers=1）。
  - 只执行单轮（Round1 或 Round2）定位问题。

### 5.5 权限错误
- 现象：无法写入报告目录、无法启动进程。
- 处理方案：
  - 用管理员 PowerShell 执行。
  - 修复仓库目录写权限。
  - 确认杀毒软件未拦截 Node/Playwright 进程。

## 6. 修复工作流
1. 根据 results.json 与 HTML 报告定位失败用例。
2. 读取截图/视频/日志，确认是用例问题还是产品缺陷。
3. 按 P0-P3 定级并登记缺陷单（建议附复现步骤、预期结果、实际结果、证据链接）。
4. 开发修复后，先本地复跑对应轮次（最小回归）。
5. 通过后执行全量 Round1 + Round2 回归。
6. 更新缺陷状态与回归结果，形成可追溯闭环。

## 7. 完成标准（放行阈值）
- Round 1 通过率目标：>= 90%
- Round 2 通过率目标：>= 85%
- P0 bug 数 = 0
- P1 bug 数 <= 2

## 8. QA 结论输出模板
- 测试范围：
- 结果与缺陷：
- 放行建议：
- 回归计划：

当满足第 7 节全部阈值时，可给出“建议放行”；若任一阈值不满足，结论应为“暂不放行（阻塞发布）”。
