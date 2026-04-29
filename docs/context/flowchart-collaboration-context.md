# flowchart-collaboration Context Doc

> 版本：v2.9 | 日期：2026-04-29 | 负责角色：前端专家 | 状态：前端全面改造完成（对接后端第二轮改造）：新增团队管理 Drawer（AppLayout 头部）、多标签流程图画布（MainWorkspace 重构）、NodeDetailPanel 三分区重构（节点信息/审核上一节点/当前节点操作）、ProjectListPanel 支持展开流程图列表 + 项目删除、API 层对接 Teams/Flowcharts/approve/reject 接口、REJECTED 状态完整支持、权限检查（仅参与者可打开节点面板），TypeScript 零错误。

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
| 前端实现 | ✅完成 | [flowchart-collaboration-frontend-summary](../implementation/flowchart-collaboration-frontend-summary.md) | 2026-04-29 | **第二轮前端全面改造**（对接后端 v2.8 改造）：① 新增 TeamManagement Drawer（AppLayout 头部触发）；② MainWorkspace 重构为多标签模式（openedFlowcharts + Tabs）；③ NodeDetailPanel 改为三分区（节点信息 / 审核上一节点产物 / 当前节点操作），支持审核通过/拒绝及 REJECTED 状态 Alert；④ ProjectListPanel 支持展开项目查看流程图列表、删除项目（OWNER 权限）、创建项目时绑定团队（必填）+ 可选同步创建流程图；⑤ API 层新增 teams.ts、flowcharts.ts，executions.ts 新增 approve/reject，projects.ts 新增 deleteProject；⑥ 权限检查：仅 assignees 中的用户点击节点可打开面板；⑦ TypeScript 零错误。 |
| 后端实现 | ✅完成 | [flowchart-collaboration-backend-summary](../implementation/flowchart-collaboration-backend-summary.md) | 2026-04-28 | 完成第二轮后端全面改造（依据《一些定义和逻辑描述.md》）：新增 TeamsModule（CRUD + 成员管理）、FlowchartsModule（含子流程图）；Project 实体新增 teamId 绑定；NodeConfig.type 规范化为联合类型；NodeExecution 新增 flowchartId/rejectionReason/reviewResult；ExecutionStatus 新增 REJECTED；新增审核/回退接口 approve/reject；ID 格式规范化（generateId 工具）；TypeScript 编译零错误。 |
| QA 验证 | ✅完成 | [flowchart-collaboration-test-report](../qa/flowchart-collaboration-test-report.md) | 2026-04-16 | 已完成前端流程图编辑器专项回归 + UI 美化专项回归（v0.9）：本次美化改动未发现新增阻塞级缺陷（P1×1 孤立文件，P2×2 体验小问题）；但运行时联调证据仍未补齐，QA 门禁❌。 |
| 安全审查 | ✅完成 | [flowchart-collaboration-security-review](../security/flowchart-collaboration-security-review.md) | 2026-04-16 | 第三轮复审完成：VUL-10/11/12/13 全部关闭，安全门禁通过（v0.5）。 |
| 文档沉淀 | ✅完成 | [flowchart-collaboration-context](flowchart-collaboration-context.md)、[quick-reference-guide](../quick-reference-guide.md)、[flowchart-collaboration-user-guide](../user-docs/flowchart-collaboration-user-guide.md)、[flowchart-collaboration-maintenance-runbook](../ops/flowchart-collaboration-maintenance-runbook.md) | 2026-04-14 | MVP 文档沉淀完成：用户操作指南 + 维护运维手册已落地；2026-04-16 已同步真实流程画布与编辑模式说明。 |
| 发布准备 | ❌阻塞 | [v0.1.0-release-note](../releases/v0.1.0-release-note.md) | 2026-04-15 | 已形成上线/回滚清单与灰度演练记录；安全门禁已通过（v0.5），当前仅阻塞项为 QA 运行时联调证据缺失。 |

