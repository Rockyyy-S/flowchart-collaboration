# flowchart-collaboration 后端实现总结

> 版本：v0.2 | 日期：2026-04-15 | 负责角色：后端专家 | 状态：中危整改已补齐，待 QA/安全复核

---

## 实现摘要

已完成 `apps/api/` 后端 MVP 骨架，采用 **NestJS 10 + TypeScript + 内存存储** 实现核心业务闭环。9 条路由全部落地，状态机约束与门禁判定已验证可运行。

本轮补充完成以下安全/稳定性整改：

- 新增 OWNER 只读审计查询接口 `GET /api/v1/projects/:projectId/audit-logs`，支持按 `resourceType`、`resourceId` 过滤，返回 `requestId/actorId/action/resourceType/resourceId/payload/createdAt`。
- 新增最小内存限流守卫，并仅挂载到高风险/高频写接口：`POST /auth/token`、`POST /projects`、`POST /projects/:projectId/documents`、`POST /executions/:executionId/start`、`POST /executions/:executionId/submit`、`POST /executions/:executionId/artifacts/bind`；超限统一返回 `429 RATE_LIMITED`。
- 重构 `submit()` 为“先计算与暂存副作用，最后统一提交”的风格；不再先持久化 `GATE_CHECKING` 再执行后续动作，若通知或审计等后续步骤失败，会回滚 execution、后继节点解锁以及内存队列写入，避免半更新。
- 审计日志补充 `projectId` 顶层索引，便于按项目维度安全查询与追踪。

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
| GET    | /api/v1/projects/:projectId/audit-logs         | OWNER 查询项目审计日志；支持 `resourceType/resourceId` 过滤 |
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

### 本轮新增错误码

| 错误码 | 触发条件 |
|--------|----------|
| PROJECT_OWNER_REQUIRED | 非项目 OWNER 访问审计查询接口 |
| RATE_LIMITED | 命中基础限流窗口 |

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
- `submit()` 采用暂存后统一提交：先在内存副本中完成门禁计算、后继节点解锁计划、通知事件与审计准备，再一次性写回；异常时回滚到提交前快照
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
5. OWNER 调用 `/projects/:projectId/audit-logs` → 预期返回项目写操作审计记录；MEMBER/其他用户调用 → 预期 `403 PROJECT_OWNER_REQUIRED`
6. 连续高频调用上述 6 条写接口超过窗口上限 → 预期 `429 RATE_LIMITED`

---

## 风险与兼容性说明

| 风险项 | 说明 | 缓解措施 |
|--------|------|----------|
| 内存存储无持久化 | 重启全部丢失 | MVP 可接受；切换 PostgreSQL 时保持 Service 接口不变 |
| submit() 仍非真正事务 | 当前通过内存快照回滚避免半更新，但进程崩溃/多实例场景仍无法替代 DB 事务 | 切换 PostgreSQL 时引入事务 + outbox，确保跨进程一致性 |
| 限流仅为单实例内存实现 | 应用重启后窗口清空，多实例/分布式场景无法共享计数 | 正式版本切换 Redis 等集中式限流存储 |
| 无 JWT 鉴权 | 使用 x-user-id Header 模拟，存在伪造风险 | 正式版本接入 JWT + RBAC Guard，安全审查时补充 |
| NodeExecution 初始 READY | 保存草稿时所有节点直接 READY，绕过 PENDING 前置检查 | MVP 简化；正式版本按 predecessorNodeIds 决定初始状态 |
| 无 OpenAPI 文档生成 | 前端无法自动同步类型 | 后续引入 @nestjs/swagger 并输出 openapi.json |

---

## 交接说明

- **to_qa**：后端功能已完成，可执行 README 中的 curl 验证路径。重点用例：门禁失败→补齐→重提交的完整闭环。
- **to_docs**：接口变更见上表；本轮新增审计查询接口与错误码 `PROJECT_OWNER_REQUIRED`、`RATE_LIMITED`。
- **to_security**：VUL-05/07/08 已在当前内存架构下完成代码级整改，但生产级分布式事务、集中式限流与会话存储仍需正式版方案与复核。
