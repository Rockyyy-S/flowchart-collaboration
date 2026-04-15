# flowchart-collaboration 维护说明与运维手册

> 版本：v0.1 | 日期：2026-04-14 | 适用版本：MVP 内测版 | 维护责任人：研发团队 / DevOps

---

## 一、系统架构总览

### 1.1 服务组件清单

| 组件 | 技术栈 | 端口 | 职责 | 存储依赖 |
|------|-------|------|------|---------|
| **后端 API** | Node.js + NestJS 10 | 3000 | 核心业务逻辑、状态机、门禁引擎 | 内存（MVP）/ PostgreSQL（生产） |
| **前端应用** | React 18 + Vite | 5173 | Web UI、流程图编辑、文档上传 | 浏览器 localStorage |
| **数据库** | PostgreSQL | 5432 | 项目、流程、执行、文档、审计日志 | 仅生产环境需要 |
| **对象存储** | MinIO 或 OSS | 9000/9001（MinIO） | 文档文件存储 | 仅生产环境需要 |
| **缓存与队列** | Redis | 6379 | 会话缓存、通知任务队列 | 仅生产环境需要 |

### 1.2 系统分层

```
┌─────────────────────────────────────────────────┐
│ 表现层：React 18 前端 (localhost:5173)         │
├─────────────────────────────────────────────────┤
│ 接口层：NestJS API Gateway (localhost:3000)    │
├─────────────────────────────────────────────────┤
│ 业务层：项目/流程/执行/门禁/文档/审计模块      │
├─────────────────────────────────────────────────┤
│ 数据层：内存存储（MVP）→ PostgreSQL（生产）    │
└─────────────────────────────────────────────────┘
```

### 1.3 目录结构

```
project-root/
├── apps/
│   ├── api/                  后端 NestJS 工程
│   │   ├── src/
│   │   │   ├── main.ts       应用入口
│   │   │   ├── app.module.ts 根模块
│   │   │   ├── common/       共享枚举/过滤器/拦截器
│   │   │   ├── projects/     项目管理模块
│   │   │   ├── flows/        流程定义模块
│   │   │   ├── executions/   节点执行 + 门禁引擎
│   │   │   ├── documents/    文档管理
│   │   │   ├── audit/        审计日志
│   │   │   ├── notifications/ 通知队列（占位）
│   │   │   └── shared/       全局存储服务
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── web/                  前端 React + Vite 工程
│       ├── src/
│       │   ├── main.tsx      应用入口
│       │   ├── App.tsx       路由配置
│       │   ├── api/          API 客户端层
│       │   ├── components/   UI 组件
│       │   └── pages/        页面
│       ├── package.json
│       └── README.md
│
└── docs/
    ├── requirements/         需求文档
    ├── architecture/         架构文档
    ├── implementation/       实现总结
    ├── context/              Context Doc
    ├── user-docs/           用户文档
    ├── ops/                 运维文档（本文件）
    └── qa/                  测试报告
```

---

## 二、启停步骤

### 2.1 开发环境启动（本地演示）

#### 前置准备

```bash
# 1. 验证 Node.js 版本
node --version
# 预期：v18.x 及以上，推荐 v20 LTS

# 2. 验证 npm 版本
npm --version
# 预期：v9 及以上
```

#### 启动后端服务

```bash
# 步骤 1：进入后端目录
cd apps/api

# 步骤 2：安装依赖（首次运行）
npm install

# 步骤 3：启动开发服务（自动热重载）
npm run start:dev

# 预期输出（示例）：
# [Nest] 1234 - 04/14/2026, 10:30:45 AM LOG [NestFactory] Starting Nest application...
# [Nest] 1234 - 04/14/2026, 10:30:46 AM LOG [InstanceLoader] AppModule dependencies initialized
# [Nest] 1234 - 04/14/2026, 10:30:46 AM LOG [NestFactory] Nest application successfully started
# [Listening on port 3000]
```

#### 启动前端应用

```bash
# 步骤 1：新建终端（后端继续运行），进入前端目录
cd apps/web

# 步骤 2：安装依赖（首次运行）
npm install

# 步骤 3：启动开发服务（自动热重载）
npm run dev

# 预期输出（示例）：
#   VITE v4.x.x  ready in 234 ms
#   ➜  Local:   http://localhost:5173/
#   ➜  press h to show help
```

#### 验证系统就绪

```bash
# 在新终端中测试后端健康检查
curl -s http://localhost:3000/api/v1/projects | head -c 50

# 预期返回：JSON 或空集合，不是连接拒绝

# 在浏览器中打开前端
# http://localhost:5173
# 预期：看到工作台首页（含演示按钮）
```