## 质量门禁状态

| 门禁项 | 状态 | 结论摘要 | 产出链接 |
|---|---|---|---|
| 需求门禁 | ✅通过 | PRD v1.0 已完成评审状态标记，可作为后续阶段输入。 | [flowchart-collaboration-prd](../requirements/flowchart-collaboration-prd.md) |
| 架构门禁 | ✅通过 | 已完成 v0.1 架构边界文档，覆盖分层、契约、约束与里程碑。 | [flowchart-collaboration-architecture](../architecture/flowchart-collaboration-architecture.md) |
| QA 门禁 | ❌未通过 | 本轮前端流程图编辑器回归 + UI 美化专项回归（v0.9）均确认：可视化画布、编辑能力、保存一致性、执行态面板兼容、TypeScript 零错误、draggingNodeId 清理完整、令牌 Dropdown 逻辑正确、贝塞尔曲线无 NaN 风险、CSS 类名一致；未发现新增阻塞级缺陷（P1×1 为孤立文件，P2×2 为体验小问题）；项目整体仍缺运行时联调证据，暂不满足放行条件。 | [flowchart-collaboration-test-report](../qa/flowchart-collaboration-test-report.md) |
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
| 2026-04-14 | 前端实现 | 后端无 GET /projects 列表接口，项目列表依赖 localStorage（跨浏览器/清缓存后丢失）。 | 后端补 GET /projects 端点后修改 WorkbenchPage。 | 已解除 |
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
| 2026-04-28 | 后端实现 | 新增 Team/Flowchart 模块，Project 绑定 teamId，NodeConfig.type 规范化，新增 REJECTED 状态与审核/回退接口。TypeScript 编译零错误。 | 前端需同步更新 POST /projects 传 teamId、对接 teams/flowcharts 新接口、适配新 ExecutionStatus.REJECTED；由 QA 回归核心流程。 | 未解除（待前端对接） |

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
### 前端（2026-04-16 三栏布局改造）

- 整体布局改造为三栏全屏：左侧项目列表面板（240px，可折叠） + 中间全屏画布 + 右侧节点详情面板（360px，选中节点时显示）。
- 新增 `ProjectListPanel` 组件：调用新 `GET /api/v1/projects` 接口获取项目列表，按"我负责的 / 我参与的"分大类，再按"未开始 / 进行中 / 已完成"进度状态分子类；未登录时从 localStorage 降级读取。
- 新增 `NodeDetailPanel` 组件：将原 `NodeDetailDrawer`（Drawer 抽屉）改造为右侧固定面板，保持全部原有功能（节点信息、开始执行、提交、门禁结果、文档绑定）。
- FlowCanvas 全屏画布改造：画布铺满中间区域、支持拖动平移（Pan）、点阵网格背景跟随移动、transform 变换层统一管理节点和连线偏移。
- 双击画布空白区域新增节点：弹出 Modal 表单填写节点名称、描述、输出物要求列表（可动态增减行），确认后在逻辑坐标位置创建节点。
- 编辑模式 OWNER 限定：仅当前用户 role === 'OWNER' 时显示"编辑模式"切换按钮。
- 路由简化：移除 `/projects/:projectId` 路由，主页面直接渲染三栏布局，项目切换通过左侧面板完成。
- 新增 `MainWorkspace` 页面组件：统一编排三栏布局与数据流。

### 前端（2026-04-17 模式切换 UX 优化）

