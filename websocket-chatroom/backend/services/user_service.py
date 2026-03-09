"""
用户服务 - CRUD操作
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.user import User
from utils.security import hash_password, verify_password


class UserService:
    """用户服务类"""
    
    @staticmethod
    async def create_user(db: AsyncSession, username: str, phone: str, password: str) -> User:
        """创建新用户"""
        hashed_password = hash_password(password)
        user = User(
            username=username,
            phone=phone,
            password=hashed_password
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    
    @staticmethod
    async def get_user_by_phone(db: AsyncSession, phone: str) -> User | None:
        """通过手机号获取用户"""
        result = await db.execute(
            select(User).where(User.phone == phone)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
        """通过用户名获取用户"""
        result = await db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
        """通过ID获取用户"""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    @staticmethod
    async def authenticate_user(db: AsyncSession, phone: str, password: str) -> User | None:
        """验证用户登录"""
        user = await UserService.get_user_by_phone(db, phone)
        if not user:
            return None
        if not verify_password(password, user.password):
            return None
        return user
    
    @staticmethod
    async def check_user_exists(db: AsyncSession, username: str = None, phone: str = None) -> bool:
        """检查用户是否存在"""
        if username:
            user = await UserService.get_user_by_username(db, username)
            if user:
                return True
        if phone:
            user = await UserService.get_user_by_phone(db, phone)
            if user:
                return True
        return False
