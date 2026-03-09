import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WebSocket 聊天室',
  description: '基于 FastAPI 和 Next.js 的实时聊天室',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} min-h-screen gradient-bg`}>
        {children}
      </body>
    </html>
  );
}
