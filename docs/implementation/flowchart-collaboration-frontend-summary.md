# flowchart-collaboration 前端实现总结

> 版本：v0.4 | 日期：2026-04-29 | 角色：前端专家 | 状态：主工作区 IA 与视觉语义重构完成（Top Bar/Activity Bar/Side Panel/Canvas/Node Detail 三分区）

---

## 一、实现目标与结果

| 目标 | 结果 |
| --- | --- |
| 创建 `apps/web` 前端工程（React + TypeScript + Vite） | ✅ 完成 |
| 实现项目工作台、流程画布、节点详情抽屉、门禁结果面板 | ✅ 完成 |
| 接入全部后端 API（创建项目、保存草稿、执行管理、门禁、文档绑定） | ✅ 完成 |
| `missingArtifacts` 高亮提示 + 补齐后重试 submit | ✅ 完成 |
| 提供默认演示项目一键创建（5 节点研发流程） | ✅ 完成 |
| API 层与页面层严格分离 | ✅ 完成 |
| 基础响应式（移动端/桌面端可用） | ✅ 完成 |
| 产出 README（运行方式和演示路径） | ✅ 完成 |

---

## 二、改动文件列表

### 新增文件

| 文件 | 说明 |
| --- | --- |
| `apps/web/package.json` | 前端依赖声明（React 18 / Antd v5 / TanStack Query / axios） |
| `apps/web/vite.config.ts` | Vite 配置（dev proxy → localhost:3000） |
| `apps/web/tsconfig.json` | TypeScript 配置 |
| `apps/web/tsconfig.node.json` | Vite 配置的 TS 编译选项 |
| `apps/web/index.html` | SPA 入口 HTML |
| `apps/web/tailwind.config.js` | TailwindCSS 配置（关闭 preflight 避免与 Antd 冲突） |
| `apps/web/postcss.config.js` | PostCSS 配置 |
| `apps/web/.env.example` | 环境变量模板 |
| `apps/web/src/main.tsx` | React 入口（QueryClientProvider + React.StrictMode） |
| `apps/web/src/App.tsx` | 路由配置 + Antd 全局 Provider |
| `apps/web/src/index.css` | 全局样式 + 节点状态颜色 CSS 类 |
| `apps/web/src/api/types.ts` | 全部 API 类型定义（与后端 DTO/接口对齐） |
| `apps/web/src/api/client.ts` | Axios 实例（BaseURL / Authorization Bearer 头 / 响应解包 / 错误 toast） |
| `apps/web/src/api/projects.ts` | `createProject` |
| `apps/web/src/api/flows.ts` | `getCurrentFlow` / `updateFlowDraft` |
| `apps/web/src/api/executions.ts` | `getExecutions` / `startExecution` / `submitExecution` / `getGateResult` / `bindArtifact` |
| `apps/web/src/api/documents.ts` | `createDocument` / `getDocuments` |
| `apps/web/src/components/layout/AppLayout.tsx` | 全局布局（顶部导航 + 主区域） |
| `apps/web/src/components/FlowCanvas/index.tsx` | 流程画布（真实可编辑画布：节点定位 + 连线 SVG + 编辑工具栏） |
| `apps/web/src/components/FlowCanvas/NodeCard.tsx` | 单节点卡片（状态颜色 / 动作按钮） |
| `apps/web/src/components/GateResultPanel/index.tsx` | 门禁结果展示面板 |
| `apps/web/src/components/DocumentUploadModal/index.tsx` | 文档上传 & 绑定弹窗 |
| `apps/web/src/components/NodeDetailDrawer/index.tsx` | 节点详情抽屉（含全部执行操作） |
| `apps/web/src/pages/WorkbenchPage.tsx` | 工作台页面（项目列表 + 创建 + 演示引导） |
| `apps/web/src/pages/ProjectPage.tsx` | 项目详情页（画布 + 统计 + 抽屉联动） |
| `apps/web/README.md` | 运行方式和演示路径说明 |
| `docs/implementation/flowchart-collaboration-frontend-summary.md` | 本文档 |

---

## 三、页面与交互清单

### 工作台页面（`/`）

