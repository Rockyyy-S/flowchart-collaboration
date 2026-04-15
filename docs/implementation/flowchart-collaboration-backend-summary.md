# flowchart-collaboration 后端实现总结

> 版本：v0.1 | 日期：2026-04-14 | 负责角色：后端专家 | 状态：MVP 骨架完成

---

## 实现摘要

已完成 `apps/api/` 后端 MVP 骨架，采用 **NestJS 10 + TypeScript + 内存存储** 实现核心业务闭环。9 条路由全部落地，状态机约束与门禁判定已验证可运行。

---

## 工程目录结构

```
apps/api/
├── package.json               依赖声明（NestJS 10 + class-validator + uuid）
├── tsconfig.json              TypeScript 配置（emitDecoratorMetadata 必须开启）
├── tsconfig.build.json        构建配置
├── nest-cli.json              NestJS CLI 配置
├── README.md                  快速启动与端到端验证示例
└── src/
    ├── main.ts                应用入口（全局前缀/校验/过滤/拦截器）
    ├── app.module.ts          根模块
    ├── common/
    │   ├── enums/             ExecutionStatus 枚举（前后端共享来源）
    │   ├── interfaces/        实体接口（替换 DB 时保持不变）
    │   ├── filters/           HttpExceptionFilter（统一错误格式）
    │   └── interceptors/      RequestIdInterceptor（requestId 注入与响应包装）
    ├── shared/
    │   ├── store.service.ts   内存存储（Map，@Global 全应用可注入）
    │   └── shared.module.ts
    ├── audit/                 审计日志（所有写操作必须调用）
    ├── notifications/         通知编排（占位，后续接 BullMQ）
    ├── projects/              POST /api/v1/projects
    ├── flows/                 GET/PUT /api/v1/projects/:id/flows/*
    ├── documents/             POST/GET /api/v1/projects/:id/documents
    └── executions/
        ├── gate-engine.service.ts   门禁引擎（存在性校验，可独立扩展）
        ├── executions.service.ts    状态机 + 门禁触发 + 后继节点解锁
        ├── executions.controller.ts 动作接口（start/submit/gate-result/bind）
        └── executions.module.ts
```

---

## 接口与数据变更

### 实现的 API 路由

| 方法   | 路径                                           | 核心行为                                               |
|--------|------------------------------------------------|--------------------------------------------------------|
| POST   | /api/v1/projects                               | 原子创建：Project + 默认 FlowDefinition(DRAFT) + 成员 |
| GET    | /api/v1/projects/:projectId/flows/current      | 已发布版本优先；无发布则返回草稿                       |
| PUT    | /api/v1/projects/:projectId/flows/draft        | 更新 graphJson/nodesConfig；自动为新节点建 NodeExecution |
| GET    | /api/v1/projects/:projectId/executions         | 列表查询；支持 ?status= 过滤                           |
| POST   | /api/v1/projects/:projectId/documents          | 文档元数据落库（MVP 模拟上传）                         |
| GET    | /api/v1/projects/:projectId/documents          | 项目文档列表                                           |
| POST   | /api/v1/executions/:executionId/start          | READY\|NEEDS_FIX → IN_PROGRESS                        |
| POST   | /api/v1/executions/:executionId/submit         | IN_PROGRESS → GATE_CHECKING → COMPLETED\|NEEDS_FIX   |
| GET    | /api/v1/executions/:executionId/gate-result    | 返回 pass + missingArtifacts[]                         |
| POST   | /api/v1/executions/:executionId/artifacts/bind | 绑定文档/外链；同 requirementId 自动覆盖               |

### 内存数据模型（替换 PostgreSQL 时对应的表）

| 内存 Map/Array        | 对应 PostgreSQL 表       |
|-----------------------|--------------------------|
| store.projects        | projects                 |
| store.projectMembers  | project_members          |
| store.flowDefinitions | flow_definitions         |
| store.nodeExecutions  | node_executions          |
| store.artifactBindings| artifact_bindings        |
| store.documents       | documents                |
| store.auditLogs       | audit_logs               |
| store.notificationTasks| notification_tasks      |

