# WebSocket 实时聊天室

基于 **FastAPI** 和 **Next.js** 构建的多人在线实时聊天室应用。

## 📋 目录

- [项目简介](#项目简介)
- [技术栈](#技术栈)
- [功能特性](#功能特性)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [详细教程](#详细教程)
- [API文档](#api文档)
- [部署指南](#部署指南)

---

## 📖 项目简介

本项目是一个完整的 WebSocket 实时聊天室应用，包含用户注册、登录、实时消息通信等功能。支持单进程和分布式（Redis发布订阅）两种部署模式。

### WebSocket 简介

WebSocket 是一种在单个 TCP 连接上进行全双工通信的协议。相比传统 HTTP 请求-响应模式，WebSocket 具有以下优势：

- **实时双向通信**：服务器可以主动推送消息给客户端
- **低延迟**：无需频繁建立连接
- **资源节省**：减少HTTP请求头开销
- **持久连接**：连接建立后保持打开状态

---

## 🛠 技术栈

### 后端
- **FastAPI** - 高性能 Python Web 框架
- **WebSocket** - 实时双向通信
- **SQLAlchemy** - ORM 数据库操作
- **SQLite/aiosqlite** - 异步数据库
- **Redis** - 分布式消息队列（可选）
- **JWT** - 用户认证

### 前端
- **Next.js 14** - React 全栈框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理

---

## ✨ 功能特性

- ✅ 用户注册与登录
- ✅ JWT Token 认证
- ✅ WebSocket 实时通信
- ✅ 在线用户列表实时更新
- ✅ 用户加入/离开通知
- ✅ 消息发送时间显示
- ✅ 响应式 UI 设计
- ✅ 自动重连机制
- ✅ 支持分布式部署（Redis）

---

## 📁 项目结构

```
websocket-chatroom/
├── backend/                    # 后端项目
│   ├── api/                    # API 路由
│   │   ├── __init__.py
│   │   ├── user.py            # 用户相关接口
│   │   └── chat.py            # WebSocket 聊天接口
│   ├── config/                 # 配置文件
│   │   ├── __init__.py
│   │   └── settings.py        # 应用配置
│   ├── db/                     # 数据库
│   │   ├── __init__.py
│   │   └── database.py        # 数据库连接
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   ├── user.py            # 用户ORM模型
│   │   └── chat_user.py       # 聊天用户模型
│   ├── services/               # 业务服务
│   │   ├── __init__.py
│   │   ├── user_service.py    # 用户服务
│   │   └── room_manager.py    # 房间连接管理器
│   ├── utils/                  # 工具类
│   │   ├── __init__.py
│   │   └── security.py        # 安全工具
│   ├── app.py                  # FastAPI 应用
│   ├── main.py                 # 启动入口
│   └── requirements.txt        # Python 依赖
│
├── frontend/                   # 前端项目
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── page.tsx       # 首页
│   │   │   ├── layout.tsx     # 根布局
│   │   │   ├── globals.css    # 全局样式
│   │   │   ├── register/      # 注册页面
│   │   │   ├── login/         # 登录页面
│   │   │   └── chat/          # 聊天室页面
│   │   ├── components/        # React 组件
│   │   ├── hooks/             # 自定义 Hooks
│   │   │   └── useWebSocket.ts
│   │   ├── lib/               # 工具库
│   │   │   └── api.ts         # API 请求
│   │   ├── store/             # 状态管理
│   │   │   ├── auth.ts        # 认证状态
│   │   │   └── chat.ts        # 聊天状态
│   │   └── types/             # TypeScript 类型
│   │       └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── next.config.js
│
└── README.md                   # 项目文档
```

---

## 🚀 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- Redis（可选，用于分布式模式）

### 1. 克隆项目

```bash
git clone <repository-url>
cd websocket-chatroom
```

### 2. 启动后端

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

后端服务将在 http://localhost:8000 启动

访问 http://localhost:8000/docs 查看 API 文档

### 3. 启动前端

```bash
# 新开终端，进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:3000 启动

### 4. 开始使用

1. 访问 http://localhost:3000
2. 点击「注册新账号」创建账户
3. 使用手机号和密码登录
4. 进入聊天室开始聊天！

---

## 📚 详细教程

### 第一步：后端核心实现

#### 1.1 WebSocket 端点定义

在 FastAPI 中创建 WebSocket 端点非常简单：

```python
# api/chat.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    # 验证用户身份
    user_info = get_user_from_token(token)
    if not user_info:
        await websocket.close(code=4001)
        return
    
    # 接受连接
    await websocket.accept()
    
    try:
        while True:
            # 接收消息
            data = await websocket.receive_text()
            # 广播消息
            await broadcast_message(data)
    except WebSocketDisconnect:
        # 处理断开连接
        pass
```

#### 1.2 房间连接管理器

管理所有 WebSocket 连接和消息广播：

```python
# services/room_manager.py
class RoomConnectionManager:
    def __init__(self):
        self._users_info = {}  # 用户信息
        self._local_websockets = {}  # WebSocket连接
    
    async def user_connect(self, user: ChatUser):
        """用户连接"""
        await user.websocket.accept()
        self._users_info[user.phone] = user
        self._local_websockets[user.phone] = user.websocket
    
    async def broadcast(self, message: dict):
        """广播消息给所有用户"""
        for ws in self._local_websockets.values():
            await ws.send_json(message)
```

#### 1.3 JWT 认证

使用 JWT 令牌验证 WebSocket 连接：

```python
# utils/security.py
from jose import jwt

def create_access_token(data: dict) -> str:
    """创建访问令牌"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

def get_user_from_token(token: str) -> dict:
    """从令牌获取用户信息"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except:
        return None
```

### 第二步：前端核心实现

#### 2.1 WebSocket Hook

封装 WebSocket 连接逻辑：

```typescript
// hooks/useWebSocket.ts
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  
  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('Connected');
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };
    
    ws.onclose = () => {
      // 自动重连
      attemptReconnect();
    };
  }, []);
  
  const sendMessage = useCallback((content: string) => {
    wsRef.current?.send(content);
  }, []);
  
  return { connect, sendMessage };
}
```

#### 2.2 状态管理

使用 Zustand 管理聊天状态：

```typescript
// store/chat.ts
import { create } from 'zustand';

interface ChatState {
  messages: ChatMessage[];
  users: string[];
  addMessage: (message: ChatMessage) => void;
  updateUsers: (users: string[]) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  users: [],
  
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },
  
  updateUsers: (users) => {
    set({ users });
  },
}));
```

#### 2.3 消息类型处理

根据不同消息类型更新 UI：

```typescript
const handleMessage = (message: ChatMessage) => {
  switch (message.msg_type) {
    case 'system_room_update_userlist':
      // 更新用户列表
      updateUsers(message.users);
      break;
    
    case 'system_msg_user_login':
    case 'system_msg_user_logout':
    case 'user_send_msg':
      // 添加到消息列表
      addMessage(message);
      break;
  }
};
```

### 第三步：分布式部署（可选）

当需要多进程或多服务器部署时，使用 Redis 发布订阅：

#### 3.1 初始化 Redis

```python
async def init_redis(self):
    self.redis = await aioredis.from_url(REDIS_URL)
    self.pubsub = self.redis.pubsub()
