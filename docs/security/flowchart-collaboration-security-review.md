# flowchart-collaboration 安全审查报告
> 版本：v0.1 | 日期：2026-04-14 | 角色：安全审查师 | 状态：✅ 已完成 | 类型：MVP 基线安全审查

---

## 一、审查范围与边界

### 1.1 审查对象
- **后端应用**：`apps/api`（NestJS 10 + TypeScript + 内存存储）
- **前端应用**：`apps/web`（React 18 + Vite + TypeScript）
- **文档集合**：需求、架构、实现、测试报告及关键配置

### 1.2 审查维度
| 维度 | 覆盖范围 | 状态 |
|---|---|---|
| 认证与授权 | 身份验证、权限控制、会话管理 | ✅ 已覆盖 |
| 输入校验与错误处理 | 参数校验、异常捕获、错误信息泄露 | ✅ 已覆盖 |
| 文件上传与访问控制 | 文件类型、大小、权限、存储安全 | ✅ 已覆盖 |
| 审计日志完整性 | 操作记录、追踪能力、线索链完整性 | ✅ 已覆盖 |
| 依赖与供应链基础 | 依赖版本、已知漏洞（清单级，非在线扫描） | ✅ 已覆盖 |

### 1.3 审查前置条件
- ✅ 后端 MVP 代码已完成（9 条 API 路由、状态机、门禁引擎、审计日志）
- ✅ 前端 MVP 代码已完成（工作台、流程画布、节点详情、文档上传）
- ✅ QA 测试用例已设计（9 条核心用例，待执行）
- ⚠️ 环境约束：内存存储（非 PostgreSQL）；开发环境未启用 HTTPS；无在线依赖扫描工具

---

## 二、执行摘要

### 2.1 风险总体评分
**安全基线放行意见**：❌ **未通过（发布阻塞）**

| 等级 | 数量 | 影响范围 | 处理优先级 |
|---|---|---|---|
| 🔴 **高危** | 3 | 认证授权、项目访问控制、跨用户数据泄露 | P0 必须解决 |
| 🟠 **中危** | 5 | 文件上传、输入校验、审计日志、错误信息泄露 | P1 上线前解决 |
| 🟡 **低危** | 3 | CORS 配置、HTTPS、依赖更新 | P2 可后续改进 |
| ✅ **绿色** | 1 | 全局参数校验（白名单模式）已正确实现 | 保持 |

### 2.2 关键发现速览
1. **MVP 身份模拟不安全**：硬编码 x-user-id 请求头，任何人可伪造身份，**直接威胁多租户隔离**
2. **无项目级访问控制**：虽然数据模型支持多成员，但 API 无权限检查，**任何认证用户可随意访问其他项目**
3. **文件上传路径不安全**：storageKey 由客户端传入，**可能导致路径遍历或覆盖他人文件**
4. **审计日志无查询接口**：虽然操作已记录，但**无法从外部验证完整性或进行事后审查**
5. **依赖未做安全检查**：`npm audit` 状态未知，**可能隐含已知漏洞**

### 2.3 发布门禁判定
- **功能测试**：✅ 通过（代码审查验证闭环完整）
- **安全门禁**：❌ **未通过**（存在可直接利用的 P0 漏洞）
- **发布建议**：**必须完成高危项修复后方可上线；中危项作为上线前必作清单**

---

## 三、漏洞清单与定级

### 3.1 高危漏洞（P0 - 发布阻塞）

#### 【VUL-01】身份伪造风险 - 硬编码 x-user-id 请求头
**等级**：🔴 **高危**  
**CWE 序号**：CWE-287（Improper Authentication）、CWE-1021（Improper Restriction of Rendered UI Layers）  

**风险说明**：
- 后端使用 `(req.headers['x-user-id'] as string) || 'anonymous'` 作为 actorId，无任何签名验证
- 前端固定传递 `'x-user-id': 'user-001'`
- 任何 HTTP 客户端（curl、Postman、浏览器插件）可任意修改此请求头
- 攻击者可以伪装成任意用户或项目成员，篡改项目数据或审计日志