- 优化 FlowCanvas 工具栏：将编辑/执行模式切换 Segmented 提取为工具栏左侧固定区域，消除两份重复代码（原编辑工具栏 + 查看工具栏各一份 → 合并为统一工具栏一份）。
- 移除冗余 Tag 标签（"✏️ 编辑模式" / "👁️ 执行模式"），模式已由 Segmented 选中态充分表达。
- 编辑模式工具栏增加暖色调视觉反馈（极浅橙色渐变背景 + 金色底边），执行模式保持冷色调（默认蓝灰 + 靛蓝底边），一眼可区分当前模式。
- 工具栏内容切换添加 CSS 进场动画（opacity + translateY 0.3s ease），避免突然切换的生硬感。
- 操作提示文字移至工具栏最右侧、降低视觉权重（opacity 0.65 + 小字号），保留功能但不喧宾夺主。
- 涉及文件：`apps/web/src/components/FlowCanvas/index.tsx`（工具栏 JSX 重构）、`apps/web/src/index.css`（新增 toolbar 子类样式与动画）。
- 不改后端 API、不改 MainWorkspace 状态管理逻辑、不改 FlowCanvas props 接口、原有按钮功能完全保留。

### 前端（2026-04-17 特殊节点形状样式修复）

- 修复 CSS 缺失类名导致起始/终止/多人圆形节点渲染为普通矩形的问题。
- 新增 `.real-flow-node--start` 样式：`border-radius: 50%` 椭圆形（160×72px）、绿色系渐变背景、flex 居中、隐藏左侧色条（`::before { display: none }`）。
- 新增 `.real-flow-node--end` 样式：`border-radius: 50%` 圆形（80×80px）、红色系渐变背景、`box-shadow: inset` 同心圆效果、3px 边框、隐藏左侧色条。
- 新增 `.real-flow-node--end-completed` 样式：完成态绿色系配色覆盖（边框 + 阴影 + 背景渐变）。
- 新增 `.real-flow-node--circle` 样式：`border-radius: 50%` 圆形（100px）、flex 居中、隐藏左侧色条；状态色类在圆形节点上继续生效。
- 涉及文件：`apps/web/src/index.css`（仅 CSS，未修改 TSX）。
- 不改后端 API、不改 TSX 代码。

### 前端（2026-04-17 拖拽终止节点空指针修复）

- 修复 `FlowCanvas` 的拖拽竞态问题：`handleMouseMove` 进入拖拽分支时先快照 `draggingRef.current` 到局部常量（`dragState`），并解构出 `dragNodeId/offsetX/offsetY/nodeWidth/nodeHeight`。
- `setNodes((prev) => prev.map(...))` 回调内不再访问 `draggingRef.current`，彻底移除 `draggingRef.current!.nodeId` 非空断言读取，避免 `mouseup` 清空 ref 后异步回调触发空指针。
- 保持既有行为不变：节点拖拽移动、拖拽插入候选边检测、START/END 禁止插入规则均保持原逻辑。

### 前端（2026-04-17 FlowCanvas 拖拽压力测试补强）

- 新增最小测试基础设施：`apps/web/package.json` 增加 `test` 脚本与 `vitest/@testing-library/react/@testing-library/jest-dom/jsdom` 开发依赖。
- 新增 Vite 测试配置：`apps/web/vite.config.ts` 增加 `test.environment = jsdom` 与 `setupFiles`，测试初始化入口指向 `src/test/setup.ts`。
- 新增 `apps/web/src/test/setup.ts`：补齐 `matchMedia` 与 `ResizeObserver` 的 jsdom 兼容 mock，降低组件测试环境差异。
- 新增回归用例 `apps/web/src/components/FlowCanvas/index.test.tsx`：在编辑模式下模拟 END 节点“连续 mousemove + mouseup + 后续 mousemove”的压力序列，断言交互不抛异常且 END 节点仍在文档中，覆盖拖拽竞态回归场景。

### 前端（2026-04-17 项目面板底部操作区改造）

