// 用户相关类型
export interface User {
  id: number;
  username: string;
  phone: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  phone: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface MessageResponse {
  success: boolean;
  message: string;
}

// 聊天消息类型
export interface ChatMessage {
  msg_type: 'system_msg_user_login' | 'system_msg_user_logout' | 'user_send_msg' | 'system_room_update_userlist';
  content: string;
  username?: string;
  phone?: string;
  timestamp?: string;
  users?: string[];
  is_self?: boolean;
}

// WebSocket状态
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// 聊天室状态
export interface ChatState {
  messages: ChatMessage[];
  users: string[];
  status: WebSocketStatus;
  error: string | null;
}

// API响应
export interface ApiError {
  detail: string;
}

export interface OnlineUsersResponse {
  count: number;
  users: {
    username: string;
    phone: string;
  }[];
}
