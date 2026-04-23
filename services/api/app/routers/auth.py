from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.schemas.users import UserRead
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])
auth_service = AuthService()


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user, token = auth_service.register(db, payload)
    return AuthResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user, token = auth_service.login(db, payload)
    return AuthResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"message": "已退出登录"}
