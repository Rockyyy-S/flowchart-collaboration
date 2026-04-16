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
