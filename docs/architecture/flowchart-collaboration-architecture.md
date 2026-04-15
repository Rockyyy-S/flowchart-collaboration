# flowchart-collaboration MVP 架构边界文档

> 版本：v0.1 | 日期：2026-04-14 | 负责角色：架构设计师 | 状态：已审核

## 架构决策摘要

1. 采用分层单体优先策略：前后端分离，后端以 NestJS 模块化单体为主，预留事件化扩展点，避免 MVP 过早拆分微服务。
2. 流程拓扑与执行态分离：流程定义存 PostgreSQL JSONB，节点运行态以关系表管理，保证“定义可演进、执行可审计”。
3. 门禁判定以服务端为唯一真相：前端仅做提示，最终放行由后端 Gate Engine 判定，避免绕过校验。
4. 文档门禁仅对平台内文件生效：外链可记录但不计入门禁通过条件，保证规则可验证。
5. API 先 REST 后扩展：v0.1 统一 REST + OpenAPI 契约，复杂查询需求在 v1.x 再评估 GraphQL。
6. 通知采用异步事件驱动：业务主链路只负责发布事件，站内信/邮件由通知消费者异步执行，降低流转延迟。
7. 权限采用“项目角色 + 资源动作”双层校验：最小可用 RBAC，覆盖项目、节点执行、文档三类资源。
8. 可观测性从 MVP 即内建：日志、指标、审计三线并行，支持门禁失败、状态错配、通知积压的快速定位。

## 系统分层

### 1) 表现层（Web 前端）

- 技术：React 18 + TypeScript + Vite + Ant Design v5 + TailwindCSS + LogicFlow。
- 职责：流程图编辑、节点配置、文档上传、项目看板、通知中心。
- 边界：不做最终门禁判定、不做权限裁决，仅消费后端契约并展示结果。

### 2) 接口层（API Gateway / BFF 形态）

- 技术：NestJS Controller + DTO + Validation Pipe。
- 职责：鉴权、参数校验、幂等处理、错误码标准化、OpenAPI 输出。
- 边界：不承载复杂业务规则，业务规则下沉到领域服务。

### 3) 领域层（核心业务）

- 模块：项目与成员、流程定义、节点执行、门禁引擎、文档资产、通知编排、审计追踪。
- 职责：状态机流转、门禁验证、事件发布、权限裁决。
- 边界：不得直接依赖具体存储 SDK，实现通过仓储与适配器抽象。

### 4) 基础设施层

- 数据：PostgreSQL（主数据）、Redis（缓存/队列）、对象存储（MinIO/OSS）。
- 平台：邮件服务、日志与指标采集、任务调度。
- 边界：仅提供能力，不包含业务决策。

## 模块边界与约束

| 模块 | 输入 | 输出 | 关键约束 |
|---|---|---|---|
| Project Workspace | 创建项目、成员配置 | 项目空间、成员关系 | 项目初始化必须原子化（项目+默认空间+默认流程草稿） |
| Flow Definition | 流程 JSON、节点元数据 | 已发布流程版本 | 已发布版本只允许“增量新版本”，不可原地覆盖 |
| Node Execution | 节点动作（开始/提交） | 节点状态变化、执行记录 | 状态流转必须走状态机，禁止跨状态写库 |
| Gate Engine | 节点必需输出物配置、文件关联 | 通过/失败及失败原因 | 门禁失败必须返回机器可读原因码 |
| Document Asset | 文件流、元数据、关联关系 | 文档版本、预览信息 | 删除文件需触发反向影响检查 |
| Notification Orchestrator | 领域事件 | 站内信、邮件任务 | 通知失败不得阻断主流程，必须可重试 |
| AuthZ & Audit | 用户身份、资源动作 | 放行/拒绝、审计日志 | 所有写操作必须有审计日志 |

## 领域模型（MVP）

### 核心实体

| 实体 | 关键字段 | 说明 |
|---|---|---|
| Project | id, name, status, ownerId | 项目主聚合根 |
| ProjectMember | projectId, userId, role | 项目成员与角色关系 |
| FlowDefinition | id, projectId, version, graphJson, publishStatus | 流程定义与版本 |
| NodeDefinition | flowId, nodeId, name, type, requiredArtifacts | 节点静态配置 |
| NodeExecution | id, projectId, flowVersion, nodeId, status, assignees, dueAt | 节点运行态 |
| ArtifactRequirement | nodeId, name, required, sourceType | 输出物要求 |
| Document | id, projectId, storageKey, name, size, mimeType, version | 文档元数据 |
| ArtifactBinding | nodeExecutionId, requirementId, documentId/externalUrl | 输出物与实际对象绑定 |
| NotificationTask | id, eventType, channel, receiver, status, retryCount | 通知任务 |
| AuditLog | id, actorId, action, resourceType, resourceId, payload | 审计记录 |