### 2.2 开发环境停止

```bash
# 后端：在后端终端按 Ctrl+C
# 前端：在前端终端按 Ctrl+C

# 验证端口已释放
lsof -i :3000  # 应无输出
lsof -i :5173  # 应无输出
```

### 2.3 生产环境启停（规划）

> 当前 MVP 未包含生产环境配置。以下为计划模板。

#### 启动步骤

```bash
# 1. 安装依赖
cd apps/api && npm install
cd ../web && npm install

# 2. 构建
cd apps/api && npm run build
cd ../web && npm run build

# 3. 启动（示例：使用 pm2）
pm2 start apps/api/dist/main.js --name "flowchart-api" --instances 2
pm2 start "npm run preview" --cwd apps/web --name "flowchart-web"

# 4. 保存进程配置
pm2 save
pm2 startup
```

#### 停止步骤

```bash
pm2 stop flowchart-api flowchart-web
pm2 delete flowchart-api flowchart-web
pm2 save
```

---

## 三、日志与排障

### 3.1 日志位置

| 组件 | 日志位置 | 格式 | 轮转策略 |
|------|--------|------|--------|
| 后端（dev） | 标准输出（终端） | JSON（带 requestId） | 无（内存） |
| 后端（生产）| `/var/log/flowchart-api.log` | JSON | 每日或 100MB |
| 前端（dev） | 浏览器控制台 | 浏览器格式 | 页面刷新清除 |
| 审计日志 | 内存（dev）/ PostgreSQL（生产） | 结构化 | 无 |

### 3.2 常见错误与排障

#### 问题 A：后端启动失败（依赖缺失）

**症状**：
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**排查**：
```bash
# 1. 清除缓存
rm -rf node_modules package-lock.json
npm cache clean --force

# 2. 重新安装
npm install

# 3. 若仍失败，检查 Node 版本
node --version  # 应 ≥ 18

# 4. 若 Node 版本不符，使用 nvm 或 volta 切换
nvm use 20  # 或对应版本
npm install
```

#### 问题 B：后端先行启动（业务模块加载失败）

**症状**：
```
[ExceptionHandler] Cannot find module '@nestjs/common'
```

**排查**：
```bash
# 1. 确认在 apps/api 目录
pwd  # 应以 '/apps/api' 结尾

# 2. 确认 npm install 完成，无指示
ls node_modules | grep nestjs  # 应有输出

# 3. 若无输出，重新安装
npm install --force

# 4. 查看 package.json 中 @nestjs/common 版本
cat package.json | grep nestjs
```

#### 问题 C：前端无法连接后端

**症状**：
```
Failed to fetch: http://localhost:3000/api/v1/projects
```

**排查**：
```bash
# 1. 确认后端运行
curl -i http://localhost:3000/api/v1/projects

# 预期：HTTP 200 或 4xx，不是 Connection refused

# 2. 若拒绝连接，后端未启动
# 切换到后端终端，重新启动
cd apps/api && npm run start:dev

# 3. 确认 Vite 代理配置正确
# 检查 apps/web/vite.config.ts，应包含：
# proxy: {
#   '/api': {
#     target: 'http://localhost:3000',
#     changeOrigin: true
#   }
# }

# 4. 清浏览器缓存并硬刷新 (Ctrl+Shift+R)
```

#### 问题 D：节点状态异常（显示错误状态）

**症状**：
- 已完成节点显示为 READY
- 后继节点未自动推进

**排查**：
```bash
# 1. 检查后端是否有错误日志
# 在后端终端搜索 ERROR 或 EXCEPTION

# 2. 手动查询节点状态
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions | jq '.data'

# 预期：所有节点状态应符合状态机规则

# 3. 若状态异常，可能是：
# - 后端重启导致内存清空（此时需重新创建项目）
# - 前端缓存未同步（刷新页面）

# 4. 强制刷新前端
# 浏览器按 F5 或 Ctrl+R
```

#### 问题 E：文档上传失败

**症状**：
```
400 Bad Request: Invalid file format
或
413 Payload Too Large
```

**排查**：
```bash
# 1. 检查文件大小
ls -lh {file}  # 应 < 100MB（MVP 限制）

# 2. 检查文件格式
file {file}  # 应为 PDF / Word / 纯文本

# 3. 检查浏览器控制台错误
# 打开 F12 → Network 标签，找到上传请求
# 查看 Response 中的详细错误信息

# 4. 若后端报错，查看后端日志
# 搜索 "documents.service" 相关输出
```

---

