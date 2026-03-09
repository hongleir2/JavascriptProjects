# JavaScript Projects

A collection of full-stack demo projects exploring different web technologies — WebSocket, WebRTC, Docker, AI streaming, and more.

## Projects

### [websocket-chatroom](./websocket-chatroom)

A real-time multi-user chatroom with user registration/login and live messaging. Supports single-process and distributed (Redis Pub/Sub) deployment.

| Layer | Stack |
|-------|-------|
| Backend | FastAPI, SQLAlchemy (async), SQLite, JWT, Redis |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Zustand |
| Protocol | WebSocket |

### [webrtc-videocall](./webrtc-videocall)

A 1v1 video call app with collaborative whiteboard, AI virtual backgrounds (MediaPipe), live speech captions, and screen sharing.

| Layer | Stack |
|-------|-------|
| Backend | Node.js WebSocket signaling server |
| Frontend | React 19, TypeScript, Vite 7, MUI, Tailwind CSS |
| Protocol | WebRTC (P2P) + WebSocket (signaling) |

### [ai-stream-demo](./ai-stream-demo)

A ChatGPT-style streaming chat UI that proxies OpenAI's API with real-time Markdown rendering, code highlighting, and multi-turn conversation support.

| Layer | Stack |
|-------|-------|
| Backend | Node.js, Express, OpenAI API |
| Frontend | Vanilla HTML/JS, marked.js, highlight.js, DOMPurify |
| Protocol | Server-Sent Events (SSE) |

### [DockerPractice](./DockerPractice)

A Docker learning project demonstrating containerization of a Node.js + Express + MongoDB app using both manual Docker CLI and Docker Compose.

| Layer | Stack |
|-------|-------|
| Backend | Node.js, Express, MongoDB |
| DevOps | Docker, Docker Compose |

### [interview-questions](./interview-questions)

Frontend interview coding exercises. Currently contains a HeyGen take-home: a React task board (Kanban) with search, sprint management, and CRUD operations.

| Layer | Stack |
|-------|-------|
| Frontend | React 19, TypeScript, Tailwind CSS, Zustand |
| Mock API | json-server |
