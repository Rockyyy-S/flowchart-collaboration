import { ExecutionStatus } from '../enums/execution-status.enum';

/** 团队（多个成员组成，服务于流程图协作） */
export interface Team {
  /** 格式：team-{uuid前8位} */
  id: string;
  /** 团队名称 */
  name: string;
  /** 团队描述（可选） */
  description?: string;
  /** 创建人 ID */
  creatorId: string;
  /** 团队成员 ID 列表（包含创建人） */
  memberIds: string[];
  createdAt: Date;
}

/** 项目主聚合根 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  /** 项目工作空间 ID，用于文档隔离 */
  workspaceId: string;
  /** 绑定的团队 ID（必填，一个项目只属于一个团队） */
  teamId: string;
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
  /**
   * 节点类型：
   * START         - 开始节点（椭圆形，标记流程图/项目开始）
   * END           - 结束节点（同心圆，标记流程图/项目完成）
   * TASK_SIMPLE   - 无分支任务节点（长方形，单人完成）
   * TASK_BRANCH   - 有分支任务节点（长方形双列，多人协作，需子流程图）
   */
  type: 'START' | 'END' | 'TASK_SIMPLE' | 'TASK_BRANCH';
  requiredArtifacts: ArtifactRequirement[];
  /** 执行人列表（用户 ID） */
  assignees?: string[];
  /** 截止时间 */
  dueDate?: Date;
  /** 节点描述 */
  description?: string;
  /** 优先级：LOW | MEDIUM | HIGH | URGENT */
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  /** 预估工时（小时） */
  estimatedHours?: number;
  /** 有分支任务节点关联的子流程图 ID 列表（TASK_BRANCH 节点专用） */
  subFlowchartIds?: string[];
}

/** 流程图元数据实体（独立于 FlowDefinition，支持子流程图关联） */
export interface Flowchart {
  /** 格式：flowchart-{uuid前8位} */
  id: string;
  /** 流程图名称 */
  name: string;
  /** 流程图描述 */
  description?: string;
  /** 所属项目 ID */
  projectId: string;
  /** 负责人用户 ID */
  ownerId: string;
  /** 父流程图 ID（子流程图必填；普通流程图为 undefined） */
  parentFlowchartId?: string;
  /** 产生该子流程图的父节点 ID（子流程图必填；普通流程图为 undefined） */
  parentNodeId?: string;
  /** 节点数量 */
  nodeCount: number;
  /**
   * 流程图状态：
   * 0 - 未开始
   * 1 - 进行中
   * 2 - 已完成
   * 3 - 超过截止时间
   */
  status: 0 | 1 | 2 | 3;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  /** 截止时间 */
  dueAt?: Date;
  /** LogicFlow 兼容的图结构 JSON */
  graphJson: Record<string, unknown>;
  /** 节点静态配置列表 */
  nodesConfig: NodeConfig[];
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
  /** 格式：node-{uuid前8位} */
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
  /** 所属流程图 ID（对应 Flowchart 实体，可选兼容历史数据） */
  flowchartId?: string;
  /** 被下个节点参与者拒绝时的拒绝理由 */
  rejectionReason?: string;
  /** 审核记录（下个节点参与者审核本节点产出时写入） */
  reviewResult?: {
    reviewedBy: string;
    result: 'APPROVED' | 'REJECTED';
    reason?: string;
    reviewedAt: Date;
  };
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
