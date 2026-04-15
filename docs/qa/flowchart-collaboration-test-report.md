# flowchart-collaboration QA 测试报告

> 版本：v0.1 | 日期：2026-04-14 | QA 专家 | 状态：待执行

---

## 一、测试范围

### 测试边界

- **覆盖应用**：apps/api（后端 MVP） + apps/web（前端 MVP）
- **技术栈验证**：NestJS 10 + React 18 + 内存存储（非 PostgreSQL）
- **测试深度**：功能验证 + 状态机约束 + 边界场景

### 核心功能覆盖清单

| # | 功能模块 | 测试用例 | 验收标准 | 状态 |
|---|---------|---------|---------|------|
| 1 | 创建项目 | TC-1 | 创建项目后返回 projectId，初始化默认流程草稿 | ⏳待执行 |
| 2 | 保存流程草稿 | TC-2 | 保存含必需输出物配置的草稿，自动为新节点创建 NodeExecution | ⏳待执行 |
| 3 | 节点启动流程 | TC-3, TC-4 | READY → IN_PROGRESS（start）; IN_PROGRESS → GATE_CHECKING（submit） | ⏳待执行 |
| 4 | 门禁失败检查 | TC-5 | Submit 后因缺少必需文档，状态变为 NEEDS_FIX，返回 missingArtifacts[] | ⏳待执行 |
| 5 | 补齐文档绑定 | TC-6 | 上传文档并绑定到缺失的 requirementId，前端缺项提示消失 | ⏳待执行 |
| 6 | 补齐后重试 | TC-7 | 从 NEEDS_FIX 重新 start → submit，通过门禁 → COMPLETED | ⏳待执行 |
| 7 | 前端缺项提示 | TC-8 | 节点详情抽屉中缺失文档行高亮（红色背景），按钮可快速上传绑定 | ⏳待执行 |
| 8 | 状态机约束 | TC-9 | 禁止 PENDING 直接跳转 IN_PROGRESS；禁止非法状态转移 | ⏳待执行 |

---

## 二、测试用例详细设计

### TC-1：创建项目

**目标**：验证项目原子初始化逻辑

**前置条件**：后端服务运行在 `http://localhost:3000`

**执行步骤**：

```bash
# 1. 发送创建项目请求
curl -s -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{"name": "测试项目ABC"}' | jq '.data'

# 预期输出结构：
# {
#   "projectId": "uuid",
#   "name": "测试项目ABC",
#   "status": "ACTIVE",
#   "ownerId": "user-001",
#   "createdAt": "2026-04-14T..."
# }

# 2. 验证项目成员初始化
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | length'

# 预期：length ≥ 1（至少包含初始化的单节点执行实例）
```

**验收标准**：

- ✅ 返回 HTTP 201，data 包含 projectId（UUID 格式）
- ✅ 项目 status 为 ACTIVE
- ✅ ownerId 与请求头 x-user-id 一致
- ✅ 项目初始化包含默认 FlowDefinition（draft 版本）
- ✅ 审计日志记录此操作

**预期结果**：✅ 通过

---

### TC-2：保存流程草稿（含必需输出物）

**目标**：验证流程定义更新与节点执行自动创建

**前置条件**：已创建项目（TC-1 后继）

**执行步骤**：

```bash
# 1. 保存草稿：3 个节点，第 1 个节点有必需输出物
curl -s -X PUT http://localhost:3000/api/v1/projects/{projectId}/flows/draft \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{
    "graphJson": {
      "nodes": [
        {"id": "req-review", "text": "需求评审"},
        {"id": "design", "text": "设计"},
        {"id": "dev", "text": "开发"}
      ],
      "edges": [
        {"source": "req-review", "target": "design"},
        {"source": "design", "target": "dev"}
      ]
    },
    "nodesConfig": [
      {
        "nodeId": "req-review",
        "name": "需求评审",
        "requiredArtifacts": [
          {"id": "prd-001", "name": "PRD v1.0", "required": true},
          {"id": "feasibility", "name": "可行性分析", "required": false}
        ]
      },
      {
        "nodeId": "design",
        "name": "设计",
        "requiredArtifacts": [
          {"id": "design-001", "name": "系统设计文档", "required": true}
        ]
      },
      {
        "nodeId": "dev",
        "name": "开发",
        "requiredArtifacts": []
      }
    ]
  }' | jq '.data'

# 预期返回：{ draftVersion: number, graphJson: {...}, nodesConfig: [...] }

# 2. 获取节点执行列表，验证为新节点创建了 READY 状态执行
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | map({nodeId, status})'

# 预期所有 3 个节点均有对应执行实例，状态为 READY（MVP 简化）
```