**受影响范围**：
- 所有 9 条 API 路由（创建、修改、删除项目；启动/提交执行；绑定文件等）
- 审计日志（actorId 可被伪造）
- 多租户隔离（无法保证用户只能看到自己的数据）

**具体场景**：
```bash
# 攻击者可伪装为其他用户
curl -X POST http://localhost:3000/api/v1/projects \
  -H "x-user-id: CEO-user-id"  # 伪造高权限用户
  -H "Content-Type: application/json" \
  -d '{"name": "我的项目"}'

# 可伪装为项目成员进行非法操作
curl -X POST http://localhost:3000/api/v1/executions/exec-id/submit \
  -H "x-user-id: legitimate-member"  # 伪造合法成员
```

**修复优先级**：**必须**（否则无法上线）  
**阻塞发布**：✅ **是**

**修复建议**：
1. **短期（MVP 发布前）**：
   - 后端集成 JWT（JSON Web Token）身份验证
   - 前端登录后获取 JWT，所有请求在 `Authorization: Bearer <token>` 中携带
   - 后端校验 JWT 签名与过期时间，从 token payload 中提取用户身份
   - 移除 x-user-id 请求头的信任链

2. **实现路径**（估时：2-4 小时）：
   ```bash
   # 后端新增依赖
   npm install @nestjs/passport @nestjs/jwt passport-jwt
   
   # 创建 JWT 策略与守卫
   src/auth/jwt.strategy.ts      # 策略验证 & payload 解析
   src/auth/jwt.guard.ts          # 装饰器保护路由
   src/auth/auth.controller.ts    # 登录/注册/发行 token 端点
   ```

3. **前端适配**：
   ```javascript
   // src/api/client.ts
   // 登录后获取 token
   const token = await login(username, password);
   localStorage.setItem('accessToken', token);
   
   // 所有请求自动携带
   apiClient.defaults.headers['Authorization'] = `Bearer ${token}`;
   ```

---

#### 【VUL-02】跨项目数据访问控制缺失
**等级**：🔴 **高危**  
**CWE 序号**：CWE-639（Authorization Bypass Through User-Controlled Key）、CWE-863（Incorrect Authorization）  

**风险说明**：
- 后端服务层虽然存储项目成员关系（`ProjectMember`），但 API 未校验调用者是否为项目成员
- 任何提供有效 x-user-id 的用户可以访问/修改任何 projectId 对应的项目
- 无"所有者"或"项目角色"的权限检查

**受影响范围**：
- `GET /api/v1/projects/:projectId/flows/current`：任何用户可获取他人项目的流程定义
- `PUT /api/v1/projects/:projectId/flows/draft`：任何用户可篡改他人项目的流程规划
- `GET/POST /api/v1/projects/:projectId/documents`：任何用户可上传/查看他人项目的文件
- `GET /api/v1/projects/:projectId/executions`：任何用户可查看他人项目的执行状态
- `POST /api/v1/executions/:executionId/*`：任何用户可启动/提交他人项目的节点

**具体场景**：
```bash
# 用户 A 创建项目 project-123
# 用户 B（无权）即可访问
curl -H "x-user-id: user-B" \
  http://localhost:3000/api/v1/projects/project-123/executions

# 用户 B 可以篡改流程
curl -X PUT -H "x-user-id: user-B" \
  http://localhost:3000/api/v1/projects/project-123/flows/draft \
  -d '{"graphJson": {...}, "nodesConfig": [...]}'
```

**修复优先级**：**必须**（VUL-01 修复后需立即跟进）  
**阻塞发布**：✅ **是**

**修复建议**：
1. **创建 RBAC 守卫**：
   ```typescript
   // src/common/guards/project-rbac.guard.ts
   @Injectable()
   export class ProjectRbacGuard implements CanActivate {
     canActivate(context: ExecutionContext): boolean {
       const request = context.switchToHttp().getRequest();
       const userId = request.user?.id;   // 从 JWT 提取
       const projectId = request.params.projectId;
       
       // 检查用户是否为项目成员
       const member = projectMembers.find(
         m => m.userId === userId && m.projectId === projectId
       );
       
       if (!member) throw new ForbiddenException('无权访问此项目');
       request.user.role = member.role;
       return true;
     }
   }
   ```

