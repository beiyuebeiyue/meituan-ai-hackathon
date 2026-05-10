from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.schemas.users import serialize_user_read
from app.services.auth_service import AuthService
from app.utils.ip_location import request_ip_location


router = APIRouter(prefix="/auth", tags=["auth"])
auth_service = AuthService()


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    user, token = auth_service.register(db, payload, request_ip_location(request))
    return AuthResponse(access_token=token, user=serialize_user_read(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    user, token = auth_service.login(db, payload, request_ip_location(request))
    return AuthResponse(access_token=token, user=serialize_user_read(user))


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"message": "已退出登录"}
