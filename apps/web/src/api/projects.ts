import apiClient from './client';
import type { Project } from './types';

/** 创建项目 */
export async function createProject(name: string): Promise<Project> {
  const res = await apiClient.post<Project>('/projects', { name });
  return res.data;
}
