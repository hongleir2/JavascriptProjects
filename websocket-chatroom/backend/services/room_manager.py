"""
WebSocket房间连接管理器
支持单进程和分布式（Redis发布订阅）模式
"""
import json
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import WebSocket
import redis.asyncio as aioredis
from models.chat_user import ChatUser, UserDistribute, MessageEvent, ChatMessage
from config.settings import settings


class RoomConnectionManager:
    """
    房间连接管理器
    管理WebSocket连接、用户状态和消息广播
    """
    
    # Redis频道名称
    CHANNEL_USER_LOGIN = "chat:system_msg_user_login"
    CHANNEL_USER_LOGOUT = "chat:system_msg_user_logout"
    CHANNEL_USER_MESSAGE = "chat:user_send_msg"
    CHANNEL_UPDATE_USERLIST = "chat:system_room_update_userlist"
    
    def __init__(self):
        # 存储用户信息（不含WebSocket）- 用于分布式共享
        self._users_info: Dict[str, UserDistribute] = {}
        # 存储本进程中的WebSocket连接
        self._local_websockets: Dict[str, WebSocket] = {}
        # Redis客户端
        self.redis: Optional[aioredis.Redis] = None
        # 发布订阅对象
        self.pubsub: Optional[aioredis.client.PubSub] = None
        # 是否使用分布式模式
        self.distributed_mode = False
    
    async def init_redis(self):
        """初始化Redis连接（用于分布式模式）"""
        try:
            self.redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis.ping()
            self.distributed_mode = True
            print("✅ Redis连接成功，启用分布式模式")
        except Exception as e:
            print(f"⚠️ Redis连接失败，使用单进程模式: {e}")
            self.distributed_mode = False
    
    async def register_pubsub(self):
        """注册发布订阅"""
        if not self.distributed_mode or not self.redis:
            return
        
        self.pubsub = self.redis.pubsub()
    
    async def start_listening(self):
        """开始监听订阅频道"""
        if not self.distributed_mode or not self.pubsub:
            return
        
        # 订阅频道
        await self.pubsub.subscribe(
            self.CHANNEL_USER_LOGIN,
            self.CHANNEL_USER_LOGOUT,
            self.CHANNEL_USER_MESSAGE,
            self.CHANNEL_UPDATE_USERLIST
        )
        
        # 创建异步任务监听消息
        asyncio.create_task(self._listen_messages())
    
    async def _listen_messages(self):
        """监听Redis频道消息"""
        if not self.pubsub:
            return
        
        try:
            async for message in self.pubsub.listen():
                if message["type"] != "message":
                    continue
                
                channel = message["channel"]
                data = message["data"]
                
                try:
                    event = MessageEvent.parse_raw(data)
                    await self._handle_channel_message(channel, event)
                except Exception as e:
                    print(f"处理消息失败: {e}")
        except Exception as e:
            print(f"监听消息异常: {e}")
    
    async def _handle_channel_message(self, channel: str, event: MessageEvent):
        """处理频道消息"""
        if channel == self.CHANNEL_USER_LOGIN:
            await self._broadcast_user_login_local(event)
            await self._broadcast_userlist_local()
        elif channel == self.CHANNEL_USER_LOGOUT:
            await self._broadcast_user_logout_local(event)
            await self._broadcast_userlist_local()
        elif channel == self.CHANNEL_USER_MESSAGE:
            await self._broadcast_message_local(event)
        elif channel == self.CHANNEL_UPDATE_USERLIST:
            await self._broadcast_userlist_local()
    
    # ========== 用户管理 ==========
    
    async def user_connect(self, user: ChatUser):
        """用户连接"""
        phone = user.phone

        # 保存用户信息到本地
        self._users_info[phone] = UserDistribute(
            user_id=user.user_id,
            username=user.username,
            phone=user.phone
        )

        # 保存本地WebSocket连接
        self._local_websockets[phone] = user.websocket

        # 分布式模式：同步用户到 Redis
        if self.distributed_mode and self.redis:
            user_data = {
                "user_id": user.user_id,
                "username": user.username,
                "phone": user.phone
            }
            await self.redis.hset("chat:online_users", phone, json.dumps(user_data))

        # 接受WebSocket连接
        await user.websocket.accept()
    
    async def user_disconnect(self, phone: str):
        """用户断开连接"""
        # 移除用户信息
        if phone in self._users_info:
            del self._users_info[phone]

        # 移除本地WebSocket
        if phone in self._local_websockets:
            del self._local_websockets[phone]

        # 分布式模式：从 Redis 移除用户
        if self.distributed_mode and self.redis:
            await self.redis.hdel("chat:online_users", phone)
    
    async def check_user_online(self, phone: str) -> bool:
        """检查用户是否在线"""
        if self.distributed_mode and self.redis:
            return await self.redis.hexists("chat:online_users", phone)
        return phone in self._users_info

    async def get_online_users(self) -> List[dict]:
        """获取在线用户列表"""
        if self.distributed_mode and self.redis:
            users_data = await self.redis.hgetall("chat:online_users")
            return [
                {"username": json.loads(data)["username"], "phone": phone}
                for phone, data in users_data.items()
            ]
        return [
            {"username": user.username, "phone": user.phone}
            for user in self._users_info.values()
        ]

    async def get_online_usernames(self) -> List[str]:
        """获取在线用户名列表"""
        if self.distributed_mode and self.redis:
            users_data = await self.redis.hgetall("chat:online_users")
            return [json.loads(data)["username"] for data in users_data.values()]
        return [user.username for user in self._users_info.values()]
    
    # ========== 消息广播（分布式模式） ==========
    
    async def publish_user_login(self, user: ChatUser):
        """发布用户登录消息"""
        event = MessageEvent(
            event_type="user_login",
            user_id=user.user_id,
            username=user.username,
            phone=user.phone
        )
        
        if self.distributed_mode and self.redis:
            await self.redis.publish(self.CHANNEL_USER_LOGIN, event.json())
        else:
            await self._broadcast_user_login_local(event)
            await self._broadcast_userlist_local()
    
    async def publish_user_logout(self, user_info: UserDistribute):
        """发布用户退出消息"""
        event = MessageEvent(
            event_type="user_logout",
            user_id=user_info.user_id,
            username=user_info.username,
            phone=user_info.phone
        )
        
        if self.distributed_mode and self.redis:
            await self.redis.publish(self.CHANNEL_USER_LOGOUT, event.json())
        else:
            await self._broadcast_user_logout_local(event)
            await self._broadcast_userlist_local()
    
    async def publish_message(self, user: ChatUser, content: str):
        """发布用户消息"""
        event = MessageEvent(
            event_type="user_message",
            user_id=user.user_id,
            username=user.username,
            phone=user.phone,
            content=content
        )
        
        if self.distributed_mode and self.redis:
            await self.redis.publish(self.CHANNEL_USER_MESSAGE, event.json())
        else:
            await self._broadcast_message_local(event)
    
    # ========== 本地广播实现 ==========
    
    async def _broadcast_user_login_local(self, event: MessageEvent):
        """本地广播用户登录消息"""
        message = ChatMessage(
            msg_type="system_msg_user_login",
            content=f"🎉 {event.username} 加入了聊天室",
            username=event.username,
            phone=event.phone,
            timestamp=event.timestamp
        )
        await self._send_to_all(message.dict())
    
    async def _broadcast_user_logout_local(self, event: MessageEvent):
        """本地广播用户退出消息"""
        message = ChatMessage(
            msg_type="system_msg_user_logout",
            content=f"👋 {event.username} 离开了聊天室",
            username=event.username,
            phone=event.phone,
            timestamp=event.timestamp
        )
        await self._send_to_all(message.dict())
    
    async def _broadcast_message_local(self, event: MessageEvent):
        """本地广播用户消息"""
        for phone, ws in self._local_websockets.items():
            is_self = (phone == event.phone)
            prefix = "I said : " if is_self else f"{event.username} said: "

            message = ChatMessage(
                msg_type="user_send_msg",
                content=f"{prefix}{event.content}",
                username=event.username,
                phone=event.phone,
                timestamp=event.timestamp,
                is_self=is_self
            )

            try:
                await ws.send_json(message.dict())
            except Exception as e:
                print(f"发送消息失败 {phone}: {e}")
    
    async def _broadcast_userlist_local(self):
        """本地广播用户列表"""
        users = await self.get_online_usernames()
        message = ChatMessage(
            msg_type="system_room_update_userlist",
            content="用户列表更新",
            users=users,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
        await self._send_to_all(message.dict())
    
    async def _send_to_all(self, data: dict):
        """向所有本地连接发送消息"""
        disconnected = []
        
        for phone, ws in self._local_websockets.items():
            try:
                await ws.send_json(data)
            except Exception as e:
                print(f"发送失败 {phone}: {e}")
                disconnected.append(phone)
        
        # 清理断开的连接
        for phone in disconnected:
            await self.user_disconnect(phone)
    
    async def close(self):
        """关闭连接管理器"""
        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()
        
        if self.redis:
            await self.redis.close()


# 创建全局实例（单进程模式下使用）
room_manager = RoomConnectionManager()
