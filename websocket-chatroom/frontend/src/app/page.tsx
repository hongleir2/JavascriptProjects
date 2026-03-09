'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // 如果已登录，跳转到聊天室
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/chat');
    }
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo/标题区域 */}
        <div className="mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-chat-accent/20 rounded-2xl mb-6">
            <svg
              className="w-10 h-10 text-chat-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-gradient">WebSocket</span>
            <br />
            <span className="text-white">实时聊天室</span>
          </h1>
          <p className="text-gray-400 text-lg">
            基于 FastAPI 和 Next.js 构建的多人在线聊天应用
          </p>
        </div>

        {/* 功能特点 */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="card p-4">
            <div className="text-chat-accent text-2xl mb-2">⚡</div>
            <div className="text-sm text-gray-400">实时通信</div>
          </div>
          <div className="card p-4">
            <div className="text-chat-accent text-2xl mb-2">👥</div>
            <div className="text-sm text-gray-400">多人聊天</div>
          </div>
          <div className="card p-4">
            <div className="text-chat-accent text-2xl mb-2">🔒</div>
            <div className="text-sm text-gray-400">安全认证</div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-4">
          <Link href="/login" className="btn-primary block w-full text-center">
            登录聊天室
          </Link>
          <Link href="/register" className="btn-secondary block w-full text-center">
            注册新账号
          </Link>
        </div>

        {/* 底部信息 */}
        <p className="mt-12 text-gray-500 text-sm">
          使用 WebSocket 技术实现低延迟实时通信
        </p>
      </div>
    </main>
  );
}