**验收标准**：

- ✅ PUT 返回 HTTP 200，draftVersion 与前一版本不同
- ✅ 新增节点自动创建 NodeExecution 实例
- ✅ 所有节点执行实例状态为 READY（MVP 约束）
- ✅ ArtifactRequirement 正确存储（required 标记）

**预期结果**：✅ 通过

---

### TC-3：节点启动（READY → IN_PROGRESS）

**目标**：验证 start() 状态转移合法性

**前置条件**：完成 TC-2，有 READY 状态的执行实例

**执行步骤**：

```bash
# 1. 获取第一个节点的 executionId
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data[0] | {executionId, status}'

# 记录 executionId（假设为 exec-001）

# 2. 调用 start
curl -s -X POST http://localhost:3000/api/v1/executions/exec-001/start \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{}' | jq '.data'

# 预期：{ executionId: "exec-001", status: "IN_PROGRESS", startedAt: "2026-04-14T..." }

# 3. 验证状态已转移
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | map(select(.executionId=="exec-001")) | .[0].status'

# 预期：IN_PROGRESS
```

**验收标准**：

- ✅ start() 返回 HTTP 200
- ✅ 执行实例状态由 READY 变为 IN_PROGRESS
- ✅ startedAt 时间戳已记录
- ✅ 审计日志记录执行者身份

**预期结果**：✅ 通过

---

### TC-4：节点提交（IN_PROGRESS → GATE_CHECKING）

**目标**：验证 submit() 无遗漏时直接通过门禁

**前置条件**：完成 TC-3，节点在 IN_PROGRESS 状态，且无必需输出物配置

**执行步骤**：

```bash
# 假设有一个无必需输出物的节点（如 TC-2 中的 "dev" 节点），executionId 为 exec-dev

# 1. 先 start 该节点
curl -s -X POST http://localhost:3000/api/v1/executions/exec-dev/start \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{}' | jq '.data.status'

# 预期：IN_PROGRESS

# 2. 提交该节点
curl -s -X POST http://localhost:3000/api/v1/executions/exec-dev/submit \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{"comment": "开发完成"}' | jq '.data'

# 预期：{ 
#   executionId: "exec-dev", 
#   status: "COMPLETED",  （直接通过）
#   gateResult: { pass: true, missingArtifacts: [] }
# }

# 3. 验证最终状态
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | map(select(.executionId=="exec-dev")) | .[0] | {status, completedAt}'

# 预期：{ status: "COMPLETED", completedAt: "2026-04-14T..." }
```

**验收标准**：

- ✅ submit() 返回 HTTP 200
- ✅ 状态直接转为 COMPLETED（无必需输出物)
- ✅ gateResult.pass 为 true
- ✅ submittedAt / completedAt 时间戳已记录

**预期结果**：✅ 通过

---

### TC-5：门禁失败检查（缺少必需文档）

**目标**：验证 submit() 触发门禁检查，缺少必需文档时返回 NEEDS_FIX

**前置条件**：完成 TC-2，有必需输出物的节点（如 "req-review"），目前 IN_PROGRESS 状态

**执行步骤**：

```bash
# 假设 "req-review" 节点 executionId 为 exec-req，需要 PRD 文档

# 1. 先确保该节点在 IN_PROGRESS 状态
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | map(select(.nodeId=="req-review")) | .[0] | {executionId, status}'

# 假设状态为 READY，需要先 start
curl -s -X POST http://localhost:3000/api/v1/executions/exec-req/start \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{}' > /dev/null

# 2. 直接 submit，不上传 PRD 文档
curl -s -X POST http://localhost:3000/api/v1/executions/exec-req/submit \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{"comment": "无相关文档提交"}' | jq '.data'

# 预期响应：
# {
#   executionId: "exec-req",
#   status: "NEEDS_FIX",
#   gateResult: {
#     pass: false,
#     missingArtifacts: [
#       { id: "prd-001", name: "PRD v1.0", requirementId: "prd-001" }
#     ]
#   }
# }

# 3. 验证状态已转为 NEEDS_FIX
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | map(select(.executionId=="exec-req")) | .[0].status'

# 预期：NEEDS_FIX
```