### 关系与聚合规则

- Project 为顶层聚合；FlowDefinition、ProjectMember 在项目边界内管理。
- NodeExecution 绑定具体 flowVersion，保证流程变更不污染历史执行。
- ArtifactBinding 在 NodeExecution 边界内维护，门禁仅检查当前执行实例的绑定结果。
- Document 独立聚合，通过关联表连接到业务对象，避免文件服务与流程服务强耦合。

## 核心状态机

### 节点执行状态（MVP）

```text
PENDING(待启动)
  -> READY(可开始)          [前置节点全部 COMPLETED]
READY
  -> IN_PROGRESS(进行中)    [执行人点击开始]
IN_PROGRESS
  -> GATE_CHECKING(门禁检查中) [执行人提交完成]
GATE_CHECKING
  -> COMPLETED(已完成)      [门禁通过]
GATE_CHECKING
  -> NEEDS_FIX(待补齐)      [门禁失败]
NEEDS_FIX
  -> IN_PROGRESS            [补齐后重新提交]
```

### 状态机约束

- 仅允许单步合法迁移，禁止 PENDING 直接到 IN_PROGRESS。
- GATE_CHECKING 必须由系统触发，不允许前端直接写入。
- COMPLETED 为终态（MVP 不支持回退），如需回滚通过管理员动作创建修订任务。

## 关键 API 契约（v0.1）

### 契约规范

- 协议：HTTPS + JSON，统一前缀 `/api/v1`。
- 鉴权：JWT Bearer。
- 幂等：涉及状态变更的提交接口需支持 `Idempotency-Key`。
- 错误码：`{code, message, requestId, details}`。

### 核心接口清单

| 场景 | 方法与路径 | 请求要点 | 响应要点 |
|---|---|---|---|
| 创建项目 | POST /projects | name, members[] | projectId, workspaceId |
| 获取流程定义 | GET /projects/{projectId}/flows/current | projectId | flowVersion, graphJson |
| 保存流程草稿 | PUT /projects/{projectId}/flows/draft | graphJson, nodesConfig | draftVersion |
| 发布流程版本 | POST /projects/{projectId}/flows/publish | expectedDraftVersion | flowVersion |
| 查询节点执行态 | GET /projects/{projectId}/executions | 可选 status 过滤 | executions[] |
| 开始节点执行 | POST /executions/{executionId}/start | operatorId | status=IN_PROGRESS |
| 提交节点完成 | POST /executions/{executionId}/submit | operatorId, comment | status=GATE_CHECKING |
| 查询门禁结果 | GET /executions/{executionId}/gate-result | executionId | pass, missingArtifacts[] |
| 上传文档 | POST /projects/{projectId}/documents | multipart file + metadata | documentId, version |
| 绑定输出物 | POST /executions/{executionId}/artifacts/bind | requirementId + documentId/url | bindingId |
| 通知拉取 | GET /me/notifications | page, unreadOnly | list, unreadCount |

### 前后端契约红线

- 前端不得拼装状态迁移；必须调用专用动作接口（start/submit）。
- 后端返回的 `missingArtifacts[].requirementId` 必须稳定，前端据此精准定位缺项。
- 流程图 `nodeId` 一经发布不可复用到不同语义节点，避免历史执行串扰。

## 存储方案（MVP）

### PostgreSQL（主存储）

- 表族：projects、project_members、flow_definitions、node_executions、artifact_requirements、artifact_bindings、documents、notifications、audit_logs。
- 关键索引：
  - `node_executions(project_id, status)`
  - `artifact_bindings(node_execution_id, requirement_id)` 唯一索引
  - `documents(project_id, created_at desc)`
- 事务边界：节点提交 + 门禁判定结果落库 + 事件写入 outbox 必须同事务。

### Redis（缓存与异步）

- 用途：通知任务队列、短期查询缓存、幂等键缓存。
- 约束：缓存失效不影响正确性，仅影响性能。

### 对象存储（MinIO/OSS）

- 路径规范：`/{projectId}/{documentId}/v{n}/{filename}`。
- 上传策略：服务端签名上传或中转上传二选一；MVP 建议中转上传便于统一审计。

## 安全与可观测基线

### 安全基线

