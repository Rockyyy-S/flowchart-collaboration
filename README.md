# 流程图协作管理系统 / Flow Collaboration

用流程图驱动团队协作，可视化项目执行链路。当前状态：MVP v3.2+，生产就绪。

## 快速开始（3-5 分钟上手）

### 1) 前置条件检查

- 推荐 Node.js 20 LTS（最低 18+）
- 推荐 npm 9+

```bash
node --version
npm --version
```

### 2) 克隆并进入项目

```bash
git clone <repo>
cd flowchart-collaboration
```

### 3) 安装依赖并启动后端

```bash
cd apps/api
npm install
npm run start:dev
```

后端默认地址：`http://localhost:3000`  
Swagger：`http://localhost:3000/api-docs`  
健康检查：`http://localhost:3000/api/v1/health`

### 4) 启动前端

新开一个终端：

```bash
cd apps/web
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`

### 5) 首次登录说明（MVP）

当前版本采用开发态令牌流程，不使用固定账号密码：

- 打开前端后，通过页面中的“获取开发令牌”入口输入用户标识（建议 `user-001`）
- 系统会调用 `POST /api/v1/auth/token` 获取 Bearer Token
- 后续写操作自动携带 `Authorization: Bearer <token>`

说明：注册/密码体系将在后续版本与正式身份系统统一接入。

## 项目结构

```text
flowchart-collaboration/
├── apps/
│   ├── api/              # NestJS 后端
│   ├── web/              # React 前端
├── docs/                 # 文档（需求、架构、部署等）
├── raw-data/             # 原始想法与方案材料
├── README.md             # 本文件
└── ...
```

## 核心功能

- 项目与团队管理
- 流程图可视化编辑（拖拽、缩放、节点编辑）
- 节点执行状态跟踪（开始、提交、回退、审核）
- 产出物与门禁管理（必填输出物校验）
- 权限控制（OWNER/MEMBER/VIEWER）

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | React + TypeScript | 18.x / 5.x |
| 样式 | TailwindCSS + Ant Design | 3.x / 5.x |
| 后端 | NestJS | 10.x |
| 数据库 | 内存 / PostgreSQL | MVP / 生产 |
| 工具链 | Vite + npm | 5.x + 最新 |

版本说明：当前仓库中前端依赖为 React 18、Vite 5、TypeScript 5；后端为 NestJS 10、TypeScript 5。MVP 默认以内存存储运行，生产建议切换 PostgreSQL。

## 关键文档导航

- [快速参考](docs/quick-reference-guide.md) - 常用操作
- [架构设计](docs/architecture/flowchart-collaboration-architecture.md) - 系统设计
- [需求文档](docs/requirements/flowchart-collaboration-prd.md) - 功能规范
- [部署指南](docs/ops/flowchart-collaboration-deployment.md) - 如何部署
- [上线管理](docs/ops/flowchart-collaboration-go-live.md) - 如何上线
- [测试报告](docs/qa/flowchart-collaboration-test-report.md) - QA 验证
- [用户手册](docs/user-docs/flowchart-collaboration-user-guide.md) - 用户操作指南

## 开发指南

后端本地运行：

```bash
cd apps/api
npm run start:dev
```

前端本地运行：

```bash
cd apps/web
npm run dev
```

构建生产版本（分别执行）：

```bash
cd apps/api
npm run build

cd ../web
npm run build
```

运行测试：

```bash
# 后端单元测试
cd apps/api
npm test

# 后端 e2e
npm run test:e2e

# 前端 Playwright e2e
cd ../web
npm run test:e2e
```

项目规范入口：

- [.github/copilot-instructions.md](.github/copilot-instructions.md)
- [.github/instructions/](.github/instructions/)

## API 文档

- Swagger 文档：启动后端后访问 `http://localhost:3000/api-docs`
- 健康检查：`GET http://localhost:3000/api/v1/health`
- API 基础前缀：`/api/v1`

## 团队协作

- 代码规范：见 `.github/instructions/` 中各规范文档
- 提问机制：优先查阅 `docs/` 与代码注释，再发起讨论
- 问题反馈：提 Issue，或在 `docs/context/` 中补充阻塞记录

## 已知限制与改进方向

### 已知限制（MVP）

- 数据默认存储在内存，服务重启后数据会丢失
- 文档上传当前以元数据流程为主，生产需接入对象存储
- 通知系统为占位能力，尚未接入完整消息基础设施

### 改进方向（下一版本）

- 子流程能力增强：分层流程与复用节点模板
- 高级权限模型：更细粒度角色与字段级控制
- 团队模板库：沉淀可复用交付模板与最佳实践
- 生产基础设施：PostgreSQL + 对象存储（S3/OSS）+ 消息队列（RabbitMQ/Redis）

## 许可与贡献

- 许可：当前按内部项目管理（如需开源，建议采用 MIT 并补充 LICENSE）
- 贡献：欢迎提交 Issue/PR；涉及接口契约、权限模型、门禁策略的改动请先提交设计说明

## 支持与联系

- 技术问题：联系开发团队维护者
- 用户问题：优先查阅用户手册，或按组织流程提交工单
