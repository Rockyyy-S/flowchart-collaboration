# flowchart-collaboration Context Doc

> 版本：v2.2 | 日期：2026-04-16 | 负责角色：文档撰写员 | 状态：已同步前端“真实流程画布”相关用户文档与实现总结；阶段门禁结论保持不变

## 元信息

| 字段 | 内容 |
|---|---|
| 项目名 | flowchart-collaboration |
| 项目目标 | 打造流程图驱动的项目协作执行平台，通过流程强约束、文档门禁与自动流转提升交付完整性与可追溯性。 |
| 项目类型 | B 类：Web 平台产品（0 到 1 MVP 交付） |
| 当前阶段 | 发布准备（阻塞，待 QA 门禁通过并补齐运行时联调证据） |
| DoD 档位 | Standard |
| 时间约束 | MVP 目标 2-3 个月上线；当前参考节奏为 Week 1-8 完成核心闭环与体验增强。 |
| 技术栈约束（MVP） | 前端限定 React 18 + TypeScript + Vite + Ant Design v5 + TailwindCSS；流程图引擎优先 LogicFlow。后端限定 Node.js + TypeScript + NestJS；数据库 PostgreSQL；缓存 Redis；文件存储 MinIO 或阿里云 OSS；通知采用站内 + 邮件。 |
| 需求基线文档 | [flowchart-collaboration-prd](../requirements/flowchart-collaboration-prd.md)、[flowchart-collaboration-biz-assessment](../business/flowchart-collaboration-biz-assessment.md)、[ai-solutions-integration](../requirements/ai-solutions-integration.md) |

## 架构约束

1. 状态变更仅允许通过后端动作接口触发，前端不可直接写状态。
2. 门禁通过与否以后端 Gate Engine 结果为准，前端仅做提示。
3. 已发布流程定义不可原地修改，必须新建版本发布。
4. 文档门禁仅统计平台内文档绑定记录，外链不计入 required 满足条件。
5. 所有写操作必须落审计日志并关联操作者身份与 requestId。
6. 前后端共享 OpenAPI 生成的枚举与类型，禁止双份手写常量。
7. 节点与输出物标识需稳定可追溯，禁止删除重建式“伪更新”。

## 阶段状态表

| 阶段 | 状态 | 产出链接 | 完成时间 | 备注 |
|---|---|---|---|---|
| 需求澄清 | ✅完成 | [flowchart-collaboration-prd](../requirements/flowchart-collaboration-prd.md) | 2026-04-13 | PRD v1.0 已形成需求基线。 |
| 架构边界 | ✅完成 | [flowchart-collaboration-architecture](../architecture/flowchart-collaboration-architecture.md) | 2026-04-14 | v0.1 MVP 架构边界已冻结，可支持前后端并行开发。 |
| 前端实现 | ✅完成 | [flowchart-collaboration-frontend-summary](../implementation/flowchart-collaboration-frontend-summary.md) | 2026-04-16 | 已完成真实可编辑流程画布改造：支持新增/删除节点、拖拽、连线、保存草稿，并保持执行态节点抽屉兼容。 |
| 后端实现 | ✅完成 | [flowchart-collaboration-backend-summary](../implementation/flowchart-collaboration-backend-summary.md) | 2026-04-15 | 已补齐当前架构下可落地的中危整改：OWNER 审计查询、基础内存限流、submit 原子提交/失败回滚；JWT、项目级访问控制、上传安全与 DTO 校验继续保持。 |
| QA 验证 | ✅完成 | [flowchart-collaboration-test-report](../qa/flowchart-collaboration-test-report.md) | 2026-04-16 | 已完成前端流程图编辑器专项回归：本次改动未发现新增阻塞级缺陷；但运行时联调证据仍未补齐，QA 门禁❌。 |
| 安全审查 | ✅完成 | [flowchart-collaboration-security-review](../security/flowchart-collaboration-security-review.md) | 2026-04-16 | 第三轮复审完成：VUL-10/11/12/13 全部关闭，安全门禁通过（v0.5）。 |
| 文档沉淀 | ✅完成 | [flowchart-collaboration-context](flowchart-collaboration-context.md)、[quick-reference-guide](../quick-reference-guide.md)、[flowchart-collaboration-user-guide](../user-docs/flowchart-collaboration-user-guide.md)、[flowchart-collaboration-maintenance-runbook](../ops/flowchart-collaboration-maintenance-runbook.md) | 2026-04-14 | MVP 文档沉淀完成：用户操作指南 + 维护运维手册已落地；2026-04-16 已同步真实流程画布与编辑模式说明。 |
| 发布准备 | ❌阻塞 | [v0.1.0-release-note](../releases/v0.1.0-release-note.md) | 2026-04-15 | 已形成上线/回滚清单与灰度演练记录；安全门禁已通过（v0.5），当前仅阻塞项为 QA 运行时联调证据缺失。 |