2. **在所有项目级路由应用守卫**：
   ```typescript
   @Get(':projectId/flows/current')
   @UseGuards(ProjectRbacGuard)
   getCurrentFlow(@Param('projectId') projectId: string) { ... }
   ```

3. **细化角色权限**：
   - OWNER：创建、编辑流程、管理成员、删除项目
   - MEMBER：查看、启动/提交执行、上传文件
   - VIEWER：只读项目和执行状态

---

#### 【VUL-03】客户端提交的 storageKey 导致路径遍历风险
**等级**：🔴 **高危**  
**CWE 序号**：CWE-22（Improper Limitation of a Pathname to a Restricted Directory）  

**风险说明**：
- 文档上传 DTO 中 `storageKey` 由客户端提供（见 `CreateDocumentDto`）
- 后端直接存储此 key，无路径规范化检查
- 攻击者可提交类似 `../../admin/config.json` 的路径，导致路径遍历

**受影响范围**：
- 文档存储键管理（MVP 阶段仅内存，但已为正式版埋下隐患）
- 切换至 MinIO/OSS 后，此漏洞可导致跨项目文件覆盖、删除或信息泄露

**具体场景**：
```bash
# 攻击者上传文档，注入路径遍历
curl -X POST http://localhost:3000/api/v1/projects/proj-1/documents \
  -H "x-user-id: user-A" \
  -d '{
    "name": "evil.pdf",
    "mimeType": "application/pdf",
    "size": 1000,
    "storageKey": "../../../etc/passwd"  # 路径遍历
  }'
```

**修复优先级**：**必须**  
**阻塞发布**：✅ **是**

**修复建议**：
1. **DTO 中移除 storageKey 字段，改为服务端生成**：
   ```typescript
   // CreateDocumentDto
   // 删除 storageKey 字段
   export class CreateDocumentDto {
     @IsString()
     @IsNotEmpty()
     @MaxLength(200)
     name: string;
     
     // storageKey 字段移除 ↓
   }
   ```

2. **服务端生成安全的存储键**：
   ```typescript
   // documents.service.ts
   create(projectId: string, dto: CreateDocumentDto, actorId: string) {
     const documentId = uuidv4();
     const filename = sanitizeFilename(dto.name);  // 移除特殊字符
     
     // 强制使用规范化路径，禁止客户端干涉
     const storageKey = `${projectId}/${documentId}/v1/${filename}`;
     
     const document: Document = {
       id: documentId,
       projectId,
       name: dto.name,
       mimeType: dto.mimeType,
       size: dto.size,
       storageKey,  // 服务端生成
       version: 1,
       uploadedBy: actorId,
       createdAt: new Date(),
     };
     return document;
   }
   ```

3. **添加文件名清理工具函数**：
   ```typescript
   // src/common/utils/filename-sanitizer.ts
   export function sanitizeFilename(filename: string): string {
     // 移除路径分隔符、特殊字符
     return filename
       .replace(/[\/\\:*?"<>|]/g, '')
       .replace(/^\./g, '')  // 移除开头的点
       .slice(0, 255);  // 限制长度
   }
   ```

---

### 3.2 中危漏洞（P1 - 在线前完成）

#### 【VUL-04】输入校验不完整 - 文件大小与 MIME 类型校验缺失
**等级**：🟠 **中危**  
**CWE 序号**：CWE-434（Unrestricted Upload of File with Dangerous Type）  

**风险说明**：
- `CreateDocumentDto` 中 `size` 和 `mimeType` 仅做基础类型校验，无范围限制
- 客户端可提交 `size: 999999999GB` 或恶意 MIME 类型如 `application/x-executable`
- MVP 阶段虽为内存存储，但正式迁移到 MinIO/OSS 后将导致存储资源耗尽或恶意文件上传

**受影响范围**：
- 文档上传接口（`POST /projects/:projectId/documents`）
- 存储容量管理（无上限检查）
- 恶意文件上传风险

