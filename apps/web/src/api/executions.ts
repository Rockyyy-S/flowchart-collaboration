import apiClient from './client';
import type {
  NodeExecution,
  SubmitResult,
  GateResult,
  ArtifactBinding,
} from './types';

/** 查询项目下所有节点执行实例（可按状态过滤） */
export async function getExecutions(
  projectId: string,
  status?: string,
): Promise<NodeExecution[]> {
  const res = await apiClient.get<NodeExecution[]>(
    `/projects/${projectId}/executions`,
    { params: status ? { status } : undefined },
  );
  return res.data;
}

/** 开始节点执行（READY | NEEDS_FIX → IN_PROGRESS） */
export async function startExecution(
  executionId: string,
): Promise<{ executionId: string; status: string; startedAt: string }> {
  const res = await apiClient.post(
    `/executions/${executionId}/start`,
    {},
  );
  return res.data;
}

/** 提交节点完成（IN_PROGRESS → GATE_CHECKING → COMPLETED | NEEDS_FIX） */
export async function submitExecution(
  executionId: string,
  comment?: string,
): Promise<SubmitResult> {
  const res = await apiClient.post<SubmitResult>(
    `/executions/${executionId}/submit`,
    { comment: comment || '' },
  );
  return res.data;
}

/** 查询门禁结果 */
export async function getGateResult(
  executionId: string,
): Promise<GateResult> {
  const res = await apiClient.get<GateResult>(
    `/executions/${executionId}/gate-result`,
  );
  return res.data;
}

/** 绑定输出物（documentId 计入门禁，externalUrl 仅供参考） */
export async function bindArtifact(
  executionId: string,
  requirementId: string,
  documentId: string,
  options?: { suppressErrorToast?: boolean },
): Promise<ArtifactBinding> {
  const res = await apiClient.post<ArtifactBinding>(
    `/executions/${executionId}/artifacts/bind`,
    { requirementId, documentId },
    options,
  );
  return res.data;
}

/**
 * 审核通过上一节点产物，推进到下一节点
 * @param projectId 项目 ID
 * @param nodeId    上一节点（被审核的节点）ID
 * @param nextNodeId 当前节点（审核者所在节点）ID
 */
export async function approveExecution(
  projectId: string,
  nodeId: string,
  nextNodeId: string,
): Promise<void> {
  await apiClient.post(
    `/projects/${projectId}/executions/${nodeId}/approve`,
    { nextNodeId },
  );
}

/**
 * 拒绝上一节点产物，回退流程
 * @param projectId 项目 ID
 * @param nodeId    上一节点（被审核的节点）ID
 * @param nextNodeId 当前节点（审核者所在节点）ID
 * @param reason    拒绝理由（必填）
 */
export async function rejectExecution(
  projectId: string,
  nodeId: string,
  nextNodeId: string,
  reason: string,
): Promise<void> {
  await apiClient.post(
    `/projects/${projectId}/executions/${nodeId}/reject`,
    { nextNodeId, reason },
  );
}