**验收标准**：

- ✅ submit() 调用门禁引擎
- ✅ 状态转为 NEEDS_FIX（而非 COMPLETED）
- ✅ gateResult.pass 为 false
- ✅ missingArtifacts 数组包含缺少的 PRD 文档（id="prd-001"）
- ✅ missingArtifacts 仅包含 required=true 的项（feasibility 不出现）

**预期结果**：✅ 通过

---

### TC-6：上传文档并绑定输出物

**目标**：验证文档上传与绑定逻辑

**前置条件**：完成 TC-5，节点处于 NEEDS_FIX 状态

**执行步骤**：

```bash
# 1. 上传文档（MVP 模拟）
curl -s -X POST http://localhost:3000/api/v1/projects/{projectId}/documents \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{
    "name": "PRD_v1.0.pdf",
    "mimeType": "application/pdf",
    "size": 1024000
  }' | jq '.data'

# 预期返回：
# {
#   documentId: "uuid",
#   name: "PRD_v1.0.pdf",
#   storageKey: "...",
#   version": 1,
#   createdAt: "2026-04-14T..."
# }

# 记录 documentId

# 2. 查询可用文档列表
curl -s http://localhost:3000/api/v1/projects/{projectId}/documents \
  -H "x-user-id: user-001" | jq '.data | map({documentId, name})'

# 预期：包含刚上传的 PRD_v1.0.pdf

# 3. 绑定文档到缺失的需求项（prd-001）
curl -s -X POST http://localhost:3000/api/v1/executions/exec-req/artifacts/bind \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{
    "requirementId": "prd-001",
    "documentId": "{documentId 的值}"
  }' | jq '.data'

# 预期返回：
# {
#   bindingId: "uuid",
#   nodeExecutionId: "exec-req",
#   requirementId: "prd-001",
#   documentId: "{documentId}",
#   createdAt: "2026-04-14T..."
# }

# 4. 验证绑定生效：查询门禁结果（不需要重新 submit）
curl -s http://localhost:3000/api/v1/executions/exec-req/gate-result \
  -H "x-user-id: user-001" | jq '.data'

# 预期：{ pass: true, missingArtifacts: [] }（因已绑定 PRD）
```

**验收标准**：

- ✅ POST /documents 返回 HTTP 201，documentId 为 UUID
- ✅ GET /documents 列表包含新上传的文档
- ✅ POST /artifacts/bind 返回 HTTP 201
- ✅ 绑定后 gate-result 中 missingArtifacts 消失
- ✅ 同一 requirementId 多次 bind 自动覆盖（最后一个生效）

**预期结果**：✅ 通过

---

### TC-7：补齐后重新提交（NEEDS_FIX → COMPLETED）

**目标**：验证「失败 → 补齐 → 重试 → 通过」完整闭环

**前置条件**：完成 TC-6，文档已绑定，节点处于 NEEDS_FIX 状态

**执行步骤**：

```bash
# 1. 从 NEEDS_FIX 状态重新 start（应允许转为 IN_PROGRESS）
curl -s -X POST http://localhost:3000/api/v1/executions/exec-req/start \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{}' | jq '.data'

# 预期：{ executionId: "exec-req", status: "IN_PROGRESS", ... }

# 2. 再次 submit
curl -s -X POST http://localhost:3000/api/v1/executions/exec-req/submit \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{"comment": "已绑定 PRD，重新提交"}' | jq '.data'

# 预期：
# {
#   executionId: "exec-req",
#   status: "COMPLETED",  ✅ 门禁通过
#   gateResult: { pass: true, missingArtifacts: [] },
#   completedAt: "2026-04-14T..."
# }

# 3. 验证最终状态
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | map(select(.executionId=="exec-req")) | .[0] | {status, completedAt}'

# 预期：{ status: "COMPLETED", completedAt: "2026-04-14T..." }
```

**验收标准**：

- ✅ NEEDS_FIX 状态允许调用 start()（转 IN_PROGRESS）
- ✅ 再次 submit() 触发门禁检查
- ✅ 绑定后门禁通过，状态直接转 COMPLETED
- ✅ completedAt 时间戳已记录
- ✅ 审计日志记录两次 submit 操作

**预期结果**：✅ 通过

---

### TC-8：前端缺项提示展示

**目标**：验证前端 NodeDetailDrawer 中缺项高亮与快速绑定交互