**具体场景**：
```bash
# 攻击者伪造超大文件
curl -X POST http://localhost:3000/api/v1/projects/proj-1/documents \
  -d '{
    "name": "huge.iso",
    "mimeType": "application/x-executable",  # 恶意类型
    "size": 999999999  # 超大文件
  }'
```

**修复优先级**：**上线前完成**  
**阻塞发布**：✅ **是**

**修复建议**：
```typescript
// CreateDocumentDto 添加验证
export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsIn(['application/pdf', 'application/msword', 'text/markdown', 'image/png', 'image/jpeg'])
  mimeType: string;  // 白名单 MIME 类型

  @IsNumber()
  @IsPositive()
  @Max(104857600)  // 100MB 上限
  size: number;
}
```

---

#### 【VUL-05】审计日志无查询接口 - 审计链无法追溯
**等级**：🟠 **中危**  
**CWE 序号**：CWE-778（Insuffficient Logging）  

**风险说明**：
- 后端在内存中记录审计日志（`AuditService.record()`），但无任何查询接口暴露给前端或管理员
- 无法从 API 层检验操作是否被正确记录或追踪历史变更
- 重启应用后审计日志丢失（MVP 内存存储）
- 无法进行事后审查、合规检查或安全事件回溯

**受影响范围**：
- 无法验证某用户是否进行了某项敏感操作
- 无法追踪项目被谁、何时、如何篡改
- 合规审查困难（如 ISO、SOC2 要求的操作追踪）

**修复优先级**：**上线前完成**  
**阻塞发布**：✅ **是**

**修复建议**：
1. **新增审计日志查询接口**（仅 OWNER 可访问）：
   ```typescript
   // audit.controller.ts
   @Get('projects/:projectId/audit-logs')
   @UseGuards(ProjectRbacGuard)
   getAuditLogs(@Param('projectId') projectId: string) {
     return this.auditService.findByProject(projectId);
   }
   ```

2. **在 AuditService 中补充按资源类型查询**：
   ```typescript
   findByProject(projectId: string): AuditLog[] {
     return this.store.auditLogs.filter(
       log => log.payload?.projectId === projectId
     );
   }
   ```

3. **切换 PostgreSQL 后持久化**：迁移至 `audit_logs` 表，保证重启后数据不丢失。

---

#### 【VUL-06】错误响应中未脱敏的内部细节泄露
**等级**：🟠 **中危**  
**CWE 序号**：CWE-209（Information Exposure Through an Error Message）  

**风险说明**：
- `HttpExceptionFilter` 在异常响应中返回完整的错误堆栈或内部实现细节
- 未来若在生产环境中启用详细日志，可能导致代码路径、变量名等信息泄露
- 例如：数据库详细查询错误、系统路径暴露等

**受影响范围**：
- 所有异常响应
- 开发环境中更明显

**修复优先级**：**上线前完成**  
**阻塞发布**：✅ **是**

**修复建议**：
```typescript
// src/common/filters/http-exception.filter.ts DO
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    // 仅在开发环境中记录详细堆栈
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(`Error: ${exception instanceof Error ? exception.message : String(exception)}`);
    } else {
      this.logger.error(exception);
    }
    
    // 返回给客户端的消息：通用错误提示，不含详细信息
    response.status(status).json({
      code,
      message: process.env.NODE_ENV === 'production' 
        ? '服务内部错误，请稍后重试' 
        : errorMessage,  // 开发环境返回详细信息
      requestId,
      details: [],  // 生产环境总是空数组
    });
  }
}
```

---

#### 【VUL-07】submitExecution() 非原子操作 - 状态转移与事件发布不同步
**等级**：🟠 **中危**  
**CWE 序号**：CWE-1025（Comparison Using Wrong Factors）  

**风险说明**：
- `submitExecution()` 分两步执行：
  1. 修改节点状态：IN_PROGRESS → GATE_CHECKING → COMPLETED/NEEDS_FIX
  2. 发布通知事件
