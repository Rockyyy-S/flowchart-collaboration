import apiClient from './client';
import type { Project, ProjectListItem } from './types';

/** 创建项目（teamId 为必填，需先创建团队再绑定） */
export async function createProject(
  name: string,
  teamId: string,
  description?: string,
  memberIds?: string[],
): Promise<Project> {
  const res = await apiClient.post<Project>('/projects', {
    name,
    teamId,
    description,
    members: memberIds?.length
      ? memberIds.map((userId) => ({ userId, role: 'MEMBER' as const }))
      : undefined,
  });
  return res.data;
}

/** 获取当前用户项目列表 */
export async function getMyProjects(): Promise<ProjectListItem[]> {
  const res = await apiClient.get<ProjectListItem[]>('/projects');
  return res.data;
}

/**
 * 删除项目（仅 OWNER 可操作，级联删除所有关联数据）
 */
export async function deleteProject(projectId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}`);
}
