/**
 * 团队相关 API（对应后端 TeamsModule）
 * 路由基路径：/api/v1/teams
 */
import apiClient from './client';
import type { Team } from './types';

/** 获取当前用户所在的所有团队 */
export async function getMyTeams(): Promise<Team[]> {
  const res = await apiClient.get<Team[]>('/teams');
  return res.data;
}

/** 创建团队 */
export async function createTeam(dto: {
  name: string;
  description?: string;
  memberIds?: string[];
}): Promise<Team> {
  const res = await apiClient.post<Team>('/teams', dto);
  return res.data;
}

/** 获取团队详情（含 memberIds） */
export async function getTeamDetail(teamId: string): Promise<Team> {
  const res = await apiClient.get<Team>(`/teams/${teamId}`);
  return res.data;
}

/** 添加团队成员（仅创建者可操作） */
export async function addTeamMember(teamId: string, memberId: string): Promise<void> {
  await apiClient.post(`/teams/${teamId}/members`, { memberId });
}

/** 移除团队成员（仅创建者可操作） */
export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
  await apiClient.delete(`/teams/${teamId}/members/${memberId}`);
}

/** 删除团队（仅创建者可操作） */
export async function deleteTeam(teamId: string): Promise<void> {
  await apiClient.delete(`/teams/${teamId}`);
}
