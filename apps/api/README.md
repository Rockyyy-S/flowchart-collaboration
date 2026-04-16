# flowchart-collaboration-api

> 流程图驱动的项目协作平台 — 后端 API (MVP 骨架)
> 技术栈：Node.js 20 + TypeScript + NestJS 10

---

## 快速启动

```bash
cd apps/api

# 安装依赖
npm install

# 开发模式（热重载）
npm run start:dev

# 生产构建
npm run build && npm run start:prod
```

服务默认监听 `http://localhost:3000`，所有接口统一前缀 `/api/v1`。

---

## 鉴权说明（JWT Bearer）

所有非公开接口均要求：

```text
Authorization: Bearer <token>
```

开发环境可通过下述接口签发测试 token：

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-001"}' | jq '.data'
```

返回示例：

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": "1h"
}
```

---

## API 接口概览

| 方法   | 路径                                              | 说明                       |
|--------|---------------------------------------------------|----------------------------|
| POST   | /api/v1/auth/token                                | 签发测试 token（公开）     |
| POST   | /api/v1/projects                                  | 创建项目                   |
| GET    | /api/v1/projects/:projectId/flows/current         | 获取当前流程定义           |
| PUT    | /api/v1/projects/:projectId/flows/draft           | 保存流程草稿（自动建执行） |
| GET    | /api/v1/projects/:projectId/executions            | 查询节点执行列表           |
| POST   | /api/v1/projects/:projectId/documents             | 上传文档（MVP 模拟）       |
| GET    | /api/v1/projects/:projectId/documents             | 查询项目文档列表           |
| POST   | /api/v1/executions/:executionId/start             | 开始节点执行               |
| POST   | /api/v1/executions/:executionId/submit            | 提交并触发门禁校验         |
| GET    | /api/v1/executions/:executionId/gate-result       | 查询门禁结果               |
| POST   | /api/v1/executions/:executionId/artifacts/bind    | 绑定输出物                 |

---

## 端到端核心闭环验证（curl 示例）

### 1. 创建项目

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-001"}' | jq -r '.data.accessToken')

curl -s -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "示例研发项目"}' | jq '.data'
# 记录返回的 projectId
```

### 2. 保存流程草稿（含必需输出物配置）

```bash
curl -s -X PUT http://localhost:3000/api/v1/projects/{projectId}/flows/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "graphJson": {"nodes": [{"id": "node-1", "text": "需求评审"}], "edges": []},
    "nodesConfig": [{
      "nodeId": "node-1",
      "name": "需求评审",
      "requiredArtifacts": [
        {"id": "req-prd", "name": "PRD v1.0", "required": true}
      ]
    }]
  }' | jq '.data'
# 记录返回的 executionId（查询 executions 获取）
```

### 3. 查询节点执行列表，获取 executionId

```bash
curl -s http://localhost:3000/api/v1/projects/{projectId}/executions \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

### 4. 开始节点执行（READY → IN_PROGRESS）

```bash
curl -s -X POST http://localhost:3000/api/v1/executions/{executionId}/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' | jq '.data'
```

### 5a. 不上传文档直接提交（门禁应失败）

```bash
curl -s -X POST http://localhost:3000/api/v1/executions/{executionId}/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"comment": "测试门禁失败"}' | jq '.data'
# 预期：status=NEEDS_FIX, gatePass=false, missingArtifacts=[{requirementId: "req-prd", ...}]
```

### 5b. 上传文档并绑定后再提交（门禁应通过）

```bash
# 上传文档
DOC_ID=$(curl -s -X POST http://localhost:3000/api/v1/projects/{projectId}/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "PRD_v1.0.pdf", "mimeType": "application/pdf", "size": 204800}' | jq -r '.data.documentId')

# 重新开始（NEEDS_FIX → IN_PROGRESS）
curl -s -X POST http://localhost:3000/api/v1/executions/{executionId}/start \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{}'

# 绑定输出物
curl -s -X POST http://localhost:3000/api/v1/executions/{executionId}/artifacts/bind \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"requirementId\": \"req-prd\", \"documentId\": \"$DOC_ID\"}"

# 再次提交
curl -s -X POST http://localhost:3000/api/v1/executions/{executionId}/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"comment": "文档已补齐"}' | jq '.data'
# 预期：status=COMPLETED, gatePass=true, missingArtifacts=[]
```

### 6. 查询门禁结果

```bash
curl -s http://localhost:3000/api/v1/executions/{executionId}/gate-result \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

### 7. 401/403 安全验证

```bash
# 无 token：应返回 401
curl -i -X POST http://localhost:3000/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"no-auth"}'

# 跨项目访问：应返回 403
TOKEN_A=$(curl -s -X POST http://localhost:3000/api/v1/auth/token -H "Content-Type: application/json" -d '{"userId":"user-a"}' | jq -r '.data.accessToken')
TOKEN_B=$(curl -s -X POST http://localhost:3000/api/v1/auth/token -H "Content-Type: application/json" -d '{"userId":"user-b"}' | jq -r '.data.accessToken')

PROJECT_A=$(curl -s -X POST http://localhost:3000/api/v1/projects -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" -d '{"name":"A项目"}' | jq -r '.data.projectId')

curl -i http://localhost:3000/api/v1/projects/$PROJECT_A/documents \
  -H "Authorization: Bearer $TOKEN_B"
```

---

## 统一响应格式

**成功：**

```json
{
  "data": { ... },
  "requestId": "uuid-v4"
}
```

**错误：**

```json
{
  "code": "INVALID_STATE_TRANSITION",
  "message": "当前状态（PENDING）不允许执行开始操作",
  "requestId": "uuid-v4",
  "details": []
}
```

---

## 模块边界说明

```text
src/
├── common/           公共枚举、接口定义、过滤器、拦截器
│   ├── enums/        ExecutionStatus 状态机枚举（前后端共享来源）
│   ├── interfaces/   实体接口定义（替换 DB 时保持不变）
│   ├── filters/      HttpExceptionFilter（统一错误格式）
│   └── interceptors/ RequestIdInterceptor（requestId 注入）
├── shared/           StoreService（内存存储，后续替换为 TypeORM）
├── audit/            AuditService（审计日志，所有写操作必须调用）
├── notifications/    NotificationsService（通知占位，后续接 BullMQ）
├── projects/         POST /projects
├── flows/            GET/PUT /projects/:id/flows/*
├── documents/        POST/GET /projects/:id/documents
└── executions/       状态机 + 门禁引擎 + 执行动作接口
    └── gate-engine.service.ts  门禁校验（可独立扩展规则）
```

---

## 替换为 PostgreSQL（正式版本）

1. 安装 `@nestjs/typeorm typeorm pg`
2. 在 `AppModule` 引入 `TypeOrmModule.forRoot({...})`
3. 将 `StoreService` 中的 `Map<string, T>` 替换为 `@InjectRepository(T) repo: Repository<T>`
4. 上层 Service 方法签名不变，仅修改 CRUD 实现
5. 将 `auditLogs` 数组替换为写 `audit_logs` 表
6. 在 `submit()` 的状态流转中加入 `QueryRunner` 事务边界（含 outbox 事件写入）
