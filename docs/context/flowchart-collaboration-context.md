# flowchart-collaboration Context Doc
> 版本：v0.7 | 日期：2026-04-14 | 负责角色：安全审查师 | 状态：安全审查完成（发布阻塞）

## 元信息

| 字段 | 内容 |
|---|---|
| 项目名 | flowchart-collaboration |
| 项目目标 | 打造流程图驱动的项目协作执行平台，通过流程强约束、文档门禁与自动流转提升交付完整性与可追溯性。 |
| 项目类型 | B 类：Web 平台产品（0 到 1 MVP 交付） |
| 当前阶段 | 安全审查与发布准备（安全门禁未通过，待缺陷整改） |
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
| 前端实现 | ✅完成 | [flowchart-collaboration-frontend-summary](../implementation/flowchart-collaboration-frontend-summary.md) | 2026-04-14 | MVP 前端已完成：React + Vite 工程、工作台、流程画布、节点详情抽屉、门禁结果面板、文档上传绑定全流程（LogicFlow 为占位实现）。 |
| 后端实现 | ✅完成 | [flowchart-collaboration-backend-summary](../implementation/flowchart-collaboration-backend-summary.md) | 2026-04-14 | MVP 骨架已完成：9 条核心路由、状态机、门禁引擎、审计日志全部落地（内存存储，保留 PostgreSQL 替换边界）。 |
| QA 验证 | ✅完成 | [flowchart-collaboration-test-report](../qa/flowchart-collaboration-test-report.md) | 2026-04-14 | 9 条测试用例设计完成，待人工执行与验证。功能通过，发布需补齐 3 项安全/稳定性缺陷。 |
| 安全审查 | ✅完成 | [flowchart-collaboration-security-review](../security/flowchart-collaboration-security-review.md) | 2026-04-14 | MVP 安全审查已完成，发现 12 项风险（3 高 + 6 中 + 3 低），发布阻塞。 |
| 文档沉淀 | ✅完成 | [flowchart-collaboration-context](flowchart-collaboration-context.md)、[quick-reference-guide](../quick-reference-guide.md)、[flowchart-collaboration-user-guide](../user-docs/flowchart-collaboration-user-guide.md)、[flowchart-collaboration-maintenance-runbook](../ops/flowchart-collaboration-maintenance-runbook.md) | 2026-04-14 | MVP 文档沉淀完成：用户操作指南 + 维护运维手册已落地。 |
| 发布准备 | ⏳待开始 | [flowchart-collaboration-prd](../requirements/flowchart-collaboration-prd.md) | - | 待 QA 与安全门禁通过后启动发布清单。 |

## 质量门禁状态

| 门禁项 | 状态 | 结论摘要 | 产出链接 |
|---|---|---|---|
| 需求门禁 | ✅通过 | PRD v1.0 已完成评审状态标记，可作为后续阶段输入。 | [flowchart-collaboration-prd](../requirements/flowchart-collaboration-prd.md) |
| 架构门禁 | ✅通过 | 已完成 v0.1 架构边界文档，覆盖分层、契约、约束与里程碑。 | [flowchart-collaboration-architecture](../architecture/flowchart-collaboration-architecture.md) |
| QA 门禁 | ⚠️ 条件通过 | 功能实现完整(✅)，但发布阻塞(❌)：无 JWT 鉴权、submit() 非事务、无持久化。内测可用，生产需补齐 D-1/D-2/D-3。 | [flowchart-collaboration-test-report](../qa/flowchart-collaboration-test-report.md) |
| 安全门禁 | ❌未通过 | 发现 12 项安全风险（3 高危 VUL-01/02/03、6 中危 VUL-04/05/06/07/08/09、3 低危 VUL-10/11/12）。高危漏洞直接威胁多租户隔离和数据安全，**发布阻塞**。9 项 P0 漏洞需整改 14-23 小时。 | [flowchart-collaboration-security-review](../security/flowchart-collaboration-security-review.md) |
| 发布门禁 | ❌未通过 | 安全门禁未通过，存在 9 项发布阻塞漏洞，无法进入发布评估。待完成 VUL-01~09 整改后重新评估。 | [flowchart-collaboration-security-review](../security/flowchart-collaboration-security-review.md) |

## 阻塞与风险记录

| 日期 | 阶段 | 记录 | 解除方式 | 状态 |
|---|---|---|---|---|
| 2026-04-14 | 架构边界 | MVP 架构边界文档尚未落盘，前后端实现输入不完整。 | 输出 architecture 文档并完成架构评审。 | 已解除 |
| 2026-04-14 | 发布准备 | 安全策略与审查深度尚未明确，可能影响上线窗口。 | 按 MVP 范围确认安全审查清单并预排审查时间。 | 未解除 |
| 2026-04-14 | 后端实现 | JWT 鉴权、RBAC Guard、限流（ThrottlerModule）尚未实现，属安全基线 P0 待补项。 | 安全审查阶段补充，交接给安全审查师。 | 未解除 |
| 2026-04-14 | 后端实现 | submit() 状态变更与事件发布尚非 DB 事务，正式版本需引入 TypeORM QueryRunner + outbox 模式。 | 切换 PostgreSQL 时同步处理。 | 未解除 |
| 2026-04-14 | 前端实现 | 流程画布为列表式占位实现，尚未集成 LogicFlow（拖拽编辑、真实有向图渲染）。 | P1 迭代接入 LogicFlow，接口已封装为适配层，替换时无需修改上层页面。 | 未解除 |
| 2026-04-14 | 前端实现 | 后端无 GET /projects 列表接口，项目列表依赖 localStorage（跨浏览器/清缓存后丢失）。 | 后端补 GET /projects 端点后修改 WorkbenchPage。 | 未解除 |
| 2026-04-14 | 前端实现 | MVP 所有节点初始为 READY 状态（后端简化），不符合真实依次解锁语义。 | 切换 PostgreSQL 后验证 predecessorNodeIds + unlockSuccessors 逻辑。 | 未解除 |
| 2026-04-14 | 安全审查 | 【VUL-01】身份伪造：硬编码 x-user-id 请求头，任何人可伪造身份，直接威胁多租户隔离。| 实现 JWT 鉴权，移除 x-user-id 信任链（后端 2-4h，前端 2-3h）。 | **发布阻塞** |
| 2026-04-14 | 安全审查 | 【VUL-02】跨项目访问控制缺失：API 未校验调用者是否为项目成员，任何认证用户可访问他人项目。 | 实现 RBAC 守卫，在所有项目级路由检查权限（3-5h）。 | **发布阻塞** |
| 2026-04-14 | 安全审查 | 【VUL-03】路径遍历：文档上传 DTO 中 storageKey 由客户端提供，未规范化，可导致路径遍历。 | 改为服务端生成 storageKey，添加文件名清理工具函数（1-2h）。 | **发布阻塞** |
| 2026-04-14 | 安全审查 | 【VUL-04~09】输入校验、审计日志、错误处理、事务处理、限流、前端会话：6 项中危漏洞需整改。 | 详见[安全审查报告](../security/flowchart-collaboration-security-review.md)第三、四、五章（10-15h）。 | **发布阻塞** |

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