- 按需求将项目侧栏操作统一下沉到 `ProjectListPanel` 底部：`新建`、`快速体验`、`开启编辑模式` 同区展示，顶部仅保留折叠按钮，操作入口更稳定且符合单手操作路径。
- 将模式切换从 `FlowCanvas` 工具栏 `Segmented` 改为单开关 `Switch`，文案固定为“开启编辑模式”，并通过 `MainWorkspace` 统一驱动画布 `view/edit` 状态。
- 保持既有权限约束：非 OWNER 仍不可切换编辑态（开关可见但禁用，提示“仅项目负责人可切换编辑模式”），未改动后端 API 与鉴权链路。
- 同步样式增强：新增侧栏底部操作区样式（分组按钮 + 开关行），并在小屏下将项目面板改为左侧悬浮抽屉式宽面板，避免底部操作区被压缩导致不可用。
- 清理 FlowCanvas 冗余模式控件：移除内部模式切换 UI，仅保留刷新与编辑操作按钮，避免同一能力出现多入口造成认知冲突。

### 前端（2026-04-17 模式切换与操作区位置修正）

- 文案统一：将模式开关文案从“开启编辑模式”调整为“编辑模式”，减少动作导向措辞，和执行态语义更对齐。
- 操作区迁移：在 `FlowCanvas` 实现画布底部统一操作区，将“编辑模式开关 + 删除 + 连线 + 保存草稿 + 添加终止节点 + 刷新”合并同区展示，确保位于画布区域最下方。
- 入口收敛：从 `ProjectListPanel` 移除模式开关，避免左栏与画布双入口造成认知冲突。
- 侧栏按钮对齐：将左侧项目栏折叠按钮调整到头部最右侧并保持垂直居中，修正视觉偏移。
- 权限约束保持不变：非 OWNER 用户仍可见但不可用模式开关（提示“仅项目负责人可切换编辑模式”），未修改后端 API。
- 最小验证：对 `FlowCanvas`、`ProjectListPanel`、`MainWorkspace` 三个 TS 文件执行诊断检查，结果均为零报错。
- 涉及文件：`apps/web/src/components/FlowCanvas/index.tsx`、`apps/web/src/components/ProjectListPanel/index.tsx`、`apps/web/src/pages/MainWorkspace.tsx`、`apps/web/src/index.css`。
- 完成交接：to_qa（回归验证底部操作区位置、模式切换权限、左栏折叠按钮对齐与交互一致性）。

### 前端（2026-04-16 流程画布核心功能增强）

- 子流程按钮与并行分支：编辑模式下 TASK 节点（矩形及多人圆形）hover 时右侧显示"+"按钮（22px 圆形），点击弹出 Dropdown 菜单可选"向上/向下添加子流程"；子流程节点自动创建在主流程节点左侧偏移 -250px 位置并自动建立连线关系。
- 智能删除节点（自动重连）：删除节点时自动计算所有前驱和后继，生成 predecessor→successor 补偿边后再删除节点及关联边（如 A→B→C 删 B 后自动变为 A→C）；START/END 节点保护逻辑不变。
- 拖拽插入节点到两节点之间：拖拽节点时实时检测被拖拽节点中心与各条连线中点的距离（阈值 60px），命中时连线高亮（`flow-edge-insert-highlight`）并显示"释放插入"提示标签；释放时自动删除原边、创建两条新边并将被拖拽节点吸附到连线中点位置。
- 新增 CSS 类：`.subprocess-add-btn`（子流程按钮样式与 hover 过渡）、`.flow-edge-insert-highlight`（拖拽插入连线高亮）、`.insert-hint-label`（释放插入浮动标签）。
- TypeScript 零编译错误；不涉及后端 API 变更或 types.ts 接口修改。

### 前端（2026-04-16 节点类型系统）

