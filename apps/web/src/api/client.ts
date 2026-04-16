import axios, { AxiosError } from 'axios';
import { message } from 'antd';
import type { ApiError } from './types';
import { getAccessToken } from '../auth/token';

interface AuthAwareRequestConfig {
  skipAuth?: boolean;
  suppressErrorToast?: boolean;
}

export const PRE_AUTH_WRITE_BLOCKED_ERROR_CODE = 'PRE_AUTH_WRITE_BLOCKED';

export interface PreAuthWriteBlockedError extends Error {
  code: typeof PRE_AUTH_WRITE_BLOCKED_ERROR_CODE;
  isPreAuthWriteBlocked: true;
}

export function isPreAuthWriteBlockedError(
  error: unknown,
): error is PreAuthWriteBlockedError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === PRE_AUTH_WRITE_BLOCKED_ERROR_CODE,
  );
}

function createPreAuthWriteBlockedError(): PreAuthWriteBlockedError {
  const error = new Error(
    '请先在右上角获取开发令牌，再执行写操作',
  ) as PreAuthWriteBlockedError;
  error.name = PRE_AUTH_WRITE_BLOCKED_ERROR_CODE;
  error.code = PRE_AUTH_WRITE_BLOCKED_ERROR_CODE;
  error.isPreAuthWriteBlocked = true;
  return error;
}

/**
 * Axios 实例 —— 统一 API 基础配置
 *
 * 当前统一使用 Authorization: Bearer <JWT>
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * 请求拦截器：
 * - 自动注入 Bearer token
 * - 写操作在未登录时提前拦截，避免无意义请求
 */
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  const reqConfig = config as typeof config & AuthAwareRequestConfig;
  const method = (config.method ?? 'get').toLowerCase();
  const isWriteMethod = method !== 'get' && method !== 'head' && method !== 'options';
  const isPublicTokenEndpoint = (config.url ?? '').includes('/auth/token');
  const skipAuth = reqConfig.skipAuth || isPublicTokenEndpoint;

  if (!skipAuth && token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!skipAuth && isWriteMethod && !token) {
    message.warning('请先在右上角获取开发令牌，再执行写操作');
    return Promise.reject(createPreAuthWriteBlockedError());
  }

  return config;
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
    if (isPreAuthWriteBlockedError(error)) {
      return Promise.reject(error);
    }

    const reqConfig = error.config as AuthAwareRequestConfig | undefined;
    const suppressErrorToast = Boolean(reqConfig?.suppressErrorToast);
    const errData = error.response?.data;
    const status = error.response?.status;
    let msg = errData?.message || error.message || '请求失败，请稍后重试';

    if (status === 401) {
      msg = '登录态已失效或未登录，请先在右上角获取开发令牌';
    }
    if (status === 403) {
      msg = errData?.message || '无权限访问该项目，请确认账号与项目成员关系';
    }

    if (!suppressErrorToast) {
      message.error(msg);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
