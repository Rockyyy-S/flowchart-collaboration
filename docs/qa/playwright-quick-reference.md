# Playwright 测试快速参考卡片
> 版本：v1.0 | 日期：2026-05-01 | 负责角色：QA专家 | 状态：已审核

## 1. 5 分钟快速开始命令
```powershell
Set-Location "<仓库根目录>"
PowerShell -ExecutionPolicy Bypass -File .\scripts\run-playwright-tests.ps1
```

只跑单轮：
```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\run-playwright-tests.ps1 -Round1Only
PowerShell -ExecutionPolicy Bypass -File .\scripts\run-playwright-tests.ps1 -Round2Only
```

## 2. 3 个常见问题快速解决
1. 端口被占用（3000/5173）
```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5173
```
结束冲突 PID 后重跑。

2. Playwright 浏览器安装失败
```powershell
Set-Location .\apps\web
npx playwright install chromium
```
检查网络代理/防火墙后重试。

3. 报告未生成
先确认测试是否执行完成，再检查以下目录是否存在并有写权限：
- apps/web/test-results/
- apps/web/playwright-report/

## 3. 测试结果查看位置
- JSON 报告：apps/web/test-results/results.json
- HTML 报告目录：apps/web/playwright-report/
- 截图与视频：apps/web/test-results/ 对应失败用例子目录
- 后端日志：logs/api-stdout.log、logs/api-stderr.log
- 一键归档：artifacts/playwright-时间戳/

## 4. 关键指标一览表
| 指标 | 目标值 |
|---|---|
| Round 1 通过率 | >= 90% |
| Round 2 通过率 | >= 85% |
| P0 数量 | 0 |
| P1 数量 | <= 2 |

## 5. 反馈和后续步骤
1. 若通过阈值全部满足：更新 QA 报告并提交放行建议。
2. 若存在阻断缺陷：按 P0/P1 优先级创建修复任务并安排最小回归。
3. 修复完成后：先单轮复测，再执行全量 Round1 + Round2。