- 类型定义扩展：`GraphNode` 新增 `type?: NodeType`，`NodeConfig` 和 `UpdateFlowDraftDto` 新增 `nodeType?: NodeType`，导出 `NodeType = 'START' | 'END' | 'TASK'` 类型别名。
- 起始节点（START）：椭圆形渲染（160×72px，border-radius: 50%），紫色渐变背景，居中显示节点名 + "🚀 起始"标签 + 已就绪资料数量；创建弹窗标题改为"创建起始节点"，表单区域标记为"已就绪资料"。
- 终止节点（END）：同心圆渲染（外圆 100px，内圆通过 `::after` 伪元素实现双圈效果）；未完成状态灰色虚线 + 半透明内圈，已完成状态绿色实线 + 绿色填充 + 脉冲动画。
- 节点创建约束：流程首个节点强制为 START 类型（`nodes.length === 0` 时自动锁定）；工具栏新增"添加终止节点"按钮（仅无 END 节点时显示），点击后在画布最下方节点下方 150px 自动创建。
- 流程图保存门禁：`handleSave` 保存前校验必须同时包含 START 和 END 节点；START 入边 = 0、出边 = 1；END 出边 = 0、入边 ≥ 1；校验失败 `message.warning()` 给出具体原因。
- 连线碰撞适配：新增 `getEllipseEdgePoint` 函数用于椭圆碰撞计算，新增 `getNodeShape` 统一获取节点尺寸与形状类型（ellipse/circle/rect），所有边渲染按节点类型选择对应碰撞函数。
- 节点保护：START/END 节点禁止删除（点击删除时 `message.warning` 提示），不参与多人圆形判定。
- TypeScript 零编译错误，不涉及后端 API 或数据库变更。

### 前端（2026-04-16 多人节点圆形渲染与分叉连线）

- 多人节点判定：当 `nodeConfigMap.get(nodeId)?.assignees?.length > 1` 时判定为"多人节点"，渲染为直径 120px 正圆（`.real-flow-node--circle`），其余节点保持原有 180×96 矩形。
- 圆形节点内容：居中紧凑显示状态 Emoji、节点名（溢出省略）、状态标签、多人标识（👥 N人）。
- 分叉连线效果：多人节点出边从圆底部出发 / 入边从圆顶部进入，多条连线汇聚或发散于同一锚点形成并行网关分叉视觉；圆→圆连线使用通用半径交点。
- 连线计算适配：新增 `getCircleEdgePoint()` 函数，按圆心→目标方向计算半径交点；矩形→矩形保持原有 `getEdgePoint()` 逻辑不变。
- CSS 新增 `.real-flow-node--circle` 样式类：`border-radius: 50%`、flex 居中、隐藏左侧色条；状态色类（PENDING/READY/IN_PROGRESS 等）在圆形节点上同样生效。
- 拖拽兼容：圆形节点 left/top = 逻辑坐标（与矩形统一），宽高改为 CIRCLE_DIAMETER；居中按钮计算同步适配。
- 编辑模式兼容：选中高亮（shadow-glow）、删除、连线操作对圆形节点同样生效。
- TypeScript 零编译错误。
- 完成交接：to_qa（回归验证多人圆形节点渲染、分叉连线、拖拽与编辑模式交互）。

### 前端（2026-04-16 UI 全面美化）

