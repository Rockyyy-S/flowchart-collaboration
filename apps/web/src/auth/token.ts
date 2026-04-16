// [VUL-13 安全修复] 令牌存储机制已从 localStorage 迁移至 sessionStorage。
// sessionStorage 在标签页关闭后自动清除，减少令牌泄露时间窗口；
// 且不跨标签页共享，可有效隔离会话上下文，满足安全审查要求。
const ACCESS_TOKEN_KEY = 'flowkit_access_token';
const TOKEN_USER_ID_KEY = 'flowkit_token_user_id';
const TOKEN_EVENT = 'flowkit-token-changed';

export interface TokenSnapshot {
  accessToken: string;
  userId?: string;
}

export function getTokenSnapshot(): TokenSnapshot | null {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) {
    return null;
  }

  const userId = sessionStorage.getItem(TOKEN_USER_ID_KEY) ?? undefined;
  return { accessToken, userId };
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokenSnapshot(accessToken: string, userId?: string) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (userId) {
    sessionStorage.setItem(TOKEN_USER_ID_KEY, userId);
  } else {
    sessionStorage.removeItem(TOKEN_USER_ID_KEY);
  }
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function clearTokenSnapshot() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_USER_ID_KEY);
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

export function subscribeTokenChange(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(TOKEN_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(TOKEN_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