| 交互 | 实现方式 |
| --- | --- |
| 首次访问空引导 | 展示演示横幅 + 「一键体验」按钮 |
| 创建演示项目 | 调用 `createProject` + `updateFlowDraft`（预设 5 节点研发流程），自动跳转 |
| 新建自定义项目 | Modal 表单 → `createProject` + 初始化单节点草稿 |
| 项目列表 | 从 `localStorage` 读取（因后端无 GET /projects 列表接口） |
| 点击项目卡片 | `navigate(/projects/:id)` |

### 项目详情页（`/projects/:projectId`）

| 交互 | 实现方式 |
| --- | --- |
| 流程画布展示 | 拉取 `getCurrentFlow` + `getExecutions`，拓扑排序渲染 |
| 节点状态颜色 | CSS class `node-card-{STATUS}`，6 种状态各有对应颜色 |
| NEEDS_FIX 脉冲动效 | CSS `@keyframes pulse-red` |
| GATE_CHECKING 轮询 | `refetchInterval`：有节点在检查中时每 2 秒自动刷新 |
| 待补齐警告横幅 | `needsFix > 0` 时显示，附「查看第一个缺失节点」快捷按钮 |
| 点击节点 → 抽屉 | `setSelectedExecution` + `setDrawerOpen(true)` |
| 执行进度统计 | 实时计算 completed/total 比例 |

### 节点详情抽屉

| 交互 | 实现方式 |
| --- | --- |
| 开始执行 | `startExecution` mutation（READY/NEEDS_FIX → IN_PROGRESS） |
| 提交完成 | `submitExecution` mutation，response 即包含 gateResult |
| 门禁结果即时展示 | submit 响应中直接拿 `missingArtifacts`，无需额外轮询 |
| 缺失文档高亮 | `missingIds` set → `List.Item` 红色背景 + 「补齐」按钮 |
| 上传并绑定文档 | `DocumentUploadModal` → `createDocument` + `bindArtifact` |
| 重新开始（补齐后） | 再次调用 `startExecution`（NEEDS_FIX → IN_PROGRESS） |
| 再次提交 | 再次调用 `submitExecution`，门禁已绑定则通过 |
| 抽屉内状态同步 | 关闭时 `invalidateQueries` 强制刷新最新状态 |

---

## 四、本地运行步骤

```bash
# 步骤 1：启动后端
cd apps/api
npm install
npm run start:dev          # 监听 http://localhost:3000

# 步骤 2（新终端）：启动前端
cd apps/web
npm install
npm run dev                # 监听 http://localhost:5173

# 步骤 3：访问
浏览器打开 http://localhost:5173
```

---

## 五、验收标准自检

| 验收项 | 状态 | 说明 |
| --- | --- | --- |
| API 层与页面层分离 | ✅ | `src/api/` 与 `src/pages/` / `src/components/` 完全隔离 |
| 「失败→缺项→绑定→重试→通过」闭环 | ✅ | NodeDetailDrawer 完整实现了 6 步演示路径 |
| 至少 1 组默认示例数据 | ✅ | 工作台「快速体验演示项目」按钮，自动创建 5 节点研发流程 |
| 基础响应式 | ✅ | Antd Grid + flexWrap，Drawer 宽度 min(480, windowWidth) |
| 中文文案与注释 | ✅ | 所有文案、注释、错误提示均使用简体中文 |

---

## 六、未完成项与风险

### 未完成项（移交 QA / 后续迭代）

| 项目 | 原因 | 建议处理 |
| --- | --- | --- |
| LogicFlow 引擎替换 | 当前已是轻量真实画布实现，但未引入缩放/迷你地图/路由线等高级能力 | P1：在保持现有保存协议不变的前提下，逐步替换为 LogicFlow 适配层 |
| 高级编排能力 | 现有编辑能力聚焦 MVP（新增/删除/拖拽/连线/保存） | P1：补充缩放、迷你地图、批量框选、快捷键操作 |
| 通知中心页面 | 后端通知接口未暴露列表查询（MVP 占位） | 后端补 `GET /me/notifications` 后追加页面 |
| 多用户与会话治理 | 当前支持开发态令牌登录，生产级会话策略未纳入本轮 | 后续接入更严格会话管理与账号体系（如 httpOnly Cookie + CSRF） |
| 项目列表 API | 后端无 `GET /projects` 接口，localStorage 替代 | 后端补接口后把 WorkbenchPage 改为 React Query |
| 单元测试 | MVP 阶段未编写 | QA 阶段补充 Vitest + React Testing Library |

