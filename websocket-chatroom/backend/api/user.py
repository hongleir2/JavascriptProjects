"""
用户API路由
处理用户注册、登录等操作
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from db.database import get_db
from services.user_service import UserService
from utils.security import create_access_token

router = APIRouter(prefix="/api/v1/user", tags=["用户"])


# ========== 请求/响应模型 ==========

class UserRegisterRequest(BaseModel):
    """用户注册请求"""
    username: str = Field(..., min_length=2, max_length=50, description="用户名")
    phone: str = Field(..., min_length=11, max_length=11, description="手机号码")
    password: str = Field(..., min_length=6, max_length=50, description="密码")


class UserLoginRequest(BaseModel):
    """用户登录请求"""
    phone: str = Field(..., min_length=11, max_length=11, description="手机号码")
    password: str = Field(..., min_length=6, max_length=50, description="密码")


class UserResponse(BaseModel):
    """用户信息响应"""
    id: int
    username: str
    phone: str


class TokenResponse(BaseModel):
    """令牌响应"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    """消息响应"""
    success: bool
    message: str


# ========== API路由 ==========

@router.post("/register", response_model=MessageResponse, summary="用户注册")
async def register(
    request: UserRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    用户注册接口
    
    - **username**: 用户名（2-50字符）
    - **phone**: 手机号码（11位）
    - **password**: 密码（6-50字符）
    """
    # 检查用户是否已存在
    if await UserService.check_user_exists(db, username=request.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已被注册"
        )
    
    if await UserService.check_user_exists(db, phone=request.phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号已被注册"
        )
    
    # 创建用户
    try:
        await UserService.create_user(
            db=db,
            username=request.username,
            phone=request.phone,
            password=request.password
        )
        return MessageResponse(success=True, message="注册成功")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"注册失败: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse, summary="用户登录")
async def login(
    request: UserLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    用户登录接口
    
    - **phone**: 手机号码
    - **password**: 密码
    
    返回JWT令牌用于WebSocket连接认证
    """
    # 验证用户
    user = await UserService.authenticate_user(
        db=db,
        phone=request.phone,
        password=request.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误"
        )
    
    # 生成令牌
    token_data = {
        "user_id": user.id,
        "username": user.username,
        "phone": user.phone
    }
    access_token = create_access_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            phone=user.phone
        )
    )


@router.get("/check-phone/{phone}", summary="检查手机号是否已注册")
async def check_phone(
    phone: str,
    db: AsyncSession = Depends(get_db)
):
    """检查手机号是否已注册"""
    exists = await UserService.check_user_exists(db, phone=phone)
    return {"exists": exists}


@router.get("/check-username/{username}", summary="检查用户名是否已注册")
async def check_username(
    username: str,
    db: AsyncSession = Depends(get_db)
):
    """检查用户名是否已注册"""
    exists = await UserService.check_user_exists(db, username=username)
    return {"exists": exists}