- 全局视觉升级：引入 CSS 变量体系（`--color-*`、`--shadow-*`、`--radius-*`、`--transition-*`），统一配色、阴影、圆角与过渡动画。
- 顶部导航栏美化：使用 `backdrop-filter` 毛玻璃效果 + 顶部渐变品牌装饰条；品牌 Logo 渐变文字；登录入口改为头像/Dropdown 下拉式交互。
- 左侧项目面板升级：项目卡片悬停 `translateX` 微动效 + 选中态渐变背景；分类标题增加角色图标（👑 负责 / 👥 参与）和子分类图标（⚡ 进行中等）；空态使用自定义引导图文。
- 流程画布美化：连线从直线升级为贝塞尔曲线（`<path>` + cubic bezier）；活跃连线添加 `stroke-dasharray` 流动动画；网格背景降低对比度；编辑/执行工具栏分隔符 + 圆角标签更像专业画布工具。
- 节点卡片增强：`::before` 左侧状态色条指示器；拖拽中增加 `real-flow-node--dragging` 状态（放大 + 阴影增强 + 层级提升）；悬停 `translateY(-1px)` 浮起效果；状态 Emoji 前缀图标。
- 右侧详情面板优化：`slideInRight` 动画 + 左侧阴影；输出物缺失项改为渐变红色卡片 + 左侧色条（`artifact-item-missing`）；已绑定项改为渐变绿色卡片；操作按钮组统一 `action-btn-group` 样式。
- 门禁结果面板重做：通过/失败/检查中使用不同渐变背景 CSS 类（`gate-result-pass`/`gate-result-fail`/`gate-result-checking`），视觉差异更大。
- 交互体验优化：骨架屏 loading 更像真实布局；空态增加图标 + 引导文字；完成态增加 `popIn` 弹出动画；全局滚动条美化；响应式 `@media` 小屏面板折叠。
- 主题色升级：Ant Design theme token 从 `#1677ff` 调整为 `#4f46e5`（Indigo 系），与新配色体系协调。
- 登录弹窗美化：渐变 header 背景 + 圆角增大 + 带图标输入框。
- 未更改任何后端 API 调用逻辑、数据结构和路由结构。
- 完成交接：to_qa（回归验证视觉改动不影响功能）、to_docs（如有用户可见变更需更新文档）。
- 新增 API 类型：`ProjectProgress`、`ProjectListItem`；新增 `getMyProjects()` 接口函数。
- AppLayout 改造：Content 区域移除 maxWidth/padding 限制，改为 flex:1 + overflow:hidden 以支持全屏三栏。
- CSS 全面重写：新增三栏布局、项目列表面板、节点详情面板、全屏画布容器、工具栏样式。
### 后端（2026-04-15）

- 完成 JWT Bearer 基础鉴权：新增 `POST /api/v1/auth/token`（开发签发测试 token），全局守卫校验 `Authorization: Bearer <token>`，并移除 `x-user-id` 信任链。
- 完成项目级访问控制：新增 `ProjectAccessGuard`（`projectId` 维度）与 `ExecutionAccessGuard`（`executionId -> projectId` 维度）；当前基线策略为 owner/member 可访问。
- 修复上传路径遍历风险：`CreateDocumentDto` 移除 `storageKey` 入参；服务端生成 `storageKey`，新增文件名净化工具，禁止路径注入与遍历。
- 增强输入校验：重点强化 `CreateDocumentDto`、`CreateProjectDto`、`UpdateFlowDraftDto`、`BindArtifactDto`，增加长度、白名单、数组上限、URL 规则等约束。
- 新增审计查询能力：落地 `GET /api/v1/projects/:projectId/audit-logs`，支持 `resourceType/resourceId` 可选过滤；仅项目 OWNER 可访问，返回请求追踪与操作主体字段。
- 新增基础限流：实现最小内存限流守卫并挂载到 `POST /auth/token`、`POST /projects`、`POST /projects/:projectId/documents`、`POST /executions/:executionId/start|submit|artifacts/bind`，超限返回 `429 RATE_LIMITED`。
- 缓解 submit 一致性风险：`submit()` 改为“先计算/暂存，再统一提交”，若门禁、后继解锁、通知、审计任一步骤异常，则回滚 execution、后继节点更新和内存队列写入，避免 execution 长时间停留在 `GATE_CHECKING` 或出现半更新。
### 后端（2026-04-28 第二轮全面改造）

