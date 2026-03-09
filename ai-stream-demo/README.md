# AI Stream Demo

一个最小化的 **ChatGPT 风格流式对话 Demo**，演示如何用 Node.js 代理 OpenAI 的流式 API 并在浏览器中实现逐字渲染效果。

## 功能特性

- **流式输出（Streaming）** — AI 回复逐字出现，体验与 ChatGPT 一致
- **Markdown 渲染** — 支持标题、列表、表格、引用、行内代码等完整 Markdown 语法
- **代码语法高亮** — 自动识别编程语言并高亮显示，附带语言标签
- **一键复制** — 代码块独立复制按钮 + 整条消息 hover 复制按钮
- **多轮对话** — 前端维护完整对话历史，AI 能"记住"上下文
- **请求中断** — 发送新问题时自动取消上一次未完成的请求
- **XSS 防护** — DOMPurify 白名单消毒，防止 AI 返回的内容执行恶意脚本
- **请求超时** — 后端 60 秒自动断开，防止连接长时间挂起

## 架构概览

```
┌─────────────┐       POST /chat        ┌─────────────────┐      stream: true       ┌──────────────┐
│             │  ───────────────────▶   │                 │  ───────────────────▶   │              │
│   Browser   │                         │  Express Server │                         │  OpenAI API  │
│  (Vanilla   │  ◀─── SSE stream ────  │  (Proxy Layer)  │  ◀─── SSE stream ────  │  (gpt-4o-    │
│   HTML/JS)  │                         │                 │                         │     mini)    │
└─────────────┘                         └─────────────────┘                         └──────────────┘
     │                                         │
     │  fetch + ReadableStream                 │  Node native fetch
     │  逐 chunk 读取 + SSE 解析               │  getReader() 透传
     │  marked.js 渲染 Markdown                │  保护 API Key
     │  highlight.js 代码高亮                   │  错误处理 + 超时控制
     │  DOMPurify 防 XSS                       │
```

### 为什么需要后端代理？

1. **保护 API Key** — 密钥存在服务端 `.env` 文件中，浏览器永远不会接触到
2. **中间层能力** — 可以加限流、鉴权、日志、审计等逻辑
3. **模型可替换** — 换成 Claude、本地 LLM 等只需改 `server.js` 里的一小块代码

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **运行时** | Node.js 18+ | 使用原生 `fetch` 和 `ReadableStream`，无需 `node-fetch` |
| **后端框架** | Express 5 | 处理路由、JSON 解析、静态文件服务 |
| **环境变量** | dotenv | 从 `.env` 文件加载 `OPENAI_API_KEY` |
| **AI 模型** | GPT-4o-mini | OpenAI 最便宜的模型，适合开发测试 |
| **Markdown** | marked.js (CDN) | Markdown → HTML 解析 |
| **代码高亮** | highlight.js (CDN) | 自动语言检测 + GitHub 主题 |
| **安全** | DOMPurify (CDN) | HTML 白名单消毒，防止 XSS |
| **模块系统** | ES Modules | `"type": "module"` + `import/export` |

## 项目结构

```
ai-stream-demo/
├── server.js          # Express 后端 —— 代理 OpenAI 流式 API
├── public/
│   └── index.html     # 前端单页面 —— 对话 UI + 流式渲染 + Markdown
├── .env               # 环境变量（存放 API Key，不会提交到 Git）
├── .gitignore         # 忽略 node_modules/ 和 .env
├── package.json       # 项目配置（ES Module、依赖、启动脚本）
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd ai-stream-demo
npm install
```

### 2. 配置 API Key

```bash
# 编辑 .env 文件，填入你的 OpenAI API Key
echo "OPENAI_API_KEY=sk-your-key-here" > .env
```

### 3. 启动服务

```bash
npm start
```

### 4. 打开浏览器

访问 http://localhost:3000，输入问题，按 **发送** 或 **Ctrl/Cmd + Enter**。

## 核心实现细节

### 流式传输原理

OpenAI 的 `stream: true` 模式使用 **SSE（Server-Sent Events）** 格式逐块返回数据：

```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"你"}}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"好"}}]}

data: [DONE]
```

- 每行以 `data: ` 开头，后跟 JSON
- `delta.content` 包含本次的增量文本（区别于非流式的 `message.content`）
- `data: [DONE]` 标记流结束

### 后端透传（server.js）

后端不解析 SSE 内容，直接用 `ReadableStream` 逐块转发：

```javascript
const reader = upstream.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  res.write(value);  // 原样透传给浏览器
}
```

### 前端流式渲染（index.html）

前端用 `fetch()` + `response.body.getReader()` 读取流，解析 SSE 行：

```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder('utf-8');
let buffer = '';

// 逐 chunk 读取
const { done, value } = await reader.read();
buffer += decoder.decode(value, { stream: true });

// 按换行切分，解析 data: 行
const lines = buffer.split('\n');
buffer = lines.pop(); // 保留不完整的最后一行

for (const line of lines) {
  const data = line.trim().slice('data:'.length).trim();
  const delta = JSON.parse(data).choices[0].delta.content;
  fullContent += delta;
}
```

### Markdown 渲染管线

```
原始文本 ──▶ marked.parse() ──▶ 代码块包装（正则） ──▶ DOMPurify.sanitize() ──▶ safeSetHTML()
                │                      │                        │                       │
           Markdown→HTML         加语言标签 +              白名单过滤              <template>
                                  复制按钮              防止 XSS               安全插入 DOM
```

### 渲染性能优化

使用 `requestAnimationFrame` 节流，每帧（~16ms）最多渲染一次，避免每个 token 都触发 Markdown 解析 + DOM 更新：

```javascript
function scheduleRender(div, fullContent) {
  if (renderPending) return;  // 本帧已有渲染任务，跳过
  renderPending = true;
  requestAnimationFrame(() => {
    safeSetHTML(div, renderMarkdown(fullContent));
    renderPending = false;
  });
}
```

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| API Key 未设置 | 后端返回 `500`，提示 `OPENAI_API_KEY not set` |
| OpenAI 返回错误（401/429等） | 后端返回 `502`，附带错误详情 |
| 请求超时（60秒） | `AbortController` 自动取消上游请求 |
| 流传输中途出错 | 检查 `res.headersSent`，已发头则直接关闭连接 |
| 用户中断请求 | 前端 `AbortController.abort()`，显示 `[已中断]` |
| 网络异常 | 前端 catch 后显示错误信息 |

## 如何切换模型

只需修改 `server.js` 中的请求配置。例如切换到 Claude：

```javascript
// 改 URL
const upstream = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    messages,
    stream: true,
  }),
});

// 前端 SSE 解析逻辑需要适配 Claude 的流格式（event: content_block_delta）
```

## 依赖说明

**后端依赖（npm）：**
- `express` ^5.2 — Web 框架
- `dotenv` ^17.3 — 环境变量加载

**前端依赖（CDN，零安装）：**
- `marked` — Markdown 解析器
- `highlight.js` v11 — 代码语法高亮（GitHub 主题）
- `DOMPurify` v3 — HTML 消毒防 XSS

## License

ISC
