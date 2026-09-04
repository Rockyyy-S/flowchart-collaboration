import { Injectable, Scope } from '@nestjs/common';
import {
  Team,
  Project,
  ProjectMember,
  FlowDefinition,
  Flowchart,
  NodeExecution,
  ArtifactBinding,
  Document,
  AuditLog,
  NotificationTask,
} from '../common/interfaces/entities.interface';

/**
 * 内存存储服务（MVP 阶段）
 *
 * 替换为 PostgreSQL 的指引：
 * 1. 引入 TypeORM，为每个实体创建 @Entity() 类
 * 2. 将各 Map 替换为对应的 TypeORM Repository（通过 InjectRepository 注入）
 * 3. 上层 Service 方法签名保持不变，仅替换此层的 CRUD 实现
 * 4. 将 auditLogs 数组替换为写 audit_logs 表的逻辑
 */
// Nest 中 Scope.DEFAULT 即单例作用域（SINGLETON 语义）。
@Injectable({ scope: Scope.DEFAULT })
export class StoreService {
  /** 团队主数据 */
  readonly teams: Map<string, Team> = new Map();

  /** 项目主数据 */
  readonly projects: Map<string, Project> = new Map();

  /** 项目成员关系 */
  readonly projectMembers: Map<string, ProjectMember> = new Map();

  /** 流程定义（含草稿与已发布版本） */
  readonly flowDefinitions: Map<string, FlowDefinition> = new Map();

  /** 流程图元数据（独立实体，支持子流程图） */
  readonly flowcharts: Map<string, Flowchart> = new Map();

  /** 节点执行实例（运行态） */
  readonly nodeExecutions: Map<string, NodeExecution> = new Map();

  /** 输出物绑定记录 */
  readonly artifactBindings: Map<string, ArtifactBinding> = new Map();

  /** 文档元数据（对象存储 key 作为指针） */
  readonly documents: Map<string, Document> = new Map();

  /** 审计日志（内存，正式版本落 PostgreSQL audit_logs 表） */
  readonly auditLogs: AuditLog[] = [];

  /** 通知任务队列（占位，正式版本使用 Redis BullMQ） */
  readonly notificationTasks: NotificationTask[] = [];
}
