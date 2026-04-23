from __future__ import annotations

from app.models.nail_style import NailStyle
from app.models.user_post import UserPost
from app.schemas.nails import NailStyleRead
from app.schemas.posts import UserPostRead


def serialize_style(style: NailStyle, favorite_ids: set[str] | None = None) -> NailStyleRead:
    favorite_ids = favorite_ids or set()
    return NailStyleRead(
        id=style.id,
        title=style.title,
        description=style.description,
        image_url=style.image_url,
        tags=style.tags_json or [],
        dominant_colors=style.dominant_colors_json or [],
        popularity_score=style.popularity_score,
        is_trending=style.is_trending,
        is_favorited=style.id in favorite_ids,
        created_at=style.created_at,
    )


def serialize_post(post: UserPost) -> UserPostRead:
    return UserPostRead(
        id=post.id,
        title=post.title,
        description=post.description,
        image_url=post.image_url,
        tags=post.tags_json or [],
        created_at=post.created_at,
    )
