import apiClient from './client';
import type { Project, ProjectListItem } from './types';

/** 创建项目 */
export async function createProject(name: string): Promise<Project> {
  const res = await apiClient.post<Project>('/projects', { name });
  return res.data;
}

/** 获取当前用户项目列表 */
export async function getMyProjects(): Promise<ProjectListItem[]> {
  const res = await apiClient.get<ProjectListItem[]>('/projects');
  return res.data;
}
