import { ExecutionStatus } from '../enums/execution-status.enum';

/** 项目主聚合根 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  /** 项目工作空间 ID，用于文档隔离 */
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 项目成员与角色关系 */
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
}

/** 输出物要求（节点静态配置的一部分） */
export interface ArtifactRequirement {
  /** 在 flow 范围内稳定唯一，一经创建不允许删除重建 */
  id: string;
  nodeId: string;
  name: string;
  required: boolean;
  sourceType: 'DOCUMENT' | 'ANY';
}

/** 节点静态配置（随 FlowDefinition 版本存储） */
export interface NodeConfig {
  nodeId: string;
  name: string;
  type: string;
  requiredArtifacts: ArtifactRequirement[];
}

/** 流程定义（含草稿与已发布版本） */
export interface FlowDefinition {
  id: string;
  projectId: string;
  version: number;
  /** LogicFlow 兼容的图结构 JSON */
  graphJson: Record<string, unknown>;
  nodesConfig: NodeConfig[];
  publishStatus: 'DRAFT' | 'PUBLISHED';
  createdAt: Date;
  updatedAt: Date;
}

/** 门禁缺项描述 */
export interface MissingArtifact {
  requirementId: string;
  name: string;
}

/** 门禁校验结果 */
export interface GateResult {
  pass: boolean;
  checkedAt: Date;
  missingArtifacts: MissingArtifact[];
}

/** 节点执行实例（运行态） */
export interface NodeExecution {
  id: string;
  projectId: string;
  flowDefinitionId: string;
  flowVersion: number;
  nodeId: string;
  nodeName: string;
  status: ExecutionStatus;
  assignees: string[];
  dueAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  gateResult?: GateResult;
  /** 前置节点 nodeId 列表，用于自动解锁 PENDING 节点 */
  predecessorNodeIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 输出物绑定记录
 * documentId 计入门禁，externalUrl 仅供参考（架构约束：外链不参与门禁）
 */
export interface ArtifactBinding {
  id: string;
  nodeExecutionId: string;
  requirementId: string;
  /** 平台内文档 ID，门禁唯一认可的绑定类型 */
  documentId?: string;
  /** 外部链接（Figma/Confluence 等），不计入门禁 */
  externalUrl?: string;
  boundAt: Date;
  boundBy: string;
}

/** 文档元数据（对象存储文件描述，MVP 不实际存储二进制） */
export interface Document {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  /** 对象存储路径，格式：/{projectId}/{documentId}/v{n}/{filename} */
  storageKey: string;
  version: number;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 审计日志（所有写操作必须落此记录） */
export interface AuditLog {
  id: string;
  projectId: string;
  requestId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

/** 通知任务（MVP 占位，正式版本使用 Redis Queue） */
export interface NotificationTask {
  id: string;
  eventType: string;
  channel: 'IN_APP' | 'EMAIL';
  receiver: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  retryCount: number;
  payload?: Record<string, unknown>;
  createdAt: Date;
}
