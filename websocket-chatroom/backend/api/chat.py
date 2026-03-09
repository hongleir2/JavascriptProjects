"""
WebSocket聊天室路由
处理WebSocket连接和消息通信
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Request
from starlette.endpoints import WebSocketEndpoint
from typing import Optional
from models.chat_user import ChatUser, UserDistribute
from services.room_manager import RoomConnectionManager
from utils.security import get_user_from_token

router = APIRouter(prefix="/api/v1/room", tags=["聊天室"])


# ========== WebSocket端点 ==========

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT令牌")
):
    """
    WebSocket聊天室端点
    
    连接URL: ws://host/api/v1/room/ws?token=xxx
    
    消息类型：
    - system_msg_user_login: 用户加入通知
    - system_msg_user_logout: 用户离开通知
    - user_send_msg: 用户消息
    - system_room_update_userlist: 用户列表更新
    """
    # 从应用状态获取房间管理器
    room_manager: RoomConnectionManager = websocket.app.state.room_manager
    
    # 验证令牌
    user_info = get_user_from_token(token)
    if not user_info:
        await websocket.close(code=4001, reason="无效的令牌")
        return
    
    user_id = user_info.get("user_id")
    username = user_info.get("username")
    phone = user_info.get("phone")
    
    if not all([user_id, username, phone]):
        await websocket.close(code=4002, reason="令牌信息不完整")
        return
    
    # 检查用户是否已在线
    if await room_manager.check_user_online(phone):
        await websocket.close(code=4003, reason="用户已在其他设备登录")
        return
    
    # 创建聊天用户对象
    chat_user = ChatUser(
        user_id=user_id,
        username=username,
        phone=phone,
        websocket=websocket
    )
    
    try:
        # 用户连接
        await room_manager.user_connect(chat_user)
        
        # 广播用户加入
        await room_manager.publish_user_login(chat_user)
        
        # 接收消息循环
        while True:
            try:
                # 接收文本消息
                data = await websocket.receive_text()
                
                # 过滤空消息
                if data.strip():
                    # 广播用户消息
                    await room_manager.publish_message(chat_user, data)
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"接收消息错误: {e}")
                break
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket错误: {e}")
    finally:
        # 保存用户信息用于退出通知
        user_distribute = UserDistribute(
            user_id=user_id,
            username=username,
            phone=phone
        )
        
        # 用户断开连接
        await room_manager.user_disconnect(phone)
        
        # 广播用户退出
        await room_manager.publish_user_logout(user_distribute)


# ========== HTTP API ==========

@router.get("/online-users", summary="获取在线用户列表")
async def get_online_users(request: Request):
    """获取当前在线用户列表"""
    room_manager: RoomConnectionManager = request.app.state.room_manager
    users = await room_manager.get_online_users()
    return {
        "count": len(users),
        "users": users
    }


@router.get("/online-count", summary="获取在线人数")
async def get_online_count(request: Request):
    """获取当前在线人数"""
    room_manager: RoomConnectionManager = request.app.state.room_manager
    users = await room_manager.get_online_users()
    return {"count": len(users)}