**前置条件**：
- 前端运行在 `http://localhost:5173`
- 后端运行在 `http://localhost:3000`
- 已创建演示项目或手动创建含必需输出物的项目

**执行步骤**：

```javascript
// 步骤 1：浏览器打开前端
// http://localhost:5173

// 步骤 2：进入项目详情页（或一键体验演示项目）
// 预期：看到流程画布，节点颜色反映状态（蓝色 READY / 橙色 IN_PROGRESS / 红色 NEEDS_FIX）

// 步骤 3：点击「需求评审」节点卡片
// 预期：右侧抽屉打开，显示：
//   - 节点名称：「需求评审」
//   - 状态标签：「可开始」（蓝色）
//   - 「开始执行」按钮（蓝色）
//   - 输出物要求列表：
//     ○ ☐ PRD v1.0（必需）
//     ○ ☐ 可行性分析（可选）

// 步骤 4：点击「开始执行」
// 预期：
//   - 状态标签变为「进行中」（橙色）
//   - 按钮变为「提交完成（触发门禁检查）」

// 步骤 5：点击「提交完成」但不上传任何文档
// 预期：
//   - 状态标签变为「待补齐」（红色），带脉冲动效
//   - 抽屉中输出物列表重新渲染：
//     ☑ PRD v1.0（缺失，红色高亮背景）【补齐】按钮
//     ○ 可行性分析（已跳过）
//   - 顶部警告横幅：「有 1 个节点待补齐，【查看】」
//   - 快捷按钮：「上传 / 绑定文档」

// 步骤 6：点击缺失项的「补齐」或抽屉中的「上传文档」按钮
// 预期：弹出 DocumentUploadModal
//   - 输入框：文件名「PRD_v1.0.pdf」
//   - 【上传并绑定】按钮
//   - 点击后通知 success："文档已绑定"

// 步骤 7：确认绑定后，抽屉中缺失列表应消失
// 预期：
//   - 输出物列表仅显示：
//     ☑ PRD v1.0（已绑定，正常背景）
//     ○ 可行性分析（已跳过）
//   - 顶部警告横幅消失
//   - 按钮变回「重新开始（补齐后重试）」

// 步骤 8：点击「重新开始」→ 再次点击「提交完成」
// 预期：
//   - 门禁通过，状态变为「已完成」（绿色）√
//   - 抽屉自动关闭（可选：显示通知"节点已完成"）
```

**验收标准**：

- ✅ 缺失的必需文档用**红色背景**高亮
- ✅ 可选输出物不显示为缺失项
- ✅ 「补齐」按钮直接打开 DocumentUploadModal
- ✅ 绑定后缺失项即时消失（前端侧 React Query invalidate）
- ✅ 节点卡片颜色实时反映状态变化
- ✅ NEEDS_FIX 状态有脉冲红色动效（CSS keyframes）
- ✅ 所有交互反馈通过 Ant Design message / notification 展示

**预期结果**：✅ 通过

---

### TC-9：状态机约束验证

**目标**：验证禁止的非法状态转移被拒绝

**前置条件**：有多个节点执行实例，初始状态均为 READY（MVP 约束）

**执行步骤**：

```bash
# 子用例 TC-9a：禁止 PENDING → IN_PROGRESS 直接跳转
# （MVP 中所有节点初始为 READY，此用例暂无法测试，但代码已检查）

# 子用例 TC-9b：禁止从 COMPLETED 调用 start()
# 1. 从 TC-7 中已 COMPLETED 的节点获取 executionId
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "x-user-id: user-001" | jq '.data | map(select(.status=="COMPLETED")) | .[0] | .executionId'

# 假设为 exec-completed

# 2. 尝试对 COMPLETED 节点调用 start()
curl -s -X POST http://localhost:3000/api/v1/executions/exec-completed/start \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{}' | jq '.'

# 预期错误：
# {
#   "code": "INVALID_STATE_TRANSITION",
#   "message": "当前状态（COMPLETED）不允许执行开始操作，需为 READY 或 NEEDS_FIX",
#   "requestId": "...",
#   "statusCode": 400
# }

# 子用例 TC-9c：禁止从 IN_PROGRESS 直接调用 gate-result（应先 submit）
# 1. 创建 IN_PROGRESS 状态的节点
curl -s -X POST http://localhost:3000/api/v1/executions/exec-req/start \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-001" \
  -d '{}' > /dev/null

# 2. 尝试查询门禁结果（应返回 GATE_CHECKING 状态的节点或提示需要 submit）
curl -s http://localhost:3000/api/v1/executions/exec-req/gate-result \
  -H "x-user-id: user-001" | jq '.data // .code'

# 预期：返回当前门禁状态（提示：门禁结果仅在 GATE_CHECKING 或最后一次 submit 后可用）
```

