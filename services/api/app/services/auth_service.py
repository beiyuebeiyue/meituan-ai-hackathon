from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest

INT32_MAX = 2_147_483_647


class AuthService:
    @staticmethod
    def _internal_email_for_phone(phone: str) -> str:
        return f"user_{phone}@nailtry.local"

    def _next_uid(self, db: Session) -> int:
        current_max = db.scalar(select(func.max(User.uid)))
        next_uid = 1 if current_max is None or current_max < 0 else int(current_max) + 1
        if next_uid > INT32_MAX:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="用户编号已满")
        return next_uid

    def ensure_user_uids(self, db: Session) -> None:
        settings = get_settings()
        internal_email = self._internal_email_for_phone(settings.default_admin_phone)
        users = list(db.scalars(select(User).order_by(User.created_at.asc(), User.id.asc())).all())
        if not users:
            return

        admin_user = next(
            (
                item
                for item in users
                if item.phone == settings.default_admin_phone
                or item.username == settings.default_admin_username
                or item.email == internal_email
            ),
            None,
        )

        changed = False
        used_positive_uids: set[int] = set()
        next_uid = max((item.uid for item in users if isinstance(item.uid, int) and item.uid and item.uid > 0), default=0) + 1

        if admin_user is not None and admin_user.uid != 0:
            admin_user.uid = 0
            changed = True

        for user in users:
            if admin_user is not None and user.id == admin_user.id:
                continue
            if isinstance(user.uid, int) and 0 < user.uid <= INT32_MAX and user.uid not in used_positive_uids:
                used_positive_uids.add(user.uid)
                continue
            while next_uid in used_positive_uids:
                next_uid += 1
            if next_uid > INT32_MAX:
                raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="用户编号已满")
            user.uid = next_uid
            used_positive_uids.add(next_uid)
            next_uid += 1
            changed = True

        if changed:
            db.add_all(users)
            db.commit()

    def register(self, db: Session, payload: RegisterRequest) -> tuple[User, str]:
        phone = payload.phone.strip()
        existing_phone = db.scalar(select(User).where(User.phone == phone))
        if existing_phone is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已注册")
        existing_username = db.scalar(select(User).where(User.username == payload.username))
        if existing_username is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已被占用")
        user = User(
            uid=self._next_uid(db),
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
        if not isinstance(user.uid, int):
            user.uid = self._next_uid(db)
            db.add(user)
            db.commit()
            db.refresh(user)
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
                uid=0,
                email=internal_email,
                phone=settings.default_admin_phone,
                username=settings.default_admin_username,
                bio=settings.default_admin_bio,
                password_hash=get_password_hash(settings.default_admin_password),
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)
            self.ensure_user_uids(db)
            return existing

        existing.uid = 0
        existing.email = internal_email
        existing.phone = settings.default_admin_phone
        existing.username = settings.default_admin_username
        existing.bio = settings.default_admin_bio
        existing.password_hash = get_password_hash(settings.default_admin_password)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        self.ensure_user_uids(db)
        return existing
