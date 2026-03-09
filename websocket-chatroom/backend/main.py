"""
应用启动入口
"""
import uvicorn
from app import app

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # 开发模式下热重载
        # workers=1,  # 单进程模式
        # 多进程模式（需要关闭reload）
        # workers=3,
        # reload=False,
    )
