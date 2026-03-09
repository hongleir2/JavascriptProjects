import { LoginRequest, RegisterRequest, TokenResponse, MessageResponse, ApiError } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 通用API请求函数
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail);
  }

  return response.json();
}

/**
 * 用户注册
 */
export async function registerUser(data: RegisterRequest): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/api/v1/user/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 用户登录
 */
export async function loginUser(data: LoginRequest): Promise<TokenResponse> {
  return apiRequest<TokenResponse>('/api/v1/user/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * 检查手机号是否已注册
 */
export async function checkPhoneExists(phone: string): Promise<{ exists: boolean }> {
  return apiRequest<{ exists: boolean }>(`/api/v1/user/check-phone/${phone}`);
}

/**
 * 检查用户名是否已注册
 */
export async function checkUsernameExists(username: string): Promise<{ exists: boolean }> {
  return apiRequest<{ exists: boolean }>(`/api/v1/user/check-username/${username}`);
}

/**
 * 获取在线用户数量
 */
export async function getOnlineCount(): Promise<{ count: number }> {
  return apiRequest<{ count: number }>('/api/v1/room/online-count');
}

/**
 * 获取WebSocket连接URL
 */
export function getWebSocketUrl(token: string): string {
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  return `${WS_URL}/api/v1/room/ws?token=${encodeURIComponent(token)}`;
}