## 四、性能监控与优化

### 4.1 关键指标

| 指标 | 正常范围 | 示警阈值 | 备注 |
|------|--------|--------|------|
| **后端响应时间** | < 200ms | > 500ms | 不含网络延迟 |
| **ProjectPage 首屏加载** | < 1s | > 3s | 包含流程加载 |
| **文档上传耗时** | < 5s（<10MB 文件） | > 10s | 受网络影响 |
| **内存占用**（后端进程） | 80-150MB | > 500MB | 单进程，未分页 |
| **CPU 占用** | < 30%（空闲） | > 80%（持续） | 发现后立即调查 |

### 4.2 性能调优建议（MVP→生产）

**即时优化**：
- 前端：启用 React.memo 避免不必要重渲染
- 后端：为频繁查询的实体添加内存缓存（如项目列表）

**生产环境优化**：
- 数据库：为 projectId、nodeId、status 字段添加索引
- 缓存：使用 Redis 缓存项目、流程、执行列表
- 队列：将通知发送异步化，使用 BullMQ 或 RabbitMQ

---

## 五、风险与回滚建议

### 5.1 MVP 阶段风险清单

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|--------|
| **内存存储无持久化** | 🔴 P0 | 任何重启丢失全部数据 | 内测仅限单次演示；生产需切 PostgreSQL |
| **流程草稿版本冲突** | 🟠 P1 | 并发编辑可能导致覆盖 | 当前版本不支持多人协作编辑；生产需加并发控制 |
| **文档绑定无审计** | 🟠 P1 | 无法追溯文档变更历史 | 当前审计日志已包含绑定操作，可满足基础追溯 |
| **网络波动导致状态不一致** | 🟠 P1 | 前端显示过期状态 | 前端 stale-while-revalidate 策略；定期同步 |
| **JWT 鉴权缺失** | 🔴 P0（生产） | 多人场景身份伪造 | 内测可接受；生产前必须补齐 |
| **submit() 非事务** | 🟠 P1 | 状态变更与事件发布分离，极端情况数据不一致 | 正式版本引入 QueryRunner + outbox |

### 5.2 快速回滚清单

#### 回滚场景 1：后端代码引入 bug 导致启动失败

```bash
# 步骤 1：检查最后修改的文件
git log --oneline -5 apps/api/src/

# 步骤 2：回滚到最后一个好的版本
git revert <commit-hash>

# 步骤 3：重新启动后端
cd apps/api && npm run start:dev

# 步骤 4：验证启动成功
curl http://localhost:3000/api/v1/projects
```

#### 回滚场景 2：前端部署后页面白屏

```bash
# 步骤 1：清浏览器缓存
# Ctrl+Shift+Delete（Windows）或 Cmd+Shift+Delete（Mac）

# 步骤 2：硬刷新
# Ctrl+Shift+R（Windows）或 Cmd+Shift+R（Mac）

# 步骤 3：若仍白屏，检查网络请求
# 打开 F12 → Network 标签，查看是否有 4xx/5xx 错误

# 步骤 4：若为 500 错误，回滚前端代码
git revert <commit-hash>
npm run build
npm run preview
```

#### 回滚场景 3：内存存储丢失后恢复（无法恢复）

```bash
# 此时数据已丢失。恢复步骤：
# 1. 重新启动后端，重新创建项目
# 2. 手动或通过脚本重新输入流程配置

# 预防办法（生产环境）：
# - 定期数据库备份（每小时或自动）
# - 从备份恢复：pg_restore -d <target-db> <backup-file>
```

---

## 六、上线前检查清单

### 6.1 内测版发布清单（当前 MVP）

**功能验证**：
- [ ] 完整演示流程可跑通（创建项目 → 流转 → 门禁 → 补齐 → 通过）
- [ ] 所有 9 条 API 路由已验证（见 curl 脚本）
- [ ] 前端所有页面正常渲染（无 JS 报错）
- [ ] 文档上传与绑定功能正常
- [ ] 状态机约束已验证（禁止非法跳转）
- [ ] 审计日志记录了所有写操作

**性能检查**：
- [ ] 后端启动时间 < 10s
- [ ] 首次创建项目响应 < 500ms
- [ ] 流程画布加载 < 1s
- [ ] 内存占用稳定（重启前后无明显增长）

**安全检查**（MVP 可接受的妥协）：
- [ ] 无明显 XSS 漏洞（输入框都有 sanitization）
- [ ] 无硬编码密钥或密码
- [ ] 审计日志记录了用户 ID（用于后续追踪）
- [ ] 已知限制（无 JWT、无限流）已文档化

