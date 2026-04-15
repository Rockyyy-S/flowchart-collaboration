import apiClient from './client';
import type { FlowDefinition, UpdateFlowDraftDto } from './types';

/** 获取项目当前流程定义（已发布优先，无则返回草稿） */
export async function getCurrentFlow(projectId: string): Promise<FlowDefinition> {
  const res = await apiClient.get<FlowDefinition>(
    `/projects/${projectId}/flows/current`,
  );
  return res.data;
}

/** 保存流程草稿（并自动为新节点创建执行实例） */
export async function updateFlowDraft(
  projectId: string,
  dto: UpdateFlowDraftDto,
): Promise<FlowDefinition> {
  const res = await apiClient.put<FlowDefinition>(
    `/projects/${projectId}/flows/draft`,
    dto,
  );
  return res.data;
}