## 质量门禁状态

| 门禁项 | 状态 | 结论摘要 | 产出链接 |
|---|---|---|---|
| 需求门禁 | ✅通过 | PRD v1.0 已完成评审状态标记，可作为后续阶段输入。 | [flowchart-collaboration-prd](../requirements/flowchart-collaboration-prd.md) |
| 架构门禁 | ✅通过 | 已完成 v0.1 架构边界文档，覆盖分层、契约、约束与里程碑。 | [flowchart-collaboration-architecture](../architecture/flowchart-collaboration-architecture.md) |
| QA 门禁 | ❌未通过 | 本轮前端流程图编辑器回归确认：可视化画布、编辑能力、保存一致性、执行态抽屉兼容与前端类型检查均通过，未发现本次变更新增阻塞级缺陷；项目整体仍缺运行时联调证据，暂不满足放行条件。 | [flowchart-collaboration-test-report](../qa/flowchart-collaboration-test-report.md) |
| 安全门禁 | ✅通过 | 三轮复审完成：VUL-01~13 全部关闭或降级，安全门禁通过。 | [flowchart-collaboration-security-review](../security/flowchart-collaboration-security-review.md) |
| 发布门禁 | ❌未通过 | QA 仍阻塞（仅缺运行时联调证据），发布申请暂缓。 | [v0.1.0-release-note](../releases/v0.1.0-release-note.md) |

## 阻塞与风险记录

