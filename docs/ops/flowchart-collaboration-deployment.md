# flowchart-collaboration 部署指南（Deployment Guide）

> 版本：v1.0 | 日期：2026-05-01 | 负责角色：文档撰写员 | 状态：已审核

## 1. 部署前置条件

本指南覆盖从本地开发到单机生产部署的完整链路，默认适配当前 MVP 架构：后端 NestJS（apps/api）+ 前端 React/Vite（apps/web）。

### 1.1 硬件要求

| 环境 | CPU | 内存 | 磁盘 | 说明 |
|---|---|---|---|---|
| 本地开发 | 2 vCPU | 4 GB | 20 GB 可用 | 可同时运行 API + Web + 浏览器 |
| 单机测试/预发 | 4 vCPU | 8 GB | 40 GB 可用 | 建议启用 PM2/Nginx |
| 单机生产（MVP） | 4-8 vCPU | 16 GB | 80 GB+ SSD | 含日志、构建产物、备份空间 |

### 1.2 软件依赖

| 组件 | 推荐版本 | 最低版本 | 验证命令 |
|---|---|---|---|
| Node.js | 20 LTS | 18+ | node --version |
| npm | 10.x | 9+ | npm --version |
| Git | 2.30+ | 2.20+ | git --version |
| PM2（可选） | 5.x | 5+ | pm2 --version |
| Nginx（可选） | 1.20+ | 1.18+ | nginx -v |

说明：后端 README 已按 Node.js 20 + TypeScript 5.3 验证；前端 README 要求 Node.js >= 18。统一使用 Node.js 20 LTS 可减少依赖差异。

### 1.3 网络与端口要求

| 端口 | 用途 | 来源 |
|---|---|---|
| 3000 | 后端 API（含 /api/v1 与 /api-docs） | apps/api/src/main.ts |
| 5173 | 前端开发服务器（仅开发） | apps/web/vite.config.ts |
| 80/443 | Nginx 对外访问端口 | 生产建议 |

网络建议：

- 生产仅开放 80/443 到公网；3000 仅内网可达。
- 服务器防火墙允许 22（运维）、80/443（业务）、必要时 9100（监控 Exporter）。
- 若使用云安全组，限制来源 IP，避免管理端口暴露。

### 1.4 外部服务现状与生产建议

当前状态：

- 数据持久化：以内存为主（服务重启会丢失状态）。
- 文件上传：MVP 以元数据链路为主。

生产建议：

- 数据库：PostgreSQL（主数据）+ Redis（缓存/限流/队列）。
- 对象存储：MinIO 或云 OSS（阿里云 OSS / 腾讯 COS / AWS S3）。
- 审计与日志：集中到 ELK/ClickHouse/Loki 之一。

参考文档：

- 架构边界：[docs/architecture/flowchart-collaboration-architecture.md](../architecture/flowchart-collaboration-architecture.md)
- 项目上下文：[docs/context/flowchart-collaboration-context.md](../context/flowchart-collaboration-context.md)
- 维护手册：[docs/ops/flowchart-collaboration-maintenance-runbook.md](./flowchart-collaboration-maintenance-runbook.md)

## 2. 本地开发环境搭建

### 2.1 克隆仓库

```bash
git clone <your-repo-url>
cd flowchart-collaboration
```

### 2.2 安装后端依赖（apps/api）

```bash
cd apps/api
npm install
```

可执行检查：

```bash
npm run build
npm run test
```

### 2.3 安装前端依赖（apps/web）

```bash
cd ../web
npm install
```

可执行检查：

```bash
npm run build
npm run test
```

### 2.4 环境变量配置

后端示例（apps/api/.env）：

```bash
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
DB_URL=memory://local-store

JWT_SECRET=dev-secret-change-me
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=dev-refresh-secret-change-me
JWT_REFRESH_EXPIRES_IN=7d
```

前端示例（apps/web/.env.local）：

```bash
VITE_API_BASE_URL=/api/v1
```

说明：

- 后端生产环境必须配置 JWT_SECRET/JWT_REFRESH_SECRET。
- 本地开发可沿用 apps/api/.env.example 并按需覆盖。

### 2.5 本地启动步骤

终端 A（后端）：

```bash
cd apps/api
npm run start:dev
```

终端 B（前端）：

```bash
cd apps/web
npm run dev
```

### 2.6 验证步骤

健康检查：

```bash
curl -i http://localhost:3000/api/v1/health
```

预期响应：

