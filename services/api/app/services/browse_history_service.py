from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.models.user import User
from app.models.user_browse_history import UserBrowseHistory
from app.models.mixins import utcnow
from app.services.style_service import StyleService


class BrowseHistoryService:
    def __init__(self) -> None:
        self.styles = StyleService()

    def prune_expired(self, db: Session, user: User) -> int:
        cutoff = utcnow() - timedelta(days=30)
        result = db.execute(
            delete(UserBrowseHistory).where(
                UserBrowseHistory.user_id == user.id,
                UserBrowseHistory.updated_at < cutoff,
            )
        )
        db.commit()
        return int(result.rowcount or 0)

    def list_for_user(self, db: Session, user: User) -> list[UserBrowseHistory]:
        self.prune_expired(db, user)
        statement = (
            select(UserBrowseHistory)
            .options(selectinload(UserBrowseHistory.style))
            .where(UserBrowseHistory.user_id == user.id)
            .order_by(UserBrowseHistory.updated_at.desc())
        )
        return list(db.scalars(statement).all())

    def record(self, db: Session, user: User, style_id: str) -> UserBrowseHistory:
        self.prune_expired(db, user)
        style = self.styles.get_style(db, style_id)
        history = db.scalar(
            select(UserBrowseHistory).where(
                UserBrowseHistory.user_id == user.id,
                UserBrowseHistory.nail_style_id == style.id,
            )
        )
        if history is None:
            history = UserBrowseHistory(user_id=user.id, nail_style_id=style.id)
        else:
            history.nail_style_id = style.id
        db.add(history)
        db.commit()
        db.refresh(history)
        return history

    def delete(self, db: Session, user: User, history_id: str) -> None:
        history = db.get(UserBrowseHistory, history_id)
        if history is None or history.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="浏览记录不存在")
        db.delete(history)
        db.commit()

    def delete_many(self, db: Session, user: User, history_ids: list[str]) -> int:
        normalized_ids = list(dict.fromkeys(item for item in history_ids if item))
        if not normalized_ids:
            return 0
        result = db.execute(
            delete(UserBrowseHistory).where(
                UserBrowseHistory.user_id == user.id,
                UserBrowseHistory.id.in_(normalized_ids),
            )
        )
        db.commit()
        return int(result.rowcount or 0)
