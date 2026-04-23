from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.nail_style import NailStyle
from app.models.user_favorite import UserFavorite
from app.models.user_post import UserPost
from app.models.user import User
from app.utils.files import public_url_for_path, relative_to_base


class StyleService:
    def list_hot(self, db: Session, page: int, page_size: int) -> tuple[list[NailStyle], int]:
        base = select(NailStyle).order_by(NailStyle.is_trending.desc(), NailStyle.popularity_score.desc(), NailStyle.created_at.desc())
        total = db.scalar(select(func.count()).select_from(NailStyle)) or 0
        items = list(db.scalars(base.offset((page - 1) * page_size).limit(page_size)))
        return items, total

    def list_latest(self, db: Session, page: int, page_size: int) -> tuple[list[NailStyle], int]:
        base = select(NailStyle).order_by(NailStyle.created_at.desc())
        total = db.scalar(select(func.count()).select_from(NailStyle)) or 0
        items = list(db.scalars(base.offset((page - 1) * page_size).limit(page_size)))
        return items, total

    def get_style(self, db: Session, style_id: str) -> NailStyle:
        style = db.get(NailStyle, style_id)
        if style is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="款式不存在")
        return style

    def get_favorite_ids(self, db: Session, user_id: str) -> set[str]:
        statement = select(UserFavorite.nail_style_id).where(UserFavorite.user_id == user_id)
        return set(db.scalars(statement))

    def create_style_from_post(self, db: Session, user: User, post: UserPost) -> NailStyle:
        style = NailStyle(
            title=post.title,
            description=post.description,
            image_url=post.image_url,
            local_image_path=post.local_image_path,
            source_type="user_upload",
            tags_json=post.tags_json,
            dominant_colors_json=[],
            style_metadata_json={"author_user_id": user.id, "from_post_id": post.id},
            popularity_score=0.0,
            is_trending=False,
        )
        db.add(style)
        db.commit()
        db.refresh(style)
        return style

    def style_image_path(self, style: NailStyle) -> Path:
        return Path(style.local_image_path)