```

#### 3.2 发布消息

```python
async def publish_message(self, user, content):
    event = MessageEvent(
        event_type="user_message",
        username=user.username,
        content=content
    )
    await self.redis.publish("chat:messages", event.json())
```

#### 3.3 订阅消息

```python
async def start_listening(self):
    await self.pubsub.subscribe("chat:messages")
    
    async for message in self.pubsub.listen():
        if message["type"] == "message":
            event = MessageEvent.parse_raw(message["data"])
            await self._broadcast_local(event)
```

---

## 📡 API 文档

### 用户接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/v1/user/register | 用户注册 |
| POST | /api/v1/user/login | 用户登录 |
| GET | /api/v1/user/check-phone/{phone} | 检查手机号 |

### WebSocket 接口

| 路径 | 描述 |
|------|------|
| ws://host/api/v1/room/ws?token=xxx | WebSocket 连接 |

### 消息类型

```typescript
interface ChatMessage {
  msg_type: 
    | 'system_msg_user_login'    // 用户加入
    | 'system_msg_user_logout'   // 用户离开
    | 'user_send_msg'            // 用户消息
    | 'system_room_update_userlist'; // 更新用户列表
  content: string;
  username?: string;
  timestamp?: string;
  users?: string[];
  is_self?: boolean;
}
```

---

## 🌐 部署指南

### 单进程部署

```bash
# 后端
uvicorn app:app --host 0.0.0.0 --port 8000

# 前端
npm run build
npm start
```

### 多进程部署（需要 Redis）

```bash
# 启动 Redis
redis-server

# 后端多进程
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4

# 或使用 Gunicorn
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Docker 部署

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

---

## 📝 注意事项

1. **生产环境安全**
   - 修改 `SECRET_KEY` 为强随机字符串
   - 使用 HTTPS 和 WSS
   - 配置适当的 CORS 策略

2. **性能优化**
   - 使用 Redis 进行分布式部署
   - 配置消息队列限制
   - 添加消息持久化

3. **Windows 注意**
   - 多进程模式可能遇到 `OSError`
   - 需要设置适当的事件循环策略

---

## 📄 License

MIT License
