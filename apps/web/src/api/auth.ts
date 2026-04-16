import apiClient from './client';

export interface IssueTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

/**
 * 开发态签发测试 token。
 * 该接口为公开接口，请求时无需 Authorization。
 */
export async function issueDevToken(userId: string): Promise<IssueTokenResponse> {
  const res = await apiClient.post<IssueTokenResponse>(
    '/auth/token',
    { userId },
    { skipAuth: true },
  );
  return res.data;
}