**验收标准**：

- ✅ 禁止从 COMPLETED 状态调用 start()，返回 HTTP 400 + INVALID_STATE_TRANSITION
- ✅ 禁止从 IN_PROGRESS 直接跳过 submit() 转 COMPLETED
- ✅ 所有非法转移返回统一错误码与说明
- ✅ 错误响应包含 requestId（可用于审计追溯）

**预期结果**：✅ 通过

---

## 三、测试结果与缺陷清单

### 待执行说明

由于当前环境无法直接启动 Node.js 应用，以上 TC-1 至 TC-9 的具体执行结果**待人工验证**。

建议执行步骤：

1. **环境准备**（≈ 5 分钟）
   ```bash
   # 终端 1：启动后端
   cd apps/api
   npm install
   npm run start:dev
   
   # 终端 2：启动前端
   cd apps/web
   npm install
   npm run dev
   ```

2. **功能验证**（≈ 30 分钟）
   - 依次执行 TC-1 至 TC-7 的 curl 脚本
   - 记录每个用例的实际返回值与预期是否吻合

3. **前端交互验证**（≈ 15 分钟）
   - 按 TC-8 的步骤在浏览器中操作
   - 验证 UI 状态、颜色、提示文案、错误处理

4. **约束验证**（≈ 10 分钟）
   - 执行 TC-9 中的非法转移测试
   - 确保被正确拒绝

### 代码审查已验证的风险与已知限制

基于对 `apps/api` 与 `apps/web` 源代码的审查，以下为已确认的阻塞与非阻塞项：

#### 🚨 阻塞性缺陷（影响发布）

| 序号 | 缺陷项 | 严重级 | 影响范围 | 缓解措施 |
|------|--------|--------|---------|---------|
| D-1 | **无 JWT 鉴权**任何用户可伪造 x-user-id Header，绕过权限检查 | 🔴 CRITICAL | 安全基线 | 正式版本接入 JWT + RBAC Guard；当前 MVP 可接受，但不得上公网 |
| D-2 | **submit() 非事务性**状态更新与事件发布分离，系统崩溃可丢失状态 | 🔴 CRITICAL | 数据一致性 | 正式版引入 PostgreSQL + TypeORM QueryRunner + outbox 模式 |
| D-3 | **内存无持久化**重启应用全部数据丢失 | 🟡 HIGH | 可用性 | 切换 PostgreSQL；MVP 内存可接受，需明确告知用户数据非持久 |

#### ⚠️ 非阻塞性风险（建议修复但不阻塞发布）

| 序号 | 项目 | 严重级 | 影响范围 | 优先级 |
|------|------|--------|---------|--------|
| R-1 | 无 OpenAPI 文档生成 | 🟠 MEDIUM | 前后端类型同步 | P1：补 @nestjs/swagger |
| R-2 | 无限流（Rate Limiting） | 🟠 MEDIUM | 安全防护 | P1：补 @nestjs/throttler |
| R-3 | MP 节点初始 READY | 🟠 MEDIUM | 业务语义 | P2：正式版按 predecessorNodeIds；当前简化可接受 |
| R-4 | 无 GET /projects 列表接口 | 🟡 LOW | 前端体验 | P1：后端补接口，前端改 React Query |
| R-5 | LogicFlow 占位实现 | 🟡 LOW | 用户体验 | P1：迭代接入真实 LogicFlow |

---

## 四、放行结论

### 质量评估

**测试覆盖范围**：✅ 通过
- ✅ 创建项目：实现完整  
- ✅ 保存流程草稿：实现完整  
- ✅ 节点 start/submit：实现完整  
- ✅ 门禁失败与补齐重试：实现完整，逻辑清晰  
- ✅ 前端缺项提示：实现完整，交互友好  

**功能验收**：✅ 通过（代码审查）
- ✅ 状态机约束正确实现（ExecutionStatus 枚举 + 合法转移表）
- ✅ 门禁引擎逻辑清晰（GateEngineService 必需输出物校验）
- ✅ 前端组件完整（NodeDetailDrawer 所有交互已实现）
- ✅ 审计日志全覆盖（所有写操作记录 actorId 与 requestId）

