from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mixins import utcnow
from app.models.user import User
from app.models.user_post import UserPost
from app.services.style_service import StyleService
from app.utils.files import delete_local_file


class PostService:
    def __init__(self) -> None:
        self.style_service = StyleService()

    def list_for_author(self, db: Session, author: User, viewer: User | None) -> list[UserPost]:
        include_hidden = viewer is not None and viewer.id == author.id
        statement = select(UserPost).where(UserPost.user_id == author.id)
        if not include_hidden:
            statement = statement.where(UserPost.is_hidden.is_(False))
        statement = statement.order_by(UserPost.created_at.desc())
        return list(db.scalars(statement).all())

    def list_for_user(self, db: Session, user: User) -> list[UserPost]:
        return list(
            db.scalars(
                select(UserPost).where(UserPost.user_id == user.id).order_by(UserPost.created_at.desc())
            ).all()
        )

    def create(
        self,
        db: Session,
        user: User,
        *,
        title: str,
        description: str,
        image_url: str,
        local_image_path: str,
        tags: list[str],
        shop_id: str | None = None,
        verified_booking_id: str | None = None,
    ) -> UserPost:
        now = utcnow()
        post = UserPost(
            user_id=user.id,
            shop_id=shop_id,
            title=title,
            description=description,
            image_url=image_url,
            local_image_path=local_image_path,
            tags_json=tags,
            verified_booking_id=verified_booking_id,
            created_at=now,
            updated_at=now,
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    def get_owned_post(self, db: Session, user: User, post_id: str) -> UserPost:
        post = db.get(UserPost, post_id)
        if post is None or post.user_id != user.id:
            from fastapi import HTTPException, status

            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="发布内容不存在")
        return post

    def update_owned_post(
        self,
        db: Session,
        user: User,
        post_id: str,
        *,
        title: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
        is_hidden: bool | None = None,
    ) -> UserPost:
        post = self.get_owned_post(db, user, post_id)
        changed = False

        if title is not None:
            normalized_title = title.strip()
            if normalized_title and normalized_title != post.title:
                post.title = normalized_title
                changed = True
        if description is not None and description != post.description:
            post.description = description
            changed = True
        if tags is not None:
            normalized_tags = [tag.strip() for tag in tags if tag.strip()]
            if normalized_tags != (post.tags_json or []):
                post.tags_json = normalized_tags
                changed = True
        if is_hidden is not None and is_hidden != post.is_hidden:
            post.is_hidden = is_hidden
            changed = True

        if not changed:
            return post

        post.updated_at = utcnow()
        db.add(post)
        self.style_service.sync_styles_from_post(db, post)
        db.commit()
        db.refresh(post)
        return post

    def delete_owned_post(self, db: Session, user: User, post_id: str) -> None:
        post = self.get_owned_post(db, user, post_id)
        linked_styles = self.style_service.get_styles_for_post(db, post.id)
        for style in linked_styles:
            db.delete(style)
        delete_local_file(post.local_image_path)
        db.delete(post)
        db.commit()