| 日期 | 阶段 | 记录 | 解除方式 | 状态 |
|---|---|---|---|---|
| 2026-04-14 | 架构边界 | MVP 架构边界文档尚未落盘，前后端实现输入不完整。 | 输出 architecture 文档并完成架构评审。 | 已解除 |
| 2026-04-14 | 发布准备 | 安全策略与审查深度尚未明确，可能影响上线窗口。 | 按 MVP 范围确认安全审查清单并预排审查时间。 | 未解除 |
| 2026-04-14 | 后端实现 | JWT 鉴权、RBAC Guard、限流（ThrottlerModule）尚未实现，属安全基线 P0 待补项。 | 安全审查阶段补充，交接给安全审查师。 | 已解除 |
| 2026-04-14 | 后端实现 | submit() 状态变更与事件发布尚非 DB 事务，正式版本需引入 TypeORM QueryRunner + outbox 模式。 | 切换 PostgreSQL 时同步处理。 | 未解除 |
| 2026-04-14 | 前端实现 | 流程画布为列表式占位实现，尚未集成 LogicFlow（拖拽编辑、真实有向图渲染）。 | 2026-04-16 已完成前端真实可编辑画布改造（等效能力）：新增/删除节点、拖拽、连线、保存草稿。 | 已解除 |
| 2026-04-14 | 前端实现 | 后端无 GET /projects 列表接口，项目列表依赖 localStorage（跨浏览器/清缓存后丢失）。 | 后端补 GET /projects 端点后修改 WorkbenchPage。 | 未解除 |
| 2026-04-14 | 前端实现 | MVP 所有节点初始为 READY 状态（后端简化），不符合真实依次解锁语义。 | 切换 PostgreSQL 后验证 predecessorNodeIds + unlockSuccessors 逻辑。 | 未解除 |
| 2026-04-15 | 安全审查 | 开发态 JWT 当前保存在 localStorage，若进入生产需改为更安全会话方案（如 httpOnly Cookie + CSRF 防护）。 | sessionStorage 迁移完成，满足 MVP 放行条件。 | 已解除 |
| 2026-04-14 | 安全审查 | 【VUL-01】身份伪造：硬编码 x-user-id 请求头，任何人可伪造身份，直接威胁多租户隔离。 | 实现 JWT 鉴权，移除 x-user-id 信任链（后端 2-4h，前端 2-3h）。 | 已完成（待安全复审） |
| 2026-04-14 | 安全审查 | 【VUL-02】跨项目访问控制缺失：API 未校验调用者是否为项目成员，任何认证用户可访问他人项目。 | 实现 RBAC 守卫，在所有项目级路由检查权限（3-5h）。 | 已完成（待安全复审） |
| 2026-04-14 | 安全审查 | 【VUL-03】路径遍历：文档上传 DTO 中 storageKey 由客户端提供，未规范化，可导致路径遍历。 | 改为服务端生成 storageKey，添加文件名清理工具函数（1-2h）。 | 已完成（待安全复审） |
| 2026-04-14 | 安全审查 | 【VUL-04~09】输入校验、审计日志、错误处理、事务处理、限流、前端会话：6 项中危漏洞需整改。 | 详见[安全审查报告](../security/flowchart-collaboration-security-review.md)第三、四、五章（10-15h）。 | **发布阻塞** |
| 2026-04-15 | 安全审查 | 本轮复审完成：VUL-01/02/03 已关闭；VUL-05/07/08 未关闭，且新增 VUL-13（生产会话 localStorage 风险）；VUL-10/11/12 仍待发布前确认。 | 先完成中危阻塞项整改与验证，再进行安全复核和放行评估。 | **发布阻塞** |
| 2026-04-15 | 后端实现 | 已完成当前内存架构下 VUL-05/07/08 代码整改：新增 OWNER 审计查询接口、基础内存限流、submit 暂存后统一提交并失败回滚。 | 交由 QA 复测 429/权限链路，并由安全审查师复核剩余风险。 | 处理中 |
| 2026-04-15 | 安全审查 | 已完成二次复审：VUL-05 关闭，VUL-07/08 降级为架构残余风险；VUL-13 与 VUL-10/11/12 仍阻塞发布。 | CORS/HSTS 已配置，依赖 CVE 已修复。 | 已解除 |
| 2026-04-15 | QA 验证 | 上传失败场景存在重复错误提示（拦截器与组件层重复 toast），影响交互一致性与排障体验。 | 前端统一错误提示归口，避免同一失败事件重复提示。 | 已解除 |
| 2026-04-15 | QA 验证 | 文档上传 MIME 选项与后端校验白名单不一致（前端可选 Excel/other，后端拒绝）。 | 对齐前后端 MIME 枚举，避免“可选即失败”场景。 | 已解除 |
| 2026-04-15 | QA 验证 | 二次复判确认 QA-20260415-01 仅部分收敛：HTTP 失败已归口，但未登录写操作仍会出现“获取开发令牌”警告与组件层失败提示双提示。 | 统一处理 AUTH_TOKEN_REQUIRED 预检失败分支，确保上传失败场景仅提示一次。 | 已解除 |
| 2026-04-15 | QA 验证 | 关键运行时联调证据仍缺失：401/403、429、上传绑定与前端关键交互尚无真实执行留档。 | 按 README 与 QA 报告回归计划完成联调，并补充返回报文/截图/录屏证据。 | 未解除 |
| 2026-04-15 | 发布准备 | 已完成发布准备文档与灰度演练记录（桌面推演），但 QA/安全门禁未通过，发布申请阻塞。 | 关闭 QA 与安全阻塞项并补齐证据后重新评估放行。 | 未解除 |
| 2026-04-16 | QA 验证 | 运行时联调证据仍缺失，需在真实部署环境执行 README 中 curl 场景 A-F 并回填证据。 | 在真实部署环境补齐 A-F 场景回包与截图/录屏，更新 QA 报告后重提门禁。 | 未解除 |