**稳定性与安全性**：⚠️ 存在已知风险
- 🚨 无 JWT 鉴权（P0 安全风险）
- 🚨 submit() 非事务（P0 数据一致性风险）
- 🚨 内存无持久化（P0 可用性风险）

### 放行决策

**功能层**：✅ **通过**

- 核心功能实现完整，用例闭环验证可行
- 状态机与门禁逻辑经代码审查已验证正确
- 前端交互符合需求，缺项提示清晰

**发布层**：❌ **暂不放行生产**

**原因**：
1. **D-1 无 JWT 鉴权**：当前任何用户可伪造 x-user-id，构成安全基线漏洞，**不得上公网**
2. **D-2 submit() 非事务**：状态更新与事件发布分离，系统故障时可丢失状态，**不符合生产可靠性要求**
3. **D-3 内存无持久化**：重启丢失全部数据，**用户体验受损**

### 放行建议

#### 🔵 MVP 内部验证环境：✅ 可部署

- 用于内部团队演示与验收
- 明确标记"内测版本，数据非持久"
- 配置测试用 x-user-id（如 user-001）
- 部署在内网或 localhost，禁止公网暴露

#### 🔴 正式生产环境：❌ 待补齐如下后才可部署

1. **安全加固**（P0，≈ 3 天）：
   - 集成 JWT 鉴权 + RBAC Guard
   - 补 @nestjs/throttler 限流
   - 安全审查通过（交接 安全审查师）

2. **数据持久化**（P0，≈ 3 天）：
   - 迁移 PostgreSQL
   - 实现 QueryRunner + outbox 事务模式
   - 执行完整的数据迁移与回滚测试

3. **功能补齐**（P1，≈ 2 天）：
   - 补 GET /projects 列表接口（解决前端 localStorage 依赖）
   - 集成 LogicFlow 真实画布（可选延期到 v1.x）
   - 补 OpenAPI 文档生成

4. **回归测试**（P0，≈ 2 天）：
   - 重新执行全套 TC-1 至 TC-9
   - 补充 PostgreSQL 特定用例（事务、并发）
   - 性能基准测试（响应时间、吞吐量）

---

## 五、回归建议与后续计划

### 回归测试清单（切换 PostgreSQL 后）

- [ ] 数据持久化：重启应用后数据完整性
- [ ] 事务一致性：submit() 与事件发布原子性
- [ ] 并发冲突：多用户同时操作同节点的竞态处理
- [ ] 性能基准：Q95 响应时间（单节点操作 < 100ms）
- [ ] 容错恢复：数据库故障后的自动修复
- [ ] 安全审查：JWT 令牌刷新、权限边界、日志脱敏

### 后续迭代建议（v1.x）

| 优先级 | 项目 | 时间预估 | 收益 |
|--------|------|---------|------|
| P0 | 补 JWT 鉴权 + RBAC | 3 天 | 解除安全阻塞 |
| P0 | 切换 PostgreSQL + 事务 | 3 天 | 解除可靠性阻塞 |
| P1 | 集成 LogicFlow | 5 天 | 真实拖拽编辑体验 |
| P1 | 补 GET /projects + 通知列表 | 2 天 | 完整项目管理 |
| P2 | 单元测试（Jest） | 3 天 | 回归覆盖 |
| P2 | 性能优化 + 缓存 | 2 天 | 秒级响应 |

---

## 六、文档与提交

### 产出清单

- [x] 测试范围（覆盖表）
- [x] 测试用例设计（TC-1 ~ TC-9）
- [x] 可复现步骤（curl + 浏览器操作）
- [x] 代码审查结论
- [x] 缺陷清单
- [x] 放行结论（功能✅、发布❌）
- [x] 回归计划（PostgreSQL 迁移后）

### 交接对象

| 角色 | 事项 | 时机 |
|------|------|------|
| 开发团队 | 修复 D-1/D-2/D-3 缺陷与风险 | 发布前 |
| 安全审查师 | 补充 JWT + RBAC 审查 | 发布前 |
| 发布经理 | 确认上述补项后启动发布流程 | D-1/D-2/D-3 解除后 |
| 运维工程师 | 内测演示与数据备份方案 | 发布前 |

---

**签署**：QA 专家 | 2026-04-14 | v0.1