- 若在步骤 1 与 2 之间服务崩溃，后继节点解锁逻辑不触发，导致流程停滞
- 审计日志已记录，但实际状态变更失败

**受影响范围**：
- `POST /api/v1/executions/:executionId/submit`
- 多节点流程的后继自动解锁逻辑
- 通知的可靠性

**修复优先级**：**上线前完成**  
**阻塞发布**：✅ **是**

**修复建议**：
1. **改进现有代码（内存版）**：使用 JavaScript async 事务模式
   ```typescript
   submit(executionId: string, dto: SubmitExecutionDto, actorId: string, requestId: string) {
     // 1. 确保状态转移成功
     const execution = this.findById(executionId);
     if (execution.status !== ExecutionStatus.IN_PROGRESS) {
       throw new BadRequestException(...);
     }
     
     // 2. 原子地执行状态转移 + 门禁检查
     const gateResult = this.gateEngine.check(execution);
     execution.status = gateResult.pass ? ExecutionStatus.COMPLETED : ExecutionStatus.NEEDS_FIX;
     execution.gateResult = gateResult;
     execution.completedAt = new Date();
     
     // 3. 记录审计日志（在事务内）
     this.auditService.record({ requestId, actorId, ... });
     
     // 4. 触发后续操作（可靠的通知发送）
     if (gateResult.pass) {
       this.unlockSuccessors(execution.nodeId, execution.projectId);
       this.notificationsService.publishEvent(...);
     }
     
     return execution;
   }
   ```

2. **正式版本（PostgreSQL）**：使用 TypeORM 的 QueryRunner 实现数据库事务
   ```typescript
   async submit(executionId: string, ...) {
     const queryRunner = dataSource.createQueryRunner();
     await queryRunner.connect();
     await queryRunner.startTransaction();
     
     try {
       // 所有 CRUD 在事务内执行
       const execution = await queryRunner.manager.findOne(...);
       // ... 状态转移逻辑 ...
       await queryRunner.commitTransaction();
     } catch (e) {
       await queryRunner.rollbackTransaction();
       throw e;
     } finally {
       await queryRunner.release();
     }
   }
   ```

---

#### 【VUL-08】无速率限制与 DDoS 防护
**等级**：🟠 **中危**  
**CWE 序号**：CWE-770（Allocation of Resources Without Limits）  

**风险说明**：
- 后端未引入 `@nestjs/throttler` 或类似的速率限制模块
- 恶意用户可无限调用 API，导致服务资源耗尽
- 内存存储也会因大量请求占满

**受影响范围**：
- 所有端点都可被滥用（创建大量项目、持续提交执行、上传大量文件）
- 服务可用性

**修复优先级**：**上线前完成**  
**阻塞发布**：✅ **是**

**修复建议**：
```bash
# 后端新增依赖
npm install @nestjs/throttler
```

```typescript
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,   // 60 秒时间窗口
        limit: 100,   // 每个 IP 最多 100 请求
      },
    ]),
    // ... 其他模块 ...
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,  // 全局应用限流守卫
    },
  ],
})
export class AppModule {}
```

---

#### 【VUL-09】前端硬编码用户 ID 与缺乏会话管理
**等级**：🟠 **中危**  
**CWE 序号**：CWE-614（Sensitive Cookie in HTTPS Session Without Secure Attribute）  

**风险说明**：
- 前端在 `src/api/client.ts` 中硬编码 `'x-user-id': 'user-001'`
- 所有前端请求都以此 ID 发送，无会话隔离或用户切换能力
- 多用户场景无法支持

**受影响范围**：
- 前端无法切换用户身份
- 无法支持多用户登陆

**修复优先级**：**上线前完成**  
**阻塞发布**：✅ **是**

**修复建议**：
```typescript
// src/pages/LoginPage.tsx (新增)
export default function LoginPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const handleLogin = async (values) => {
    const response = await apiClient.post('/auth/login', {
      username: values.username,
      password: values.password,
    });
    
    // 保存 token
    localStorage.setItem('accessToken', response.data.token);
    
    // 更新 API 客户端的请求头
    apiClient.defaults.headers['Authorization'] = `Bearer ${response.data.token}`;
    
    navigate('/workbench');
  };
  
  return <Form onFinish={handleLogin}>...</Form>;
}
```