## 实现摘要

### 前端（2026-04-15）

- 完成 Bearer token 鉴权链路切换：前端 API 客户端移除 `x-user-id`，统一按 `Authorization: Bearer <token>` 注入；写接口未登录时前置拦截并给出令牌获取引导。
- 新增最小登录流程：导航栏增加开发态令牌入口，支持输入 `userId` 调用 `POST /api/v1/auth/token` 获取 JWT，并支持更换/清除本地令牌。
- 上传契约对齐后端：继续仅提交 `name/mimeType/size`，不再存在 `storageKey` 客户端输入；上传/绑定失败补充可读原因提示并支持重试。
- 完成真实流程图编辑器改造（FlowCanvas）：提供“执行模式/编辑模式”隔离，编辑模式支持新增节点、删除节点、拖拽移动、发起连线与保存流程草稿；保存时同步 `graphJson`、`nodesConfig` 与 `predecessorNodeIds`，并尽量保留既有节点配置。
- 修复关键 bug/体验问题（>=2）：
	- 修复工作台重复触发创建导致并发提交问题（按钮与弹窗确认态联动禁用）。
	- 修复项目页节点选中状态与数据刷新不同步问题（执行列表刷新后自动校正/关闭无效抽屉）。
	- 增加未登录空态引导，降低 401/拦截场景的操作迷惑。
- 做小幅性能优化：流程画布拓扑排序与映射构建改为 `useMemo`，减少重复计算与不必要重渲染。
- 完成交接：to_qa（回归验证 Bearer 链路与核心闭环）、to_security（会话存储与鉴权链路复审）、to_docs（补充用户侧“获取开发令牌”操作说明）。

### 后端（2026-04-15）

- 完成 JWT Bearer 基础鉴权：新增 `POST /api/v1/auth/token`（开发签发测试 token），全局守卫校验 `Authorization: Bearer <token>`，并移除 `x-user-id` 信任链。
- 完成项目级访问控制：新增 `ProjectAccessGuard`（`projectId` 维度）与 `ExecutionAccessGuard`（`executionId -> projectId` 维度）；当前基线策略为 owner/member 可访问。
- 修复上传路径遍历风险：`CreateDocumentDto` 移除 `storageKey` 入参；服务端生成 `storageKey`，新增文件名净化工具，禁止路径注入与遍历。
- 增强输入校验：重点强化 `CreateDocumentDto`、`CreateProjectDto`、`UpdateFlowDraftDto`、`BindArtifactDto`，增加长度、白名单、数组上限、URL 规则等约束。
- 新增审计查询能力：落地 `GET /api/v1/projects/:projectId/audit-logs`，支持 `resourceType/resourceId` 可选过滤；仅项目 OWNER 可访问，返回请求追踪与操作主体字段。
- 新增基础限流：实现最小内存限流守卫并挂载到 `POST /auth/token`、`POST /projects`、`POST /projects/:projectId/documents`、`POST /executions/:executionId/start|submit|artifacts/bind`，超限返回 `429 RATE_LIMITED`。
- 缓解 submit 一致性风险：`submit()` 改为“先计算/暂存，再统一提交”，若门禁、后继解锁、通知、审计任一步骤异常，则回滚 execution、后继节点更新和内存队列写入，避免 execution 长时间停留在 `GATE_CHECKING` 或出现半更新。
- 更新最小可运行说明：`apps/api/README.md` 切换为 JWT 调用示例并补充 401/403 验证步骤。

## 版本历史

