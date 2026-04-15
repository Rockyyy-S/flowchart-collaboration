# flowchart-collaboration 前端实现总结

> 版本：v0.1 | 日期：2026-04-14 | 角色：前端专家 | 状态：MVP 已完成

---

## 一、实现目标与结果

| 目标 | 结果 |
|------|------|
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
|------|------|
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
| `apps/web/src/api/client.ts` | Axios 实例（BaseURL / x-user-id 头 / 响应解包 / 错误 toast） |
| `apps/web/src/api/projects.ts` | `createProject` |
| `apps/web/src/api/flows.ts` | `getCurrentFlow` / `updateFlowDraft` |
| `apps/web/src/api/executions.ts` | `getExecutions` / `startExecution` / `submitExecution` / `getGateResult` / `bindArtifact` |
| `apps/web/src/api/documents.ts` | `createDocument` / `getDocuments` |
| `apps/web/src/components/layout/AppLayout.tsx` | 全局布局（顶部导航 + 主区域） |
| `apps/web/src/components/FlowCanvas/index.tsx` | 流程画布（拓扑排序 + 节点卡片列表） |
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
|------|---------|
| 首次访问空引导 | 展示演示横幅 + 「一键体验」按钮 |
| 创建演示项目 | 调用 `createProject` + `updateFlowDraft`（预设 5 节点研发流程），自动跳转 |
| 新建自定义项目 | Modal 表单 → `createProject` + 初始化单节点草稿 |
| 项目列表 | 从 `localStorage` 读取（因后端无 GET /projects 列表接口） |
| 点击项目卡片 | `navigate(/projects/:id)` |

### 项目详情页（`/projects/:projectId`）

| 交互 | 实现方式 |
|------|---------|
| 流程画布展示 | 拉取 `getCurrentFlow` + `getExecutions`，拓扑排序渲染 |
| 节点状态颜色 | CSS class `node-card-{STATUS}`，6 种状态各有对应颜色 |
| NEEDS_FIX 脉冲动效 | CSS `@keyframes pulse-red` |
| GATE_CHECKING 轮询 | `refetchInterval`：有节点在检查中时每 2 秒自动刷新 |
| 待补齐警告横幅 | `needsFix > 0` 时显示，附「查看第一个缺失节点」快捷按钮 |
| 点击节点 → 抽屉 | `setSelectedExecution` + `setDrawerOpen(true)` |
| 执行进度统计 | 实时计算 completed/total 比例 |

### 节点详情抽屉

| 交互 | 实现方式 |
|------|---------|
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
|--------|------|------|
| API 层与页面层分离 | ✅ | `src/api/` 与 `src/pages/` / `src/components/` 完全隔离 |
| 「失败→缺项→绑定→重试→通过」闭环 | ✅ | NodeDetailDrawer 完整实现了 6 步演示路径 |
| 至少 1 组默认示例数据 | ✅ | 工作台「快速体验演示项目」按钮，自动创建 5 节点研发流程 |
| 基础响应式 | ✅ | Antd Grid + flexWrap，Drawer 宽度 min(480, windowWidth) |
| 中文文案与注释 | ✅ | 所有文案、注释、错误提示均使用简体中文 |

---

## 六、未完成项与风险

### 未完成项（移交 QA / 后续迭代）

| 项目 | 原因 | 建议处理 |
|------|------|---------|
| LogicFlow 真实画布 | 集成成本高，MVP 使用列表式占位实现 | P1：封装 LogicFlow 适配层，替换 `FlowCanvas/index.tsx` 实现体 |
| 流程节点拖拽编辑 | 依赖 LogicFlow | 同上 |
| 通知中心页面 | 后端通知接口未暴露列表查询（MVP 占位） | 后端补 `GET /me/notifications` 后追加页面 |
| 多用户切换 | MVP 固定 `x-user-id: user-001` | 接入 JWT 鉴权后替换 `api/client.ts` 的 header 逻辑 |
| 项目列表 API | 后端无 `GET /projects` 接口，localStorage 替代 | 后端补接口后把 WorkbenchPage 改为 React Query |
| 单元测试 | MVP 阶段未编写 | QA 阶段补充 Vitest + React Testing Library |

### 风险与阻塞

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 后端内存存储 | 刷新/重启丢数据，无法持久体验演示 | 切换 PostgreSQL（已有替换指引） |
| MVP 节点均 READY | 不符合真实「依次解锁」语义，易造成误操作 | 后端 `unlockSuccessors` 正常工作，切换 DB 后需验证 PENDING 状态逻辑 |
| CORS（直接访问后端） | 若不用 Vite proxy 直接请求后端会 403 | 生产部署时配置 NestJS CORS 或 Nginx 反向代理 |
| Antd v5 + TailwindCSS 样式冲突 | tailwind preflight 已关闭，潜在样式覆盖风险 | 持续关注 UI 渲染，必要时用 Ant Design `theme.token` 覆盖 |
