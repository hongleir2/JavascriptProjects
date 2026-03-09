"""
WebSocket用户模型
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from fastapi import WebSocket


class ChatUser:
    """
    聊天室用户类
    封装用户信息和WebSocket连接
    """
    def __init__(self, user_id: int, username: str, phone: str, websocket: WebSocket):
        self.user_id = user_id
        self.username = username
        self.phone = phone
        self.websocket = websocket
        self.connected_at = datetime.now()
    
    def to_dict(self) -> dict:
        """转换为字典（不包含websocket）"""
        return {
            "user_id": self.user_id,
            "username": self.username,
            "phone": self.phone,
            "connected_at": self.connected_at.isoformat()
        }


class UserDistribute(BaseModel):
    """
    分布式用户信息（不包含WebSocket连接）
    用于Redis发布订阅
    """
    user_id: int
    username: str
    phone: str


class MessageEvent(BaseModel):
    """
    消息事件模型
    用于Redis发布订阅
    """
    event_type: str  # 消息类型：user_login, user_logout, user_message
    user_id: int
    username: str
    phone: str
    content: Optional[str] = None
    timestamp: str = None
    
    def __init__(self, **data):
        if "timestamp" not in data or data["timestamp"] is None:
            data["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        super().__init__(**data)


class ChatMessage(BaseModel):
    """
    聊天消息模型
    """
    msg_type: str  # system_msg_user_login, system_msg_user_logout, user_send_msg, system_room_update_userlist
    content: str
    username: Optional[str] = None
    phone: Optional[str] = None
    timestamp: str = None
    users: Optional[list] = None  # 用于更新用户列表
    is_self: bool = False  # 是否是自己发送的消息
