# flowchart-collaboration-web

> Flowkit 前端 MVP — 流程图驱动的项目协作平台
> 技术栈：React 18 + TypeScript + Vite + Ant Design v5 + TailwindCSS

---

## 快速启动

```bash
# 1. 进入前端目录
cd apps/web

# 2. 安装依赖（需 Node.js >= 18）
npm install

# 3. 先启动后端（新终端）
cd ../api && npm install && npm run start:dev

# 4. 启动前端（开发模式）
cd ../web && npm run dev
```

前端默认访问地址：`http://localhost:5173`  
后端 API 地址：`http://localhost:3000/api/v1`（通过 Vite proxy 自动转发，无需手动配置跨域）

---

## 演示路径（完整闭环体验）

### 一键体验（推荐）

1. 打开 `http://localhost:5173`
2. 点击「**快速体验演示项目**」按钮
3. 系统自动创建「示例研发项目」，包含 5 个节点的研发标准交付流程
4. 按下方步骤手动操作

### 手动演示步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 进入项目，流程画布显示 5 个节点 | 「需求评审」为蓝色（可开始），其他节点为灰色（待启动）* |
| 2 | 点击「需求评审」节点卡片 → 抽屉打开 | 显示节点详情及「产品需求文档(PRD)」输出物要求 |
| 3 | 点击「开始执行」 | 节点变为橙色（进行中） |
| 4 | 点击「提交完成（触发门禁检查）」 | 门禁失败：节点变红（待补齐），提示缺少 PRD 文档 |
| 5 | 点击「上传 / 绑定文档」→ 填写文件名「PRD_v1.0.pdf」→ 确认绑定 | 文档已上传并绑定成功 |
| 6 | 点击「重新开始（补齐后重试）」 | 节点恢复为橙色（进行中） |
| 7 | 再次点击「提交完成」 | 门禁通过！节点变绿（已完成） |

> *注：MVP 后端简化实现，所有节点初始均为 READY 状态，后续版本将通过 predecessorNodeIds 实现依次解锁。

---

## 目录结构

```
src/
├── api/                 # API 层（与页面层严格分离）
│   ├── client.ts        # Axios 实例（BaseURL、x-user-id 头、响应解包）
│   ├── types.ts         # 所有 API 类型定义（与后端 DTO 对齐）
│   ├── projects.ts      # 项目接口
│   ├── flows.ts         # 流程定义接口
│   ├── executions.ts    # 执行实例接口（start / submit / gate-result / bind）
│   └── documents.ts     # 文档接口
├── components/          # 可复用业务组件
│   ├── FlowCanvas/      # 流程画布（MVP 占位实现 + LogicFlow 适配层接口）
│   ├── NodeDetailDrawer/ # 节点详情抽屉（核心业务交互）
│   ├── GateResultPanel/ # 门禁结果展示面板
│   ├── DocumentUploadModal/ # 文档上传 & 绑定弹窗
│   └── layout/          # 全局布局
├── pages/
│   ├── WorkbenchPage.tsx  # 项目工作台（创建/列表）
│   └── ProjectPage.tsx    # 项目详情（画布 + 执行管理）
├── App.tsx              # 路由配置
├── main.tsx             # 入口
└── index.css            # 全局样式 + TailwindCSS
```

---

## 核心页面说明

### 项目工作台 (`/`)

- 展示已创建的项目列表（数据持久化到 `localStorage`，因后端无列表接口）
- 「快速体验演示项目」：一键创建含 5 节点研发流程的示例项目
- 「新建项目」：自定义项目名称，初始化单节点草稿

### 项目详情 (`/projects/:projectId`)

- **流程画布**：拓扑排序展示节点顺序（横向可滚动）；节点颜色反映状态
- **顶部统计**：总节点数、已完成数、进行中数、完成率
- **警告横幅**：有节点待补齐时显示，一键跳转第一个问题节点
- **节点抽屉**：点击任意非 PENDING 节点打开；包含开始/提交/绑定文档全部操作

---

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `VITE_API_BASE_URL` | `/api/v1` | 后端 API 基础路径（开发模式通过 Vite proxy 转发） |

复制 `.env.example` 为 `.env.local` 可在本地覆盖配置。

---

## 已知限制（MVP）

1. **后端内存存储**：后端重启后数据丢失，需重新创建项目。
2. **文档上传**：MVP 仅提交元数据（名称/类型/大小），无真实文件传输。
3. **流程画布**：使用简化列表展示，后续接入 [LogicFlow](https://site.logic-flow.cn/) 实现可拖拽编辑。
4. **用户身份**：固定 `x-user-id: user-001`，暂不支持多用户切换。
5. **项目列表**：存储在 `localStorage`，跨浏览器/清空缓存后丢失。
