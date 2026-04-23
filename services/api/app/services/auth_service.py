from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest


class AuthService:
    @staticmethod
    def _internal_email_for_phone(phone: str) -> str:
        return f"user_{phone}@nailtry.local"

    def register(self, db: Session, payload: RegisterRequest) -> tuple[User, str]:
        phone = payload.phone.strip()
        existing_phone = db.scalar(select(User).where(User.phone == phone))
        if existing_phone is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已注册")
        existing_username = db.scalar(select(User).where(User.username == payload.username))
        if existing_username is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已被占用")
        user = User(
            email=self._internal_email_for_phone(phone),
            phone=phone,
            username=payload.username.strip(),
            password_hash=get_password_hash(payload.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user, create_access_token(user.id)

    def login(self, db: Session, payload: LoginRequest) -> tuple[User, str]:
        phone = payload.phone.strip()
        user = db.scalar(select(User).where(User.phone == phone))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="手机号或密码错误")
        return user, create_access_token(user.id)

    def ensure_default_admin(self, db: Session) -> User | None:
        settings = get_settings()
        if not settings.default_admin_enabled:
            return None

        internal_email = self._internal_email_for_phone(settings.default_admin_phone)
        existing = db.scalar(
            select(User).where(
                or_(
                    User.phone == settings.default_admin_phone,
                    User.username == settings.default_admin_username,
                    User.email == internal_email,
                )
            )
        )
        if existing is None:
            existing = User(
                email=internal_email,
                phone=settings.default_admin_phone,
                username=settings.default_admin_username,
                password_hash=get_password_hash(settings.default_admin_password),
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)
            return existing

        existing.email = internal_email
        existing.phone = settings.default_admin_phone
        existing.username = settings.default_admin_username
        existing.password_hash = get_password_hash(settings.default_admin_password)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