**文档完整性**：
- [ ] 用户操作指南已发布
- [ ] 维护说明（本文档）已完成
- [ ] 快速参考指南已更新
- [ ] API 文档已生成（Swagger/OpenAPI）

**已知问题处理**：
- [ ] 所有 P0 阻塞项已解除或明确标记为"接受的限制"
- [ ] 所有 P1 问题已记录至 backlog
- [ ] 用户被告知已知限制列表

---

### 6.2 生产版发布清单（规划，非当前 MVP）

除上述内测清单外，生产版额外要求：

**安全加固**：
- [ ] JWT 鉴权已实现与测试
- [ ] RBAC 权限控制已完成
- [ ] Rate Limiting（API 限流）已启用
- [ ] HTTPS/TLS 已配置
- [ ] CORS 策略已严格限制
- [ ] 敏感数据（密钥、令牌）已规范化管理
- [ ] 安全审查报告已通过

**可靠性加固**：
- [ ] 数据库持久化已切换为 PostgreSQL
- [ ] 事务处理已实现（QueryRunner + outbox）
- [ ] 灾难恢复预案已制定和演练
- [ ] 监控告警已部署（Prometheus + Grafana）
- [ ] 日志收集已配置（ELK 或类似）

**性能优化**：
- [ ] 缓存策略已实现（Redis）
- [ ] 异步任务队列已部署（BullMQ）
- [ ] 数据库索引已优化
- [ ] 前端代码分割已实现

**容量规划**：
- [ ] 预期并发用户数已测试
- [ ] 数据增长预测已入盘
- [ ] 存储容量规划已制定

---

## 七、常见运维任务

### 7.1 灾备与数据恢复（生产环境）

#### 定期备份

```bash
# 每日 02:00 执行全量备份
0 2 * * * pg_dump -U postgres -h localhost flowchart | \
  gzip > /backup/flowchart-$(date +\%Y\%m\%d).sql.gz

# 备份文件自动清理（保留最近 30 天）
find /backup -name "flowchart-*.sql.gz" -mtime +30 -delete
```

#### 数据恢复

```bash
# 从备份恢复（假设备份文件为 flowchart-20260414.sql.gz）
gunzip < /backup/flowchart-20260414.sql.gz | \
  psql -U postgres -h localhost -d flowchart
```

### 7.2 版本升级

```bash
# 步骤 1：备份当前版本
git stash
git tag -a v0.1-before-upgrade -m "snapshot before upgrade"

# 步骤 2：切换到新版本
git checkout main  # 或对应分支
git pull origin main

# 步骤 3：更新依赖
cd apps/api && npm install
cd ../web && npm install

# 步骤 4：运行迁移（如有）
npm run migration:run  # 仅当有 DB 迁移时

# 步骤 5：测试
npm run test

# 步骤 6：重启服务
# 后端：Ctrl+C，然后 npm run start:dev
# 前端：Ctrl+C，然后 npm run dev

# 步骤 7：验证功能
# 手动测试关键流程
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{"name":"升级测试"}'
```

### 7.3 性能诊断

```bash
# 过程太慢？使用以下工具诊断

# 后端响应时间分析
curl -w "Total time: %{time_total}s\n" http://localhost:3000/api/v1/projects

# 前端性能分析（Chrome DevTools）
# F12 → Performance → Record → 操作 → Stop
# 查看 CPU、Memory、Network 时间线

# Node.js 内存占用
node --inspect apps/api/dist/main.js
# 打开 chrome://inspect，连接到进程

# 查看已用内存
ps aux | grep node  # 查看 RSS 列
```

---

## 八、应急联系清单

| 角色 | 联系方式 | 预期响应时间 | 职责 |
|------|--------|----------|------|
| **后端主负责** | [Slack / Phone] | 营业时间 1 小时 | 后端故障排查与紧急修复 |
| **前端主负责** | [Slack / Phone] | 营业时间 1 小时 | 前端故障排查与紧急修复 |
| **DevOps / 基础设施** | [Slack / Phone] | 24/7（轮值）| 服务器、数据库、CDN 问题 |
| **产品 PM** | [Slack / Email] | 营业时间 2 小时 | 需求澄清、客户沟通 |
| **安全团队** | security@[domain] | 当日处理 | 安全漏洞报告 |

---

## 九、版本历史

| 日期 | 版本 | 变更内容 | 维护责任人 |
|------|------|--------|----------|
| 2026-04-14 | v0.1 | 初版发布：完整 MVP 运维手册，包含启停、日志排障、风险回滚、上线清单 | 文档撰写员 |
