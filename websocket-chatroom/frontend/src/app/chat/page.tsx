'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { useWebSocket } from '@/hooks/useWebSocket';

export default function ChatPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { user, token, isAuthenticated, logout } = useAuthStore();
  const { messages, users, status, error } = useChatStore();
  const { connect, disconnect, sendMessage } = useWebSocket();
  
  const [inputValue, setInputValue] = useState('');

  // 检查登录状态
  useEffect(() => {
    if (!isAuthenticated || !token) {
      router.push('/login');
    }
  }, [isAuthenticated, token, router]);

  // 连接WebSocket
  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;
    
    const sent = sendMessage(content);
    if (sent) {
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  // 按回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 退出登录
  const handleLogout = () => {
    disconnect();
    logout();
    router.push('/');
  };

  // 状态指示器
  const StatusIndicator = () => {
    const statusConfig = {
      connecting: { color: 'bg-yellow-500', text: '连接中...' },
      connected: { color: 'bg-green-500', text: '已连接' },
      disconnected: { color: 'bg-gray-500', text: '已断开' },
      error: { color: 'bg-red-500', text: '连接错误' },
    };
    
    const config = statusConfig[status];
    
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className={`w-2 h-2 rounded-full ${config.color} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
        <span className="text-gray-400">{config.text}</span>
      </div>
    );
  };

  // 渲染消息
  const renderMessage = (msg: typeof messages[0], index: number) => {
    if (msg.msg_type === 'system_msg_user_login' || msg.msg_type === 'system_msg_user_logout') {
      return (
        <div key={index} className="message-system">
          {msg.content}
        </div>
      );
    }
    
    if (msg.msg_type === 'user_send_msg') {
      const isSelf = msg.is_self;
      return (
        <div key={index} className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-3`}>
          <div className={isSelf ? 'message-self' : 'message-other'}>
            <div className="text-sm">{msg.content}</div>
            {msg.timestamp && (
              <div className={`text-xs mt-1 ${isSelf ? 'text-white/60' : 'text-gray-400'}`}>
                {msg.timestamp}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen flex">
      {/* 侧边栏 - 用户列表 */}
      <aside className="w-64 bg-chat-sidebar border-r border-gray-800 flex flex-col">
        {/* 用户信息 */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-chat-accent/20 rounded-full flex items-center justify-center">
              <span className="text-chat-accent font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">{user?.username}</div>
              <StatusIndicator />
            </div>
          </div>
        </div>

        {/* 在线用户列表 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <span>在线用户</span>
              <span className="px-2 py-0.5 bg-chat-accent/20 text-chat-accent text-xs rounded-full">
                {users.length}
              </span>
            </h3>
            <ul className="space-y-2">
              {users.map((username, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-chat-message/50 transition-colors"
                >
                  <span className="pulse-dot" />
                  <span className="text-gray-300 text-sm truncate">
                    {username}
                    {username === user?.username && (
                      <span className="text-gray-500 ml-1">(我)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 退出按钮 */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-chat-message rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            退出登录
          </button>
        </div>
      </aside>

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <header className="h-16 bg-chat-sidebar border-b border-gray-800 flex items-center px-6">
          <h1 className="text-xl font-bold text-white">💬 聊天室</h1>
        </header>

        {/* 错误提示 */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
            <button
              onClick={connect}
              className="ml-4 text-chat-accent hover:underline"
            >
              重新连接
            </button>
          </div>
        )}

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-4">👋</div>
                <p>欢迎加入聊天室！</p>
                <p className="text-sm mt-1">发送消息开始聊天吧</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => renderMessage(msg, index))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 输入区域 */}
        <div className="p-4 bg-chat-sidebar border-t border-gray-800">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={status === 'connected' ? '输入消息...' : '等待连接...'}
              disabled={status !== 'connected'}
              className="input-base flex-1"
              autoComplete="off"
            />
            <button
              onClick={handleSend}
              disabled={status !== 'connected' || !inputValue.trim()}
              className="btn-primary px-6"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
