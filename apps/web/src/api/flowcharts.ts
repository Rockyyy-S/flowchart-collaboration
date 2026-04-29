/**
 * 流程图相关 API（对应后端 FlowchartsModule）
 * 路由基路径：/api/v1
 */
import apiClient from './client';
import type { Flowchart } from './types';

/** 获取项目下所有流程图列表 */
export async function getProjectFlowcharts(projectId: string): Promise<Flowchart[]> {
  const res = await apiClient.get<Flowchart[]>(`/projects/${projectId}/flowcharts`);
  return res.data;
}

/** 创建顶层流程图 */
export async function createFlowchart(
  projectId: string,
  dto: { name: string; description?: string },
): Promise<Flowchart> {
  const res = await apiClient.post<Flowchart>(`/projects/${projectId}/flowcharts`, dto);
  return res.data;
}

/** 删除流程图（级联删除子流程图） */
export async function deleteFlowchart(flowchartId: string): Promise<void> {
  await apiClient.delete(`/flowcharts/${flowchartId}`);
}

/** 创建子流程图（绑定到某个有分支节点） */
export async function createSubFlowchart(
  flowchartId: string,
  dto: { name: string; parentNodeId: string },
): Promise<Flowchart> {
  const res = await apiClient.post<Flowchart>(
    `/flowcharts/${flowchartId}/sub-flowcharts`,
    dto,
  );
  return res.data;
}
