/**
 * 节点执行状态枚举（与后端 ExecutionStatus 保持一致）
 * 来源：apps/api/src/common/enums/execution-status.enum.ts
 */
export type ExecutionStatus =
  | 'PENDING'       // 待启动
  | 'READY'         // 可开始
  | 'IN_PROGRESS'   // 进行中
  | 'GATE_CHECKING' // 门禁检查中
  | 'COMPLETED'     // 已完成
  | 'NEEDS_FIX';    // 待补齐

/** 项目 */
export interface Project {
  projectId: string;
  workspaceId: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  defaultFlowDefinitionId: string;
  createdAt: string;
}

/** 本地持久化的项目摘要（降级到 localStorage 时使用） */
export interface ProjectSummary {
  projectId: string;
  name: string;
  createdAt: string;
}

/** 项目进度摘要 */
export interface ProjectProgress {
  totalNodes: number;
  completedNodes: number;
  inProgressNodes: number;
}

/** 项目列表项（GET /api/v1/projects 返回） */
export interface ProjectListItem {
  projectId: string;
  name: string;
  description?: string;
  status: string;
  role: 'OWNER' | 'MEMBER' | 'VIEWER';
  createdAt: string;
  updatedAt: string;
  progress: ProjectProgress;
}

/** 输出物要求 */
export interface ArtifactRequirement {
  id: string;
  nodeId: string;
  name: string;
  required: boolean;
  sourceType: 'DOCUMENT' | 'ANY';
}

/** 节点静态配置 */
export interface NodeConfig {
  nodeId: string;
  name: string;
  requiredArtifacts: ArtifactRequirement[];
  predecessorNodeIds?: string[];
}

/** 流程图节点定义（graphJson 中） */
export interface GraphNode {
  id: string;
  text: string;
  x?: number;
  y?: number;
}

/** 流程图边定义（graphJson 中） */
export interface GraphEdge {
  source: string;
  target: string;
}

/** 流程定义 */
export interface FlowDefinition {
  id: string;
  projectId: string;
  version: number;
  publishStatus: 'DRAFT' | 'PUBLISHED';
  graphJson: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  nodesConfig: NodeConfig[];
  updatedAt: string;
}

/** 缺失输出物 */
export interface MissingArtifact {
  requirementId: string;
  name: string;
}

/** 门禁结果 */
export interface GateResult {
  pass: boolean;
  checkedAt: string;
  missingArtifacts: MissingArtifact[];
}

/** 节点执行实例 */
export interface NodeExecution {
  executionId: string;
  nodeId: string;
  nodeName: string;
  status: ExecutionStatus;
  assignees: string[];
  dueAt?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

/** 节点执行实例（含门禁结果，用于提交响应） */
export interface SubmitResult {
  executionId: string;
  status: ExecutionStatus;
  gatePass: boolean;
  missingArtifacts: MissingArtifact[];
  completedAt?: string;
}

/** 文档元数据 */
export interface DocumentMeta {
  documentId: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  version: number;
  storageKey: string;
  createdAt: string;
}

/** 输出物绑定结果 */
export interface ArtifactBinding {
  bindingId: string;
  nodeExecutionId: string;
  requirementId: string;
  documentId?: string;
  externalUrl?: string;
  createdAt: string;
}

/** 通用 API 包装响应 */
export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

/** API 错误响应格式 */
export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: unknown[];
}

/** 保存流程草稿请求体 */
export interface UpdateFlowDraftDto {
  graphJson: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  nodesConfig: Array<{
    nodeId: string;
    name: string;
    requiredArtifacts: Array<{
      id: string;
      name: string;
      required: boolean;
      sourceType?: 'DOCUMENT' | 'ANY';
    }>;
    predecessorNodeIds?: string[];
  }>;
}
