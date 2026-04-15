import axios, { AxiosError } from 'axios';
import { message } from 'antd';
import type { ApiError } from './types';

/**
 * Axios 实例 —— 统一 API 基础配置
 *
 * MVP 阶段使用 x-user-id 请求头模拟用户身份（与后端约定一致）
 * 正式版本替换为 Authorization: Bearer <JWT>
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    // MVP 身份模拟：固定用户 ID
    'x-user-id': 'user-001',
  },
  timeout: 10000,
});

/**
 * 响应拦截器：解包 { data, requestId } 外层，直接返回 data
 * 并将 HTTP 错误统一格式化后抛出
 */
apiClient.interceptors.response.use(
  (response) => {
    // 后端通过 RequestIdInterceptor 包装为 { data, requestId }
    if (response.data && 'data' in response.data) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error: AxiosError<ApiError>) => {
    const errData = error.response?.data;
    const msg = errData?.message || error.message || '请求失败，请稍后重试';
    message.error(msg);
    return Promise.reject(error);
  },
);

export default apiClient;