### 风险与阻塞

| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| 后端内存存储 | 刷新/重启丢数据，无法持久体验演示 | 切换 PostgreSQL（已有替换指引） |
| MVP 节点均 READY | 不符合真实「依次解锁」语义，易造成误操作 | 后端 `unlockSuccessors` 正常工作，切换 DB 后需验证 PENDING 状态逻辑 |
| CORS（直接访问后端） | 若不用 Vite proxy 直接请求后端会 403 | 生产部署时配置 NestJS CORS 或 Nginx 反向代理 |
| Antd v5 + TailwindCSS 样式冲突 | tailwind preflight 已关闭，潜在样式覆盖风险 | 持续关注 UI 渲染，必要时用 Ant Design `theme.token` 覆盖 |

---

## 七、2026-04-16 真实画布增强（本次）

### 7.1 改动目标与结果

| 目标 | 结果 |
| --- | --- |
| 将占位式流程列表升级为真实画布 | ✅ 已完成，ProjectPage 现为可视化节点布局 + 连线 SVG 画布 |
| 支持最小可用编辑能力（新增、删除、拖拽、连线、保存） | ✅ 已完成，编辑模式内提供完整工具栏 |
| 保持执行态节点详情抽屉兼容 | ✅ 已完成，执行模式点击节点行为不变 |
| 保存时同步 `graphJson`、`nodesConfig`、`predecessorNodeIds` | ✅ 已完成，保存前按边关系重算 predecessor，保留已有 requiredArtifacts |

### 7.2 关键实现与原因

- 改造 [apps/web/src/components/FlowCanvas/index.tsx](../../apps/web/src/components/FlowCanvas/index.tsx)：
  - 新增双模式：`view`（执行）/`edit`（编辑）。
  - 编辑模式支持节点拖拽、从选中节点发起连线、删除节点并联动清理相关边。
  - 保存时统一归一化边、过滤非法边（自环/重复/孤立），并基于 edges 重建 `predecessorNodeIds`。
  - 对已有节点配置采用“按 nodeId 合并保留”策略，尽量避免 requiredArtifacts 丢失。
- 改造 [apps/web/src/pages/ProjectPage.tsx](../../apps/web/src/pages/ProjectPage.tsx)：
  - 增加“执行模式/编辑模式”切换，编辑态下自动关闭详情抽屉，避免交互冲突。
  - 接入 `updateFlowDraft` 保存 mutation，保存成功后刷新 flow 与 executions，保证刷新后可恢复图结构。
- 更新 [apps/web/src/api/types.ts](../../apps/web/src/api/types.ts)：
  - `GraphNode` 增加可选坐标 `x/y`。
  - `UpdateFlowDraftDto.requiredArtifacts` 增加可选 `sourceType`，避免保存时丢失来源类型。
- 更新 [apps/web/src/index.css](../../apps/web/src/index.css)：
  - 增加真实画布背景、边层、节点绝对定位样式。

说明：本次未直接接入 LogicFlow，而采用与现有 `graphJson` 结构完全兼容的轻量实现。主要原因是当前仓库已有严格 API/类型约束，且目标为“在现有 ProjectPage/FlowCanvas 体系内最小改造并保证可构建可回归”；该方案无新增依赖即可满足拖拽、连线、保存和兼容执行态的验收要求。

### 7.3 验证步骤与风险

1. 进入项目页，确认可见真实画布（非纯列表）。
2. 切换到编辑模式，点击“新增节点”，拖拽位置后发起并完成连线。
3. 点击“保存流程草稿”，刷新页面，确认节点位置与边关系恢复。
4. 删除一个有入/出边的节点并保存，检查后端返回的流程中不存在悬挂边，且 `predecessorNodeIds` 与剩余 edges 一致。
5. 切回执行模式，点击节点仍可打开详情抽屉并执行原有操作。