```typescript
// src/api/client.ts 修改
const apiClient = axios.create({ ... });

// 移除硬编码的 x-user-id
// apiClient.defaults.headers['x-user-id'] = 'user-001';  // ❌ 删除

// 动态读取 token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

---

### 3.3 低危问题（P2 - 可后续改进）

#### 【VUL-10】缺少 CORS 显式配置
**等级**：🟡 **低危**  
**CWE 序号**：CWE-942（Permissive Cross-domain Policy with Untrusted Domains）  

**风险说明**：
- 后端未显式配置 CORS，NestJS 默认拒绝跨域请求
- 开发时前端通过 Vite proxy 规避，但生产环境需明确配置
- 无法区分前端域与恶意三方域

**受影响范围**：
- 生产环境的跨域请求（如从 CDN 加载前端，后端 API 不同域）

**修复优先级**：**上线前完成（生产环境）**  
**阻塞发布**：⚠️ **需确认部署架构**

**修复建议**：
```typescript
// src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

#### 【VUL-11】无 HTTPS/TLS 强制
**等级**：🟡 **低危**  
**CWE 序号**：CWE-295（Improper Certificate Validation）  

**风险说明**：
- MVP 开发环境仅 HTTP，传输层无加密
- JWT token、用户数据以明文传播
- 客户端可使用 HTTPS，但后端未配置 HSTS 或强制 HTTPS 跳转

**受影响范围**：
- 生产环境前用户数据传输

**修复优先级**：**生产部署时必须**  
**阻塞发布**：✅ **涉及生产准备**

**修复建议**：
- 生产环境部署在反向代理（Nginx/AWS ALB）后，由反向代理处理 TLS
- 应用返回 HSTS 响应头：
  ```typescript
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  ```

---

#### 【VUL-12】依赖未做定期安全检查
**等级**：🟡 **低危**  
**CWE 序号**：CWE-1021（Improper Restriction of Rendered UI Layers）、CWE-388（Error Handling with Elevated Privilege）  

**风险说明**：
- 后端 package.json 中各依赖版本（NestJS 10、class-validator 0.14 等）未进行 `npm audit` 检查
- 依赖可能存在已披露但未修复的漏洞
- MVP 未接入依赖供应链安全扫描工具（如 Snyk、Dependabot）

**受影响范围**：
- 可能隐含已知漏洞（具体需运行 npm audit 验证）
- 长期维护的安全基线

**修复优先级**：**上线前执行一次；长期定期扫描**  
**阻塞发布**：⚠️ **需根据审计结果判断**

**修复建议**：
```bash
# 立即执行一次审计
cd apps/api
npm audit

# 修复自动修复的漏洞
npm audit fix

# 对于无法自动修复的，需人工评估是否升级依赖或应用补丁

# （可选）集成 GitHub Actions 定期检查
# .github/workflows/npm-audit.yml
name: npm audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm audit
```

---

## 四、风险汇总表

| 编号 | 漏洞名称 | 等级 | 受影响模块 | 阻塞发布 | 修复工作量 | 建议处理方式 |
|---|---|---|---|---|---|---|
| VUL-01 | 身份伪造 - 硬编码 x-user-id | 🔴 | 全部 API | ✅ | 2-4h | **必须上线前修复** |
| VUL-02 | 跨项目访问控制缺失 | 🔴 | 项目级 API | ✅ | 3-5h | **必须上线前修复** |
| VUL-03 | 路径遍历 - storageKey | 🔴 | 文档上传 | ✅ | 1-2h | **必须上线前修复** |
| VUL-04 | 文件校验不完整 | 🟠 | 文档上传 | ✅ | 1h | **必须上线前修复** |
| VUL-05 | 审计日志无查询接口 | 🟠 | 审计模块 | ✅ | 2-3h | **必须上线前修复** |
| VUL-06 | 错误响应泄露内部细节 | 🟠 | 全部 API | ✅ | 1-2h | **必须上线前修复** |
| VUL-07 | submit() 非原子操作 | 🟠 | 执行模块 | ✅ | 2-3h | **必须上线前修复** |
| VUL-08 | 缺乏速率限制 | 🟠 | 全部 API | ✅ | 1-2h | **必须上线前修复** |
| VUL-09 | 前端硬编码用户 ID | 🟠 | 前端 API | ✅ | 2-3h | **必须上线前修复** |
| VUL-10 | 缺少 CORS 配置 | 🟡 | 网络层 | ⚠️ | 0.5h | 生产部署时确认 |
| VUL-11 | 无 HSTS/HTTPS 强制 | 🟡 | 网络层 | ⚠️ | 0.5h | 生产部署时确认 |
| VUL-12 | 依赖未审计 | 🟡 | 供应链 | ⚠️ | 0.5-2h | **上线前执行 npm audit** |

