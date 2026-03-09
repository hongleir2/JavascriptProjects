"""
FastAPI应用主文件
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import init_db, close_db
from api import user_router, chat_router
from services.room_manager import RoomConnectionManager
from config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    - 启动时初始化数据库和WebSocket房间管理器
    - 关闭时清理资源
    """
    # 启动时
    print("🚀 正在启动应用...")
    
    # 初始化数据库
    await init_db()
    print("✅ 数据库初始化完成")
    
    # 初始化房间管理器
    room_manager = RoomConnectionManager()
    await room_manager.init_redis()
    await room_manager.register_pubsub()
    await room_manager.start_listening()
    
    # 存储到应用状态
    app.state.room_manager = room_manager
    print("✅ 房间管理器初始化完成")
    
    print("✅ 应用启动完成")
    
    yield
    
    # 关闭时
    print("🛑 正在关闭应用...")
    
    # 关闭房间管理器
    await room_manager.close()
    
    # 关闭数据库连接
    await close_db()
    
    print("✅ 应用已关闭")


def create_app() -> FastAPI:
    """创建FastAPI应用实例"""
    app = FastAPI(
        title=settings.APP_NAME,
        description="基于FastAPI和Next.js的WebSocket实时聊天室",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",  # Next.js开发服务器
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 注册路由
    app.include_router(user_router)
    app.include_router(chat_router)
    
    # 根路由
    @app.get("/", tags=["健康检查"])
    async def root():
        return {
            "message": "WebSocket ChatRoom API",
            "docs": "/docs",
            "websocket": "/api/v1/room/ws?token=xxx"
        }
    
    @app.get("/health", tags=["健康检查"])
    async def health_check():
        return {"status": "healthy"}
    
    return app


# 创建应用实例
app = create_app()