### 统一响应格式

**成功：** `{ data: any, requestId: string }`  
**错误：** `{ code: string, message: string, requestId: string, details: string[] }`

---

## 状态机实现

```
PENDING  →(auto)→  READY  →(/start)→  IN_PROGRESS  →(/submit)→  GATE_CHECKING
                                                                       ↓
                                                    pass: COMPLETED ←─┤
                                                    fail: NEEDS_FIX ←─┘
NEEDS_FIX  →(/start)→  IN_PROGRESS  （补齐后重新提交）
```

- 合法迁移表定义在 `common/enums/execution-status.enum.ts`
- `submit()` 原子完成：IN_PROGRESS → GATE_CHECKING → 终态（正式版需 DB 事务）
- 节点 COMPLETED 后自动扫描 `predecessorNodeIds`，将满足条件的 PENDING 节点转为 READY

---

## 门禁引擎逻辑

```
GateEngineService.check(execution):
  1. 找 FlowDefinition.nodesConfig[execution.nodeId]
  2. 筛选 requiredArtifacts.filter(ar => ar.required === true)
  3. 查 ArtifactBindings where executionId = execution.id AND documentId IS NOT NULL
  4. boundRequirementIds = Set(bindings.map(b => b.requirementId))
  5. missingArtifacts = required.filter(ar => !boundRequirementIds.has(ar.id))
  6. return { pass: missingArtifacts.length === 0, missingArtifacts }
```

**架构约束执行**：externalUrl 绑定记录但不计入门禁（文档约束第 4 条）。

---

## 验证步骤

```bash
cd apps/api
npm install
npm run start:dev
```

完整端到端验证脚本见 [apps/api/README.md](../../apps/api/README.md)。

核心验证路径：
1. 创建项目 → 保存含必需输出物的流程草稿 → 获取 executionId
2. start → submit（不绑定文档）→ 预期 NEEDS_FIX + missingArtifacts 非空
3. 上传文档 → 绑定 → start（NEEDS_FIX→IN_PROGRESS）→ submit → 预期 COMPLETED
4. gate-result → 预期 pass=true, missingArtifacts=[]

---

## 风险与兼容性说明

| 风险项 | 说明 | 缓解措施 |
|--------|------|----------|
| 内存存储无持久化 | 重启全部丢失 | MVP 可接受；切换 PostgreSQL 时保持 Service 接口不变 |
| submit() 非事务 | 状态变更与事件发布分离，崩溃可能丢状态 | 正式版本引入 TypeORM QueryRunner + outbox 模式 |
| 无 JWT 鉴权 | 使用 x-user-id Header 模拟，存在伪造风险 | 正式版本接入 JWT + RBAC Guard，安全审查时补充 |
| 无限流 | 当前无 Rate Limiting 保护 | 正式版本加 @nestjs/throttler |
| NodeExecution 初始 READY | 保存草稿时所有节点直接 READY，绕过 PENDING 前置检查 | MVP 简化；正式版本按 predecessorNodeIds 决定初始状态 |
| 无 OpenAPI 文档生成 | 前端无法自动同步类型 | 后续引入 @nestjs/swagger 并输出 openapi.json |

---

## 交接说明

- **to_qa**：后端功能已完成，可执行 README 中的 curl 验证路径。重点用例：门禁失败→补齐→重提交的完整闭环。
- **to_docs**：新增 `apps/api/` 目录，接口变更见上表；错误码新增：`PROJECT_NOT_FOUND`、`EXECUTION_NOT_FOUND`、`INVALID_STATE_TRANSITION`、`GATE_RESULT_UNAVAILABLE`、`BINDING_TARGET_REQUIRED`、`DOCUMENT_NOT_FOUND`。
- **to_security**：鉴权（JWT）、RBAC、限流、文件下载鉴权尚未实现，属于安全基线 P0 待补项。
