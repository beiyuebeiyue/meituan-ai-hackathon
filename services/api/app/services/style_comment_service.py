from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.style_comment import StyleComment
from app.models.user import User
from app.services.style_service import StyleService


class StyleCommentService:
    def __init__(self) -> None:
        self.styles = StyleService()

    def list_for_style(self, db: Session, style_id: str) -> list[StyleComment]:
        self.styles.get_style(db, style_id)
        statement = (
            select(StyleComment)
            .options(selectinload(StyleComment.user))
            .where(StyleComment.nail_style_id == style_id)
            .order_by(StyleComment.created_at.desc())
        )
        return list(db.scalars(statement).all())

    def list_for_user(self, db: Session, user: User) -> list[StyleComment]:
        statement = (
            select(StyleComment)
            .options(selectinload(StyleComment.user), selectinload(StyleComment.style))
            .where(StyleComment.user_id == user.id)
            .order_by(StyleComment.created_at.desc())
        )
        return list(db.scalars(statement).all())

    def create(self, db: Session, user: User, style_id: str, content: str) -> StyleComment:
        style = self.styles.get_style(db, style_id)
        comment = StyleComment(
            user_id=user.id,
            nail_style_id=style.id,
            content=content.strip(),
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        db.refresh(user)
        return db.scalar(
            select(StyleComment)
            .options(selectinload(StyleComment.user))
            .where(StyleComment.id == comment.id)
        ) or comment

    def delete(self, db: Session, user: User, style_id: str, comment_id: str) -> None:
        comment = db.scalar(
            select(StyleComment).where(
                StyleComment.id == comment_id,
                StyleComment.nail_style_id == style_id,
            )
        )
        if comment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="评论不存在")
        if comment.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能删除自己的评论")
        db.delete(comment)
        db.commit()
