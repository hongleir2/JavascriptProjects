'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginUser } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 检查是否刚注册成功
  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess('注册成功！请登录您的账号');
    }
  }, [searchParams]);

  // 如果已登录，跳转到聊天室
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/chat');
    }
  }, [isAuthenticated, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.phone.trim()) {
      setError('请输入手机号码');
      return false;
    }
    if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
      setError('请输入有效的手机号码');
      return false;
    }
    if (!formData.password) {
      setError('请输入密码');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await loginUser({
        phone: formData.phone.trim(),
        password: formData.password,
      });
      
      // 保存认证信息
      setAuth(response.user, response.access_token);
      
      // 跳转到聊天室
      router.push('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查手机号和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">登录聊天室</h1>
          <p className="text-gray-400">使用您的账号登录</p>
        </div>

        {/* 成功提示 */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
              手机号码
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="请输入手机号码"
              className="input-base"
              disabled={loading}
              maxLength={11}
              autoComplete="tel"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="请输入密码"
              className="input-base"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>
        </form>

        {/* 底部链接 */}
        <p className="mt-6 text-center text-gray-400">
          还没有账号？{' '}
          <Link href="/register" className="text-chat-accent hover:underline">
            立即注册
          </Link>
        </p>
      </div>
    </main>
  );
}