```json
{ "status": "ok" }
```

浏览器验证：

- 打开 http://localhost:5173
- 可访问工作台页面并进行项目创建/流程编辑

## 3. 单机部署（MVP 第一阶段）

### 3.1 进程管理选择：PM2 或 systemd

| 方案 | 适用场景 | 优点 | 注意点 |
|---|---|---|---|
| PM2 | 快速上线、Node 团队熟悉 | 启停简单、日志集中、生态成熟 | 需额外安装 PM2 |
| systemd | Linux 原生运维体系 | 系统级守护、与 journald 集成 | 配置稍复杂 |

建议：MVP 首期优先 PM2，上云稳定后可迁移 systemd 或容器编排。

### 3.2 后端部署流程

部署步骤（在服务器执行）：

```bash
cd /srv/flowchart-collaboration/apps/api

# 1) 安装生产依赖
npm install --omit=dev

# 2) 构建
npm run build

# 3) 准备生产变量
cp .env.example .env.production
# 手动编辑 .env.production

# 4) 启动（二选一）
NODE_ENV=production node dist/main
# 或
npm run start:prod
```

.env.production 建议：

```bash
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com
DB_URL=postgres://user:pass@127.0.0.1:5432/flowchart

JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=<strong-random-refresh-secret>
JWT_REFRESH_EXPIRES_IN=7d
```

接口验证：

```bash
curl -i http://127.0.0.1:3000/api/v1/health
curl -i http://127.0.0.1:3000/api-docs
```

### 3.3 前端部署流程

```bash
cd /srv/flowchart-collaboration/apps/web
npm install
npm run build
```

构建产物：apps/web/dist

部署方式：

- 方式 A：Nginx 静态站点（推荐）
- 方式 B：上传到 CDN/对象存储（需配置回源与 SPA fallback）

### 3.4 Nginx 反向代理配置示例（含 SPA 路由）

以下配置示例可直接改域名后使用：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /srv/flowchart-collaboration/apps/web/dist;
    index index.html;

    # 前端静态资源
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 可选：Swagger
    location /api-docs {
        proxy_pass http://127.0.0.1:3000/api-docs;
    }
}
```

### 3.5 PM2 示例（推荐）

```bash
cd /srv/flowchart-collaboration/apps/api
pm2 start dist/main.js --name flowchart-api --time
pm2 save
pm2 startup
```

常用命令：

```bash
pm2 ls
pm2 logs flowchart-api
pm2 restart flowchart-api
pm2 stop flowchart-api
```

### 3.6 systemd 示例（可选）

```ini
[Unit]
Description=flowchart-collaboration api
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/flowchart-collaboration/apps/api
Environment=NODE_ENV=production
EnvironmentFile=/srv/flowchart-collaboration/apps/api/.env.production
ExecStart=/usr/bin/node /srv/flowchart-collaboration/apps/api/dist/main.js
Restart=always
RestartSec=5
User=www-data

[Install]
WantedBy=multi-user.target
```

### 3.7 日志收集与监控关键路径

| 维度 | 关键项 | 建议阈值 |
|---|---|---|
| 可用性 | /api/v1/health 可达率 | >= 99.9% |
| 性能 | P95 API 时延 | <= 800ms |
| 稳定性 | 5xx 比例 | < 1% |
| 业务 | submit gatePass 通过率 | 按阶段基线跟踪 |
| 资源 | Node 进程内存 | < 75% 机器内存 |

后端日志查看：

- PM2：pm2 logs flowchart-api
- systemd：journalctl -u flowchart-api -f
- 重点检索关键词：request.error、RATE_LIMITED、UNAUTHORIZED、PROJECT_FORBIDDEN

## 4. 生产环境建议（扩展阶段）

### 4.1 数据库迁移（内存 -> PostgreSQL）

建议步骤：

1. 建模落库（projects/flows/executions/documents/audit_logs）。
2. 将 StoreService 抽象为 Repository 层。
3. 引入迁移工具（TypeORM migration 或 Prisma migration）。
4. 灰度双写（短期）并完成一致性比对。

### 4.2 云平台部署参考

| 平台 | 计算 | 存储 | 监控 |
|---|---|---|---|
| AWS | EC2 / ECS | RDS + S3 | CloudWatch |
| 阿里云 | ECS / SAE | RDS + OSS | 云监控 |
| 腾讯云 | CVM / TKE | PostgreSQL + COS | 腾讯云监控 |

### 4.3 CI/CD 流水线建议（GitHub Actions 示例）

```yaml
name: deploy-mvp
on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd apps/api && npm ci && npm run build
      - run: cd apps/web && npm ci && npm run build
      - run: echo "deploy step via ssh/rsync/container registry"