1. 所有写接口必须鉴权并校验项目成员身份。
2. 文件下载必须二次鉴权，禁止直出裸对象存储 URL。
3. 关键动作（发布流程、删除文档、节点提交）写入审计日志。
4. 输入校验启用白名单 DTO，禁止未声明字段入库。
5. 限流基线：写接口按用户与项目双维度限流。

### 可观测基线

- 日志：结构化日志（requestId、projectId、executionId、actorId）。
- 指标：
  - `gate_check_pass_rate`
  - `gate_check_latency_ms`
  - `execution_state_transition_total`
  - `notification_queue_lag`
- 链路：API -> 领域服务 -> 存储/通知全链路 requestId 透传。
- 告警：门禁失败率突增、通知堆积、状态迁移失败率超阈值。

## 架构约束清单（前后端必须遵循）

1. 状态变更只能通过后端动作接口触发，禁止前端直改状态字段。
2. 门禁判定以服务端结果为准，前端本地校验仅用于即时提示。
3. 已发布流程版本不可原地修改；变更必须生成新版本并显式发布。
4. 文档门禁只认平台内文档绑定记录，外链永不计入 required 满足条件。
5. 任意写操作都必须写审计日志并携带操作者身份。
6. API 字段命名与枚举值需由 OpenAPI 单一来源生成，前后端不得各自维护常量副本。
7. 节点与输出物的主键必须稳定且可追溯，不允许“删除重建”替代更新。

## 前后端并行开发对齐清单

| 对齐项 | 前端产出 | 后端产出 | 对齐完成标准 |
|---|---|---|---|
| 状态机枚举 | 节点状态 UI 映射表 | 状态机枚举与迁移规则 | 同一份枚举字典，联调零映射歧义 |
| 流程定义模型 | LogicFlow JSON 适配层 | graphJson 校验器 | 同一 schema 校验通过 |
| 门禁缺项展示 | 缺项高亮与补齐入口 | `missingArtifacts` 稳定返回 | 缺项可一键定位到输出物 |
| 文件上传链路 | 上传组件与进度反馈 | 上传接口+元数据落库 | 100MB 文件上传成功率达标 |
| 通知体验 | 通知中心页面 | 事件消费与发送策略 | 主流程不因通知失败阻塞 |
| 错误处理 | 统一错误提示组件 | 统一错误码与 requestId | 任一失败可追踪到后端日志 |

## 里程碑拆分（研发阶段，v0.1）

### M1（Week 1-2）：骨架与契约冻结
- 输出 OpenAPI v0.1 草案。
- 完成项目/流程/节点执行核心表结构。
- 打通项目创建与流程草稿保存。

### M2（Week 3-4）：核心闭环
- 完成节点 start/submit 与门禁判定闭环。
- 完成文档上传与输出物绑定。
- 打通节点完成后自动激活下游节点。

### M3（Week 5-6）：通知与权限
- 上线站内通知与邮件通知异步队列。
- 完成项目成员角色权限校验。
- 建立审计日志查询能力。

### M4（Week 7-8）：稳定性与联调收敛
- 压测关键路径（流程加载、门禁校验、文件上传）。
- 完成前后端联调清单收口。
- 形成 v0.1 架构基线与遗留问题列表（进入 v1.0 规划）。

## 实施建议

1. 第一周冻结 API 契约与状态机枚举，避免联调阶段反复返工。
2. 门禁引擎先做“存在性校验”最小闭环，规则门禁保留扩展接口。
3. 使用 Outbox 模式发布通知事件，降低事务后消息丢失风险。
4. 优先搭建审计检索页，便于 QA 与后续安全审查快速验收。
5. 建议每周一次架构例会，检查约束执行偏差与接口漂移。

## 风险与回退策略

| 风险 | 触发信号 | 回退策略 |
|---|---|---|
| 权限边界不清导致越权 | 出现跨项目读写 | 临时收紧为项目级白名单，暂停细粒度动作开放 |
| 门禁误判导致流程阻塞 | 门禁失败率异常升高 | 切换为“告警模式”并记录审计，人工放行兜底 |
| 前后端接口漂移 | 联调缺陷集中在字段不一致 | 以 OpenAPI 自动生成类型，冻结变更窗口 |
| 通知积压影响体验 | 队列延迟持续超阈值 | 降级为站内通知优先，邮件改批处理 |
| 流程定义变更污染运行态 | 历史节点状态错乱 | 强制绑定 flowVersion，禁止覆盖发布版本 |

## 参考输入资料
- docs/requirements/flowchart-collaboration-prd.md
- docs/requirements/ai-solutions-integration.md
- raw-data/关于流程图驱动的项目协作管理软件的初始想法.md
- docs/business/flowchart-collaboration-biz-assessment.md