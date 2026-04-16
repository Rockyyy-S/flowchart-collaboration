import apiClient from './client';
import type { DocumentMeta } from './types';

/** 上传文档（MVP：提交元数据，模拟文件上传）  */
export async function createDocument(
  projectId: string,
  payload: { name: string; mimeType: string; size: number },
  options?: { suppressErrorToast?: boolean },
): Promise<DocumentMeta> {
  const res = await apiClient.post<DocumentMeta>(
    `/projects/${projectId}/documents`,
    payload,
    options,
  );
  return res.data;
}

/** 查询项目文档列表 */
export async function getDocuments(
  projectId: string,
): Promise<DocumentMeta[]> {
  const res = await apiClient.get<DocumentMeta[]>(
    `/projects/${projectId}/documents`,
  );
  return res.data;
}
