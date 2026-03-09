'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl } from '@/lib/api';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { ChatMessage } from '@/types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const maxReconnectAttempts = 5;

  const token = useAuthStore((state) => state.token);
  const { addMessage, updateUsers, setStatus, setError, reset } = useChatStore();

  // 连接WebSocket
  const connect = useCallback(() => {
    if (!token) {
      setError('未登录');
      return;
    }

    // 如果已经连接，不重复连接
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // 防止 StrictMode 下重复连接
    if (isConnectingRef.current) {
      return;
    }
    isConnectingRef.current = true;

    // 清理旧连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');
    const wsUrl = getWebSocketUrl(token);
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket连接成功');
        setStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: ChatMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error('解析消息失败:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket错误:', error);
        setStatus('error');
        setError('连接错误');
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket断开:', event.code, event.reason);
        setStatus('disconnected');
        isConnectingRef.current = false;

        // 处理特殊关闭码
        if (event.code === 4001) {
          setError('令牌无效，请重新登录');
          return;
        }
        if (event.code === 4002) {
          setError('令牌信息不完整，请重新登录');
          return;
        }
        if (event.code === 4003) {
          setError('您已在其他设备登录');
          return;
        }

        // 尝试重连
        attemptReconnect();
      };
    } catch (error) {
      console.error('创建WebSocket失败:', error);
      setStatus('error');
      setError('创建连接失败');
      isConnectingRef.current = false;
    }
  }, [token, setStatus, setError]);

  // 处理消息
  const handleMessage = useCallback((message: ChatMessage) => {
    switch (message.msg_type) {
      case 'system_room_update_userlist':
        // 更新用户列表
        if (message.users) {
          updateUsers(message.users);
        }
        break;
      
      case 'system_msg_user_login':
      case 'system_msg_user_logout':
      case 'user_send_msg':
        // 添加消息到列表
        addMessage(message);
        break;
      
      default:
        console.log('未知消息类型:', message);
    }
  }, [addMessage, updateUsers]);

  // 尝试重连
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError('连接失败，请刷新页面重试');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    console.log(`⏳ ${delay / 1000}秒后尝试重连...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, delay);
  }, [connect, setError]);

  // 发送消息
  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(content);
      return true;
    }
    console.warn('WebSocket未连接');
    return false;
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectingRef.current = false;
    reset();
  }, [reset]);

  // 清理
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      isConnectingRef.current = false;
    };
  }, []);

  return {
    connect,
    disconnect,
    sendMessage,
  };
}