| 日期 | 版本 | 角色 | 变更摘要 | 备注 |
|---|---|---|---|---|
| 2026-04-14 | v0.1 | 文档撰写员 | 追加初始化记录：新建 Context Doc，写入元信息、阶段状态、质量门禁、阻塞与风险基线。 | 初始化 |
| 2026-04-14 | v0.2 | 架构设计师 | 回写架构阶段：新增架构约束，更新架构边界为完成，补充架构门禁结论与产出链接。 | to_architecture 第一步 |
| 2026-04-14 | v0.3 | 后端专家 | 回写后端实现阶段：创建 apps/api 工程骨架，实现 9 条核心 API、状态机、门禁引擎、审计日志；更新后端状态为✅；补充风险记录（鉴权/事务未完成）。 | MVP 后端骨架完成 |
| 2026-04-14 | v0.4 | 前端专家 | 回写前端实现阶段：创建 apps/web 工程，实现工作台页面、流程画布、节点详情抽屉、门禁结果面板、文档上传绑定弹窗；接入全部后端 API；提供演示项目一键创建；更新前端状态为✅；补充前端风险记录。 | MVP 前端骨架完成 |
| 2026-04-14 | v0.5 | QA 专家 | 回写 QA 验证阶段：设计 9 条核心用例（TC-1~TC-9），覆盖创建项目、状态机、门禁失败与补齐重试、前端缺项提示；通过代码审查得出结论：功能✅通过，发布❌阻塞（P0 缺陷：无 JWT 鉴权、非事务、无持久化）；给出回归计划与后续迭代建议。 | QA 验证完成 |
| 2026-04-14 | v0.6 | 文档撰写员 | 文档沉淀阶段完成：输出[用户操作指南](../user-docs/flowchart-collaboration-user-guide.md)（产品简介、快速开始、演示流程、常见问题、已知限制）+ [维护运维手册](../ops/flowchart-collaboration-maintenance-runbook.md)（启停步骤、日志排障、风险回滚、上线清单）；更新文档沉淀状态为✅完成；发布阻塞项保持未解除状态（待安全审查与生产准备阶段处理）。 | 文档沉淀完成，交接发布准备 |
| 2026-04-14 | v0.7 | 安全审查师 | 完成 MVP 基线安全审查：发现 12 项风险（3 高危 VUL-01/02/03、6 中危 VUL-04/05/06/07/08/09、3 低危 VUL-10/11/12），产出[安全审查报告](../security/flowchart-collaboration-security-review.md)；发布意见 ❌ 未通过（9 项 P0 漏洞需整改 14-23 小时）；更新安全门禁为❌未通过、发布门禁为❌未通过；在阻塞与风险记录中补充 4 条安全阻塞项。 | 安全审查完成，交接后端/前端/项目协调 |
| 2026-04-15 | v0.8 | 后端专家 | 完成 API 发布阻塞项后端整改：JWT 鉴权替代 x-user-id、项目级访问守卫、上传 storageKey 服务端生成与文件名净化、关键 DTO 校验加固；回写最小运行验证说明。 | 交接 to_qa / to_security / to_docs |
| 2026-04-15 | v0.9 | 前端专家 | 完成后端安全改造前端配套联调：Bearer token 鉴权链路、开发态令牌获取流程、上传失败可读错误、重复提交与状态同步修复、流程画布 memo 优化；回写交接 to_qa / to_security / to_docs。 | 待 QA 回归与安全复审 |
| 2026-04-15 | v1.0 | QA 专家 | 完成本轮前后端改动回归验证（代码审查+静态检查），更新 QA 报告与门禁结论：发现 1 中 1 低缺陷，且缺少运行时联调证据，QA 门禁❌未通过；补充两条 QA 风险记录。 | 回传项目总协调，待修复后复测 |
| 2026-04-15 | v1.1 | 安全审查师 | 完成本轮安全复审：确认 VUL-01/02/03 已关闭；更新剩余中低危阻塞项与新增 VUL-13；回写安全门禁/发布门禁均为❌。 | 回传项目总协调，等待整改后复审 |
| 2026-04-15 | v1.2 | 发布经理 | 产出发布准备与灰度演练记录 [v0.1.0-release-note](../releases/v0.1.0-release-note.md)；回写发布准备阶段为❌阻塞，明确上线/回滚清单、值守安排、观察指标与风险解除条件。 | 待 QA/安全门禁通过后重提发布申请 |
| 2026-04-15 | v1.3 | 后端专家 | 完成当前架构下可修复的中危后端整改：新增 OWNER 审计查询接口、指定写接口基础限流、submit 统一提交与失败回滚；同步更新实现摘要、风险记录与后端总结。 | 待 QA 复测与安全复核 |
| 2026-04-15 | v1.4 | QA 专家 | 完成二次 QA 复判：确认 QA-20260415-02 已修复，QA-20260415-01 未完全修复，且运行时联调证据仍缺失；回写 QA 门禁继续❌并补充交接 to_security / to_docs。 | 回传项目总协调，待修复与联调证据补齐后再次复判 |
| 2026-04-15 | v1.5 | 安全审查师 | 完成二次安全复审：VUL-05 关闭，VUL-07/08 降级为残余风险；VUL-13 与 VUL-10/11/12 仍阻塞发布；同步更新安全门禁与风险记录。 | 回传项目总协调，建议交接 to_docs，同步发布/运维文档中的安全阻塞项 |
| 2026-04-15 | v1.6 | QA 专家 | 对本轮最新代码完成二次 QA 复判（仅代码审查+静态检查）：QA-20260415-01 未修复、QA-20260415-02 已修复、无新增阻塞级问题；运行时联调证据仍缺失，QA 门禁维持❌。 | 回传项目总协调，待补齐运行时联调证据并修复双提示后再复判 |
| 2026-04-15 | v1.7 | QA 专家 | 对本轮最新代码执行最小复判（仅代码审查+静态检查）：QA-20260415-01 与 QA-20260415-02 均已修复；运行时联调证据仍缺失，QA 门禁维持❌。 | 回传项目总协调，待补齐运行时联调证据后再复判 |
| 2026-04-15 | v1.8 | 文档撰写员 | 同步发布准备口径：更新发布准备阶段备注为“QA 仅剩运行时联调证据缺失，安全阻塞为 VUL-13 + VUL-10/11/12 发布前确认项”。 | 回传项目总协调，用于发布文档与待办清单一致性维护 |
| 2026-04-16 | v1.9 | 文档撰写员 | 同步第三轮安全复审与 QA 结论：安全门禁更新为✅通过（v0.5），发布门禁保留❌（仅阻塞运行时联调证据）；并更新阻塞记录口径。 | 回传项目总协调，用于发布申请重评估前的状态对齐 |
| 2026-04-16 | v2.0 | 前端专家 | 完成前端真实可编辑流程画布改造：ProjectPage 新增执行/编辑双模式，支持新增/删除节点、拖拽、连线与保存草稿；回写前端阶段状态、实现摘要与风险解除记录。 | 交接 to_qa / to_security / to_docs |
| 2026-04-16 | v2.1 | QA 专家 | 完成前端流程图编辑器专项回归：覆盖可视化画布、编辑能力、保存一致性、执行态抽屉兼容、前端类型检查；确认本次改动无新增阻塞级缺陷，项目整体阻塞项仍为历史遗留“运行时联调证据缺失”。 | 回传项目总协调，待补齐运行时联调证据后复核 QA 门禁 |
| 2026-04-16 | v2.2 | 文档撰写员 | 同步前端“流程图编辑器已实现”文档：更新用户指南中的流程画布与编辑模式操作、修订已知限制为轻量真实画布口径，并修复前端实现总结新增节 Markdown 规范问题（表格分隔行空格、硬 tab/列表缩进）。 | 回传项目总协调，用于文档与当前代码一致性维护 |