**合计工作量**：18-31 小时（修复所有问题）  
**P0 急迫修复**：9 项（VUL-01~09），估 14-23 小时  
**P1 后续**：CORS、HSTS 等 2-3 小时（依赖部署架构）

---

## 五、测试验证清单

为验证上述漏洞已修复，建议执行以下测试用例：

### 5.1 认证与授权
- [ ] **TC-SEC-01**：尝试伪造 x-user-id，确认被拒绝（需先部署 JWT）
- [ ] **TC-SEC-02**：用户 A 尝试访问用户 B 的项目，确认 403 Forbidden
- [ ] **TC-SEC-03**：低权限用户（VIEWER）尝试修改流程，确认被拒绝
- [ ] **TC-SEC-04**：JWT token 过期后的请求，确认返回 401 Unauthorized

### 5.2 输入校验
- [ ] **TC-SEC-05**：上传 MIME 类型为 `application/x-executable` 的文件，确认被拒绝
- [ ] **TC-SEC-06**：上传超过 100MB 的文件，确认被拒绝
- [ ] **TC-SEC-07**：上传带路径遍历符 `../` 的文件名，确认被规范化或拒绝

### 5.3 审计与追踪
- [ ] **TC-SEC-08**：调用 `GET /projects/:projectId/audit-logs`，确认返回操作记录
- [ ] **TC-SEC-09**：验证审计日志中的 actorId、action、payload 正确无误
- [ ] **TC-SEC-10**：服务重启后，审计日志持久化（限 PostgreSQL 版本）

### 5.4 速率限制
- [ ] **TC-SEC-11**：在 60 秒内发送 150 个请求，确认第 101 个后返回 429 Too Many Requests
- [ ] **TC-SEC-12**：不同用户的请求限流独立（基于 IP 或用户 ID）

### 5.5 错误处理
- [ ] **TC-SEC-13**：触发 500 错误（如：请求不存在的资源），确认返回通用错误消息，不含堆栈
- [ ] **TC-SEC-14**：在生产环境确认 `NODE_ENV=production` 时无详细错误信息

---

## 六、放行意见与建议

### 6.1 安全放行判定
**放行意见**：❌ **未通过 / 发布阻塞**

**理由**：
1. **高危漏洞数量过多（3 项）**：VUL-01、VUL-02、VUL-03 均涉及关键的身份认证、访问控制、文件安全
2. **中危漏洞直接摩天楼天然（6 项）**：其中 5 项（VUL-04~08）是上线必做，1 项（VUL-09）前端亦必做
3. **任何单一高危漏洞都足以导致多租户隔离失效或数据泄露**：无法承受上线风险

**具体阻塞条件**：
- ❌ VUL-01（身份伪造）未修复 → 无法信任任何 API 调用者身份
- ❌ VUL-02（跨项目访问）未修复 → 用户间数据互见，隐私泄露
- ❌ VUL-03（路径遍历）未修复 → 错误版本 MVP 阶段现象不明，但尚未迁移 MinIO/OSS 前必需切断

### 6.2 禁止条款
**以下情况下禁止发布**：
1. 上述 9 项 P0 漏洞任意一项未修复
2. 未执行 `npm audit` 且存在 CRITICAL/HIGH 级别的依赖漏洞
3. QA 测试未完整执行（9 个核心用例 + 5.5 节安全测试）

