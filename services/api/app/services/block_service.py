from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_block import UserBlock


class BlockService:
    def has_blocked(self, db: Session, blocker_user_id: str, blocked_user_id: str) -> bool:
        return db.scalar(
            select(UserBlock.id).where(
                UserBlock.blocker_user_id == blocker_user_id,
                UserBlock.blocked_user_id == blocked_user_id,
            )
        ) is not None

    def get_relationship(self, db: Session, viewer_user_id: str | None, target_user_id: str) -> tuple[bool, bool]:
        if viewer_user_id is None:
            return False, False
        return (
            self.has_blocked(db, target_user_id, viewer_user_id),
            self.has_blocked(db, viewer_user_id, target_user_id),
        )

    def list_blocked_users(self, db: Session, user_id: str) -> list[User]:
        relations = db.scalars(
            select(UserBlock)
            .where(UserBlock.blocker_user_id == user_id)
            .order_by(UserBlock.created_at.desc())
        )
        return [relation.blocked for relation in relations if relation.blocked is not None]

    def block(self, db: Session, user: User, target_user_id: str) -> User:
        target = db.get(User, target_user_id)
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
        if target.id == user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能对自己设置不再看她")

        relation = db.scalar(
            select(UserBlock).where(
                UserBlock.blocker_user_id == user.id,
                UserBlock.blocked_user_id == target.id,
            )
        )
        if relation is None:
            db.add(UserBlock(blocker_user_id=user.id, blocked_user_id=target.id))
            db.commit()
        return target

    def unblock(self, db: Session, user: User, target_user_id: str) -> None:
        relation = db.scalar(
            select(UserBlock).where(
                UserBlock.blocker_user_id == user.id,
                UserBlock.blocked_user_id == target_user_id,
            )
        )
        if relation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="不再看关系不存在")
        db.delete(relation)
        db.commit()
