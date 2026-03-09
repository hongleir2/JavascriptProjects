/**
 * ============================================================
 * AI Stream Demo — 后端服务
 * ============================================================
 *
 * 核心职责：作为"代理层"，把前端的对话请求转发给 OpenAI，
 * 并将 OpenAI 返回的 SSE（Server-Sent Events）流原样透传给浏览器。
 *
 * 架构示意：
 *   浏览器 ──POST /chat──▶ Express 服务器 ──fetch──▶ OpenAI API
 *   浏览器 ◀──SSE 流────── Express 服务器 ◀──SSE 流── OpenAI API
 *
 * 为什么需要后端代理？
 *   1. 保护 API Key —— 浏览器不能直接暴露密钥
 *   2. 可以做限流、鉴权、日志等中间层逻辑
 *   3. 换模型（Claude / 本地模型）只需要改这个文件
 */

// dotenv/config 会在 import 时自动读取 .env 文件，把里面的变量注入 process.env
// 学习点：这是 ES Module 的用法；CommonJS 用 require('dotenv').config()
import 'dotenv/config';
import express from 'express';

const app = express();
const PORT = 3000;

// express.json() —— 解析请求体中的 JSON，使 req.body 可用
app.use(express.json());

// express.static('public') —— 把 public/ 目录作为静态文件服务
// 学习点：访问 http://localhost:3000/ 时，Express 会自动返回 public/index.html
app.use(express.static('public'));

// ── 健康检查端点 ──
// 学习点：生产环境中，负载均衡器 / K8s 会定期调用此端点确认服务存活
app.get('/health', (_, res) => res.json({ ok: true }));

// ── 核心接口：流式对话代理 ──
// 学习点：为什么用 POST？因为要在 body 里发送完整的对话消息数组
app.post('/chat', async (req, res) => {
  // 从请求体中解构出 messages 数组
  // 学习点：OpenAI 的 Chat Completions API 要求 messages 是
  // [{ role: 'system'|'user'|'assistant', content: '...' }, ...]
  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages must be an array' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  }

  // ── 请求级超时控制 ──
  // 学习点：AbortController 是 Web 标准 API（Node 18+ 原生支持），
  // 传给 fetch 的 signal 可以在超时后自动取消请求，防止长时间挂起
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 60 秒超时

  try {
    // ── 向 OpenAI 发起流式请求 ──
    // 学习点：关键参数 stream: true，让 OpenAI 以 SSE 格式逐块返回内容，
    // 而不是等整个回答生成完再一次性返回
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,  // Bearer Token 认证
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',  // 最便宜的模型，适合开发测试
        messages,
        stream: true,          // ⭐ 开启流式输出
      }),
      signal: controller.signal,
    });

    // ── 处理上游错误 ──
    // 学习点：如果 OpenAI 返回 401（key 无效）、429（限流）等，
    // 先读完错误信息，然后以 502 Bad Gateway 返回给前端
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      console.error('OpenAI error:', upstream.status, text);
      res.status(502).json({ error: 'Upstream error', detail: text });
      return;
    }

    // ── 设置响应头，开始流式传输 ──
    // 学习点：
    //   - Transfer-Encoding: chunked —— 告诉浏览器这是分块传输，不需要 Content-Length
    //   - Cache-Control: no-cache —— 禁止缓存，确保每次都是实时数据
    //   - Connection: keep-alive —— 保持 TCP 连接不断开
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // ── 逐块读取 OpenAI 的响应流，透传给前端 ──
    // 学习点：upstream.body 是一个 ReadableStream（Web Streams API），
    // getReader() 返回的 reader 每次 read() 会得到一个 { done, value } 对象：
    //   - value 是 Uint8Array 类型的二进制数据块
    //   - done 为 true 表示流结束
    const reader = upstream.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;  // 流读完了
      if (value) {
        // res.write() 把数据块原样转发给浏览器
        // 学习点：这里不做任何解析，直接透传 OpenAI 的 SSE 格式数据
        // 每个 chunk 的内容形如：data: {"choices":[{"delta":{"content":"你"}}]}\n\n
        res.write(value);
      }
    }

    // 流结束，关闭响应
    res.end();
  } catch (err) {
    console.error('Proxy error:', err);
    // 学习点：res.headersSent 检查是否已经开始发送响应
    // 如果已经发了 200 头再出错，就不能再发 500 了，只能直接关闭连接
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy error', detail: err.message });
    } else {
      res.end();
    }
  } finally {
    // 学习点：无论成功失败，都要清除定时器，防止内存泄漏
    clearTimeout(timeout);
  }
});

app.listen(PORT, () => {
  console.log(`AI stream demo listening at http://localhost:${PORT}`);
});