```

说明：以上为模板示例，需要结合企业凭据管理与制品仓库配置。

### 4.4 容器化建议（Docker 示例）

后端 Dockerfile 示例：

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

前端可采用 Nginx 静态镜像承载 dist 目录。

### 4.5 应用监控与告警

建议链路：Prometheus + Grafana + Alertmanager。

告警建议：

- 5xx 错误率 > 2% 持续 5 分钟。
- P95 延迟 > 1.2s 持续 10 分钟。
- 健康检查失败连续 3 次。
- 单机内存 > 85% 持续 10 分钟。

## 5. 故障排查

### 5.1 常见问题与方案

| 问题 | 现象 | 处理方式 |
|---|---|---|
| API 无法启动 | 端口占用/环境变量缺失 | 检查 3000 端口、校验 .env.production |
| 前端白屏 | Nginx SPA 未配置 | 确认 try_files $uri $uri/ /index.html |
| 频繁 401 | Token 失效或前端域名不匹配 | 检查 JWT 配置、FRONTEND_URL 与代理头 |
| 跨项目 403 | 权限守卫生效 | 检查成员关系、team/project 归属 |
| 数据丢失 | 服务重启后记录消失 | 当前为内存模式，需尽快迁移 PostgreSQL |

### 5.2 日志诊断流程

1. 先确认 requestId（错误响应中返回）。
2. 在后端日志检索 requestId + path。
3. 核对状态机迁移：READY -> IN_PROGRESS -> GATE_CHECKING。
4. 如为门禁失败，定位 missingArtifacts 与绑定记录。

### 5.3 性能问题排查

- 基线压测：先测 /api/v1/health 与项目核心读写接口。
- 排查顺序：CPU/内存 -> Node 事件循环阻塞 -> Nginx upstream -> 外部依赖。
- 重点关注：大请求体、日志量突增、频繁鉴权失败导致重试风暴。

### 5.4 安全问题排查

- 检查是否误放开 CORS origin。
- 检查生产环境是否开启 HSTS（NODE_ENV=production）。
- 检查密钥是否轮换、是否泄露到日志。
- 对照安全审查文档进行逐项复核：[docs/security/flowchart-collaboration-security-review.md](../security/flowchart-collaboration-security-review.md)

## 6. 回滚策略

### 6.1 版本管理

- 代码版本：使用 Git Tag（例如 v0.1.0、v0.1.1）。
- 发布记录：维护 releases 文档与发布窗口记录。
- 建议新增根目录 CHANGELOG.md；当前可先以 [docs/releases/v0.1.0-release-note.md](../releases/v0.1.0-release-note.md) 作为临时追溯入口。

### 6.2 快速回滚步骤

```bash
# 1) 切换到上一稳定版本
git fetch --all --tags
git checkout <last-stable-tag>

# 2) 重建后端
cd apps/api
npm install --omit=dev
npm run build
pm2 restart flowchart-api

# 3) 重建前端
cd ../web
npm install
npm run build
# 同步到 nginx root 或 CDN
```

### 6.3 数据恢复（内存状态丢失处理）

当前内存模式下，重启即丢失运行态，恢复策略如下：

1. 发布前导出关键业务快照（项目列表、流程草稿、文档元信息）。
2. 若重启后丢失，通过脚本重建最小演示数据：

```bash
cd apps/api
npm run seed:dev
```

3. 若需清理脏数据后重建：

```bash
cd apps/api
npm run reset:test
npm run seed:dev
```

备注：以上命令适用于开发/测试态；生产恢复应以持久化数据库备份为主。

## 7. 附录：执行清单（可打印）

| 阶段 | 检查项 | 结果 |
|---|---|---|
| 部署前 | Node/npm 版本符合要求 | ☐ |
| 部署前 | 端口与防火墙策略确认 | ☐ |
| 本地验证 | /api/v1/health 正常 | ☐ |
| 后端部署 | start:prod 可稳定运行 | ☐ |
| 前端部署 | Nginx + SPA 路由生效 | ☐ |
| 联调验证 | 核心链路可用（创建/提交/门禁） | ☐ |
| 监控告警 | 指标采集与告警生效 | ☐ |
| 回滚演练 | 回滚流程演练完成 | ☐ |
