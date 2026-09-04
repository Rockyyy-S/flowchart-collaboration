/* eslint-disable no-console */
/**
 * 开发态种子数据脚本（通过 HTTP API 注入）
 * 运行前请确保本地 API 已启动。
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`seed request failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const tokenResp = await requestJson<any>(`${API_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'seed-admin' }),
  });

  const accessToken = tokenResp.data.accessToken as string;

  const teamResp = await requestJson<any>(`${API_BASE}/teams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Seed Team',
      description: '开发态种子团队',
      memberIds: ['seed-user-1', 'seed-user-2'],
    }),
  });

  await requestJson<any>(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Seed Project',
      description: '开发态种子项目',
      teamId: teamResp.data.teamId,
      members: [{ userId: 'seed-user-1', role: 'MEMBER' }],
    }),
  });

  console.log('seed success: 已创建 Seed Team 与 Seed Project');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