- **新增 TeamsModule**：完整 CRUD + 成员管理（`POST /api/v1/teams`、`GET /api/v1/teams`、`GET /api/v1/teams/:teamId`、`POST /api/v1/teams/:teamId/members`、`DELETE /api/v1/teams/:teamId/members/:memberId`、`DELETE /api/v1/teams/:teamId`）；仅创建者可增删成员/删除团队；全局 JwtAuthGuard 保护；写审计日志。
- **新增 FlowchartsModule**：`Flowchart` 独立实体（含 parentFlowchartId/parentNodeId 支持子流程图）；接口：`GET /api/v1/projects/:projectId/flowcharts`、`POST /api/v1/projects/:projectId/flowcharts`、`POST /api/v1/flowcharts/:flowchartId/sub-flowcharts`、`DELETE /api/v1/flowcharts/:flowchartId`（级联删除后代子流程图）；写审计日志。
- **Project 实体绑定团队**：`Project` 新增必填字段 `teamId`；`CreateProjectDto` 新增 `teamId`（必填）；创建项目前验证团队存在；`findByUser()` 改为优先通过用户所在团队查找项目，同时兼容旧 projectMembers 直接关联；新增 `DELETE /api/v1/projects/:projectId`（仅 OWNER 可操作，级联删除 NodeExecution/FlowDefinition/Flowchart/Member/ArtifactBinding/Document）。
- **NodeConfig 类型规范化**：`type` 从 `string` 改为 `'START' | 'END' | 'TASK_SIMPLE' | 'TASK_BRANCH'`；`FlowsService` 兼容旧值（如 'NORMAL'）自动映射到 `TASK_SIMPLE`；新增 `subFlowchartIds?: string[]`（TASK_BRANCH 节点专用）。
- **NodeExecution 数据结构扩展**：新增 `flowchartId?: string`、`rejectionReason?: string`、`reviewResult?: { reviewedBy, result, reason, reviewedAt }`。
- **ExecutionStatus 新增 REJECTED**：`COMPLETED → REJECTED`（审核拒绝）、`REJECTED → IN_PROGRESS`（重新处理）合法迁移路径已加入 `VALID_TRANSITIONS`。
- **审核/回退接口**：`POST /api/v1/projects/:projectId/executions/:nodeId/approve`（调用者需是 nextNodeId 的 assignees 成员）、`POST /api/v1/projects/:projectId/executions/:nodeId/reject`（必填 reason，流程回退）；权限不满足返回 403，状态不合法返回 400；写审计日志。
- **ID 规范化工具**：新增 `generateId(prefix)` 工具函数（`apps/api/src/common/utils/generate-id.util.ts`）；Team/Project/Flowchart 均使用带前缀短码 ID。
- **TypeScript 编译零错误**，不引入新 npm 依赖，不改动前端代码。

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
| 2026-04-16 | v2.3 | 前端专家 | 完成三栏布局改造：全屏画布+左侧项目列表+右侧节点详情面板；新增 ProjectListPanel/NodeDetailPanel/MainWorkspace 组件；FlowCanvas 支持平移和双击新增节点；路由简化为单页面；编辑模式 OWNER 限定。 | 交接 to_qa / to_docs |
| 2026-04-17 | v2.4 | 前端专家 | 修复 FlowCanvas 拖拽终止节点空指针异常：在 handleMouseMove 内对 draggingRef 做局部快照，移除 setNodes 回调中的非空断言读取，避免 mouseup 后异步回调报错。 | 交接 to_qa |
| 2026-04-17 | v2.5 | 前端专家 | 补齐前端 vitest/jsdom 最小测试基建，并新增 FlowCanvas END 节点拖拽压力回归用例，覆盖“mouseup 清空 ref 后仍有 mousemove”竞态场景，验证组件不崩溃。 | 交接 to_qa |
| 2026-04-17 | v2.6 | 前端专家 | 完成项目面板底部操作区改造：将“新建/快速体验/模式切换”统一下沉到 ProjectListPanel 底部；模式切换改为单开关“开启编辑模式”；FlowCanvas 移除 Segmented 模式入口并保持 OWNER 权限约束联动。 | 交接 to_qa |
| 2026-04-17 | v2.7 | 前端专家 | 完成模式切换与操作区位置修正：模式文案改为“编辑模式”；模式开关迁移到 FlowCanvas 底部并与删除/连线同区；移除左栏重复开关并将折叠按钮调整到头部最右侧垂直居中；TS 诊断无新增报错。 | 交接 to_qa |