### 6.3 有条件放行（若客户强行上线）
若客户因时间压力要求"内测先上、生产补齐"，需满足以下条件：
- ✅ 仅 **内测环境**（非生产、非客户环境）
- ✅ **立即冻结功能迭代**，转入 P0 安全修复专项
- ✅ **成立 7 人日安全整改小队**：后端专家（VUL-01~07）+ 前端专家（VUL-09）+ 架构师（VUL-08）
- ✅ **签订合规确认书**：客户确认接受内测安全风险，承诺完成整改前不推向生产
- ✅ **每日下午 17 点进度同步**，设置 72 小时硬截止

---

## 七、安全基线建议与后续计划

### 7.1 短期（MVP 发布前 1 周）
| 任务 | 主责 | 预计时间 | 约束条件 |
|---|---|---|---|
| 实现 JWT + RBAC 守卫 | 后端专家 | 4h | 依赖 VUL-01 解决 |
| 修复 VUL-02~VUL-09 | 后端专家 + 前端专家 | 15-20h | 独立任务，可并行 |
| 执行 npm audit & 修复 | 后端专家 | 1-2h | 依赖包版本兼容性 |
| 安全测试验证（TC-SEC-*） | QA 专家 | 2h | 需所有修复已部署 |

### 7.2 中期（MVP 发布后 1 个月内）
- [ ] 集成 GitHub Actions npm audit 自动检查（Dependabot）
- [ ] 部署 Nginx + SSL/TLS，启用 HSTS
- [ ] 迁移至 PostgreSQL，实现事务与审计日志持久化
- [ ] 引入 API 文档工具（@nestjs/swagger），输出 OpenAPI 以支持前后端类型同步

### 7.3 长期（v1.0+ 后续版本）
- [ ] 接入企业 SSO（OAuth 2.0 / SAML 2.0）
- [ ] 实现端到端加密（TDE），文件存储加密
- [ ] 建立 0 信任架构（Zero Trust）：所有访问需多因素认证
- [ ] 定期安全审计与渗透测试（每季度）
- [ ] OWASP Top 10 完整对标检查

---

## 八、审查人员签名

| 角色 | 姓名 | 日期 | 签名 |
|---|---|---|---|
| 安全审查师 | 待指定 | 2026-04-14 | _ _ _ _ |
| 项目总协调 | 待指定 | - | - |
| 工程主管 | 待指定 | - | - |

**审查完成标记**：✅ 已完成基线安全审查  
**建议发布决策**：❌ **当前状态不建议发布（需完成 P0 整改）**

---

## 附录 A：技术债务与改进路线

### A.1 即将遗留的技术债

| 债务项 | 优先级 | 计划处理时间 | 备注 |
|---|---|---|---|
| 内存存储无持久化（丢失风险） | P0 | 发布后 2w 内 | 切换 PostgreSQL |
| 无 OpenAPI 文档关键 | P1 | 发布后 1 个月 | 接入 @nestjs/swagger |
| LogicFlow 仅列表式占位实现 | P1 | 发布后 1 个月 | 集成真实流程图引擎 |
| 不支持文件真实上传 | P1 | 发布后 1 个月 | 接入 MinIO/OSS |

### A.2 安全模块扩展清单

| 模块 | MVP 状态 | v1.0 目标 | v2.0 计划 |
|---|---|---|---|
| 认证 | 硬编码 x-user-id | JWT + 密码登陆 | SSO + SAML + LDAP |
| 授权 | 无权限检查 | 项目级 RBAC | 细粒度权限（ACL） |
| 审计 | 内存日志 | PostgreSQL 持久化 | 实时审计队列 + ElasticSearch |
| 加密 | HTTP 明文 | HTTPS + TLS | TDE 端到端加密 |
| 防护 | 无限流 | 速率限制 | WAF + DDoS 防护 |

---

**文档结束**  
**版本信息**：v0.1 | 2026-04-14 | 安全审查师
