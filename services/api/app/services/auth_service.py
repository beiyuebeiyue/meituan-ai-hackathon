from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.utils.avatar import DEFAULT_MERCHANT_AVATAR_URL, default_avatar_url_for_role

INT32_MAX = 2_147_483_647
DEMO_CONSUMER_UID = 1
DEMO_CONSUMER_PHONE = "13886722665"
DEMO_CONSUMER_USERNAME = "momo酱"


class AuthService:
    def _ensure_default_admin_avatar(self) -> str:
        return DEFAULT_MERCHANT_AVATAR_URL

    def _apply_demo_consumer_identity(self, db: Session, user: User | None = None) -> bool:
        demo_user = user or db.scalar(select(User).where(User.phone == DEMO_CONSUMER_PHONE))
        if demo_user is None:
            return False

        changed = False
        if demo_user.uid != DEMO_CONSUMER_UID:
            occupied_user = db.scalar(
                select(User).where(User.uid == DEMO_CONSUMER_UID, User.id != demo_user.id)
            )
            if occupied_user is not None:
                db.delete(occupied_user)
                db.flush()
            demo_user.uid = DEMO_CONSUMER_UID
            changed = True

        if demo_user.phone != DEMO_CONSUMER_PHONE:
            demo_user.phone = DEMO_CONSUMER_PHONE
            changed = True
        if demo_user.role != "consumer":
            demo_user.role = "consumer"
            changed = True

        username_conflict = db.scalar(
            select(User).where(User.username == DEMO_CONSUMER_USERNAME, User.id != demo_user.id)
        )
        if username_conflict is None and demo_user.username != DEMO_CONSUMER_USERNAME:
            demo_user.username = DEMO_CONSUMER_USERNAME
            changed = True

        if changed:
            db.add(demo_user)
            db.flush()
        return changed

    def _next_uid(self, db: Session) -> int:
        current_max = db.scalar(select(func.max(User.uid)))
        next_uid = 1 if current_max is None or current_max < 0 else int(current_max) + 1
        if next_uid > INT32_MAX:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="用户编号已满")
        return next_uid

    def _record_login_ip_location(self, db: Session, user: User, ip_location: str | None) -> None:
        location = (ip_location or "").strip() or "未知"
        if user.last_login_ip_location == location:
            return
        user.last_login_ip_location = location
        db.add(user)
        db.commit()
        db.refresh(user)

    def ensure_user_uids(self, db: Session) -> None:
        settings = get_settings()
        users = list(db.scalars(select(User).order_by(User.created_at.asc(), User.id.asc())).all())
        if not users:
            return

        admin_user = next(
            (
                item
                for item in users
                if item.uid == 0
                or item.phone == settings.default_admin_phone
                or item.username == settings.default_admin_username
            ),
            None,
        )

        changed = False
        used_positive_uids: set[int] = set()
        next_uid = max((item.uid for item in users if isinstance(item.uid, int) and item.uid and item.uid > 0), default=0) + 1

        if admin_user is not None and admin_user.uid != 0:
            admin_user.uid = 0
            changed = True
        if admin_user is not None and admin_user.role != "merchant":
            admin_user.role = "merchant"
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

        if self._apply_demo_consumer_identity(db):
            changed = True
            users = list(db.scalars(select(User).order_by(User.created_at.asc(), User.id.asc())).all())

        if changed:
            db.add_all(users)
            db.commit()

    def register(self, db: Session, payload: RegisterRequest, ip_location: str | None = None) -> tuple[User, str]:
        phone = payload.phone.strip()
        existing_phone = db.scalar(select(User).where(User.phone == phone))
        if existing_phone is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="手机号已注册")
        existing_username = db.scalar(select(User).where(User.username == payload.username))
        if existing_username is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已被占用")
        user = User(
            uid=self._next_uid(db),
            phone=phone,
            username=payload.username.strip(),
            password_hash=get_password_hash(payload.password),
            last_login_ip_location=(ip_location or "").strip() or "未知",
            role="consumer",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user, create_access_token(user.id)

    def ensure_demo_consumer(self, db: Session) -> User:
        settings = get_settings()
        user = db.scalar(select(User).where(User.phone == DEMO_CONSUMER_PHONE))
        if user is None:
            occupied_user = db.scalar(select(User).where(User.uid == DEMO_CONSUMER_UID))
            if occupied_user is not None:
                db.delete(occupied_user)
                db.flush()
            user = User(
                uid=DEMO_CONSUMER_UID,
                phone=DEMO_CONSUMER_PHONE,
                username=DEMO_CONSUMER_USERNAME,
                password_hash=get_password_hash(settings.default_admin_password),
                role="consumer",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user

        user.phone = DEMO_CONSUMER_PHONE
        user.username = DEMO_CONSUMER_USERNAME
        user.password_hash = get_password_hash(settings.default_admin_password)
        user.role = "consumer"
        self._apply_demo_consumer_identity(db, user)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def login(self, db: Session, payload: LoginRequest, ip_location: str | None = None) -> tuple[User, str]:
        phone = payload.phone.strip()
        settings = get_settings()
        if (
            payload.requested_role == "consumer"
            and phone == DEMO_CONSUMER_PHONE
            and payload.password == settings.default_admin_password
        ):
            user = self.ensure_demo_consumer(db)
            self._record_login_ip_location(db, user, ip_location)
            return user, create_access_token(user.id)

        user = db.scalar(select(User).where(User.phone == phone))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="手机号或密码错误")
        if not isinstance(user.uid, int):
            user.uid = self._next_uid(db)
            db.add(user)
            db.commit()
            db.refresh(user)
        if payload.requested_role is not None and user.role != payload.requested_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="当前账号身份与登录入口不匹配",
            )
        self._record_login_ip_location(db, user, ip_location)
        return user, create_access_token(user.id)

    def ensure_default_admin(self, db: Session) -> User | None:
        settings = get_settings()
        if not settings.default_admin_enabled:
            return None

        avatar_url = self._ensure_default_admin_avatar()
        existing = db.scalar(
            select(User).where(
                or_(
                    User.uid == 0,
                    User.phone == settings.default_admin_phone,
                    User.username == settings.default_admin_username,
                )
            )
        )
        if existing is None:
            existing = User(
                uid=0,
                phone=settings.default_admin_phone,
                username=settings.default_admin_username,
                avatar_url=avatar_url,
                bio=settings.default_admin_bio,
                password_hash=get_password_hash(settings.default_admin_password),
                role="merchant",
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)
            self.ensure_user_uids(db)
            return existing

        existing.uid = 0
        existing.phone = settings.default_admin_phone
        existing.username = settings.default_admin_username
        existing.avatar_url = avatar_url
        if existing.bio is None:
            existing.bio = settings.default_admin_bio
        existing.password_hash = get_password_hash(settings.default_admin_password)
        existing.role = "merchant"
        db.add(existing)
        db.commit()
        db.refresh(existing)
        self.ensure_user_uids(db)
        return existing

    def normalize_default_avatars(self, db: Session) -> None:
        changed = False
        for user in db.scalars(select(User)):
            avatar_url = default_avatar_url_for_role(user.role)
            if user.avatar_url == avatar_url:
                continue
            user.avatar_url = avatar_url
            db.add(user)
            changed = True
        if changed:
            db.commit()
