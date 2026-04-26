from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_follow import UserFollow


class FollowService:
    def get_following_ids(self, db: Session, user_id: str) -> set[str]:
        statement = select(UserFollow.followed_user_id).where(UserFollow.follower_user_id == user_id)
        return set(db.scalars(statement))

    def list_following(self, db: Session, user_id: str) -> list[User]:
        relations = db.scalars(
            select(UserFollow)
            .where(UserFollow.follower_user_id == user_id)
            .order_by(UserFollow.created_at.desc())
        )
        return [relation.followed for relation in relations if relation.followed is not None]

    def list_followers(self, db: Session, user_id: str) -> list[User]:
        relations = db.scalars(
            select(UserFollow)
            .where(UserFollow.followed_user_id == user_id)
            .order_by(UserFollow.created_at.desc())
        )
        return [relation.follower for relation in relations if relation.follower is not None]

    def is_following(self, db: Session, follower_user_id: str, followed_user_id: str) -> bool:
        return db.scalar(
            select(UserFollow.id).where(
                UserFollow.follower_user_id == follower_user_id,
                UserFollow.followed_user_id == followed_user_id,
            )
        ) is not None

    def follow(self, db: Session, user: User, target_user_id: str) -> User:
        target = db.get(User, target_user_id)
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
        if target.id == user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能关注自己")

        relation = db.scalar(
            select(UserFollow).where(
                UserFollow.follower_user_id == user.id,
                UserFollow.followed_user_id == target.id,
            )
        )
        if relation is None:
            relation = UserFollow(follower_user_id=user.id, followed_user_id=target.id)
            db.add(relation)
            db.commit()
        return target

    def unfollow(self, db: Session, user: User, target_user_id: str) -> None:
        relation = db.scalar(
            select(UserFollow).where(
                UserFollow.follower_user_id == user.id,
                UserFollow.followed_user_id == target_user_id,
            )
        )
        if relation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="关注关系不存在")
        db.delete(relation)
        db.commit()