已知风险：当前画布为轻量自实现，不含缩放、迷你地图、复杂路由线与批量操作；若后续需要高级编排能力，可在现有模式与保存协议不变前提下，逐步替换为 LogicFlow 引擎。

---

## 八、2026-04-29 UX/UI 规范对齐重构（本次）

### 8.1 改动目标与结果

| 目标 | 结果 |
| --- | --- |
| 依据 UX/UI 规范重构主工作区信息架构 | ✅ 完成：形成 Top Bar + Activity Bar + Side Panel + Canvas + Status Bar 结构 |
| 完成团队管理面板与新建团队弹窗可用链路 | ✅ 完成：`TeamManagement` 支持 Side Panel 嵌入模式，保留原弹窗交互 |
| 完成通知入口（Top Bar Popover）与侧栏通知视图 | ✅ 完成：顶部通知 Popover + 左侧通知模式双入口 |
| 节点卡片统一语义（START/END/TASK_SIMPLE/TASK_BRANCH）与状态可视化 | ✅ 完成：节点统一圆角矩形，按类型/状态区分语义 |
| 右侧节点详情三分区与审核通过/拒绝交互可用 | ✅ 完成：保留并强化三分区及 approve/reject 链路 |
| 样式体系由变量驱动 | ✅ 完成：新增/复用 CSS 变量，减少散落硬编码 |

### 8.2 关键实现与原因

- 重构 [apps/web/src/pages/MainWorkspace.tsx](../../apps/web/src/pages/MainWorkspace.tsx)：
  - 新增 `ActivityKey` 路由状态（项目/搜索/团队/通知）与侧栏展开逻辑。
  - 增加平板策略（1024-1279）：Side Panel 采用 overlay，不挤压画布。
  - 新增底部 `Status Bar`，实时展示节点总数、进行中与完成比。
- 重构 [apps/web/src/components/layout/AppLayout.tsx](../../apps/web/src/components/layout/AppLayout.tsx)：
  - 去除 Slogan 轮播，新增全局搜索输入、通知 Popover、用户菜单。
  - 保留开发态令牌获取链路，不改后端接口契约。
- 扩展 [apps/web/src/components/TeamManagement/index.tsx](../../apps/web/src/components/TeamManagement/index.tsx)：
  - 支持 `embedded` 模式，满足 Side Panel 团队管理面板承载。
  - 保留新建团队/添加成员/删除团队弹窗与权限控制。
- 重构 [apps/web/src/components/FlowCanvas/index.tsx](../../apps/web/src/components/FlowCanvas/index.tsx)：
  - 节点类型统一到 `START/END/TASK_SIMPLE/TASK_BRANCH`，兼容旧 `TASK` 自动映射。
  - 节点视觉改为统一圆角矩形语义，新增类型标签与分支节点 `子图` 标识。
  - 补齐 `REJECTED` 状态文案与图标；编辑工具栏新增“节点”下拉创建入口。
- 更新 [apps/web/src/index.css](../../apps/web/src/index.css)：
  - 新增 Activity Bar、Side Panel、Team 嵌入面板、状态栏与通知样式。
  - 统一节点类型语义样式与状态色（含 REJECTED），调整工具栏为顶部布局。

### 8.3 验证步骤与风险

1. 在 `apps/web` 执行 `npm run build`，确认打包通过。
2. 打开主界面，验证 Top Bar（搜索/通知/用户菜单）与左侧 Activity Bar 四入口。
3. 在项目侧栏打开流程图标签，验证 Tab 切换、Canvas 绘制、Status Bar 统计。
4. 点击节点，验证右侧三分区（基本信息/审核上游/当前操作）与通过/拒绝链路。
5. 切换编辑模式，验证“节点”下拉创建、连线、保存草稿、状态渲染。

已知风险：通知仍为前端派生/本地展示，后续需与后端真实通知列表（轮询或推送）对齐；移动端（<768）仍非 MVP 支持范围。
