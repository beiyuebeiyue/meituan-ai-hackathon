from __future__ import annotations

from app.models.nail_style import NailStyle
from app.models.style_comment import StyleComment
from app.models.user_post import UserPost
from app.schemas.nails import NailStyleDetailRead, NailStyleRead, StyleCommentRead
from app.schemas.posts import AuthorPostRead, UserPostRead


def serialize_style(
    style: NailStyle,
    favorite_ids: set[str] | None = None,
    like_ids: set[str] | None = None,
) -> NailStyleRead:
    favorite_ids = favorite_ids or set()
    like_ids = like_ids or set()
    return NailStyleRead(
        id=style.id,
        title=style.title,
        description=style.description,
        image_url=style.image_url,
        tags=style.tags_json or [],
        dominant_colors=style.dominant_colors_json or [],
        popularity_score=style.popularity_score,
        is_trending=style.is_trending,
        is_liked=style.id in like_ids,
        like_count=0,
        is_favorited=style.id in favorite_ids,
        favorite_count=0,
        comment_count=0,
        author_id=None,
        author_name="焕甲图库",
        author_avatar_url=None,
        is_following_author=False,
        is_authored_by_me=False,
        shop_id=style.shop_id,
        shop_name=style.shop.name if style.shop is not None else None,
        shop_city=style.shop.city if style.shop is not None else None,
        shop_address=style.shop.address if style.shop is not None else None,
        manage_post_id=None,
        is_hidden=False,
        created_at=style.created_at,
    )


def serialize_style_detail(
    style: NailStyle,
    favorite_ids: set[str] | None = None,
    like_ids: set[str] | None = None,
    like_count: int = 0,
    favorite_count: int = 0,
    comment_count: int = 0,
    author_id: str | None = None,
    author_name: str = "焕甲图库",
    author_avatar_url: str | None = None,
    is_following_author: bool = False,
    is_authored_by_me: bool = False,
    manage_post_id: str | None = None,
    is_hidden: bool = False,
) -> NailStyleDetailRead:
    favorite_ids = favorite_ids or set()
    like_ids = like_ids or set()
    return NailStyleDetailRead(
        id=style.id,
        title=style.title,
        description=style.description,
        image_url=style.image_url,
        tags=style.tags_json or [],
        dominant_colors=style.dominant_colors_json or [],
        popularity_score=style.popularity_score,
        is_trending=style.is_trending,
        is_liked=style.id in like_ids,
        like_count=like_count,
        is_favorited=style.id in favorite_ids,
        favorite_count=favorite_count,
        comment_count=comment_count,
        author_id=author_id,
        author_name=author_name,
        author_avatar_url=author_avatar_url,
        is_following_author=is_following_author,
        is_authored_by_me=is_authored_by_me,
        shop_id=style.shop_id,
        shop_name=style.shop.name if style.shop is not None else None,
        shop_city=style.shop.city if style.shop is not None else None,
        shop_address=style.shop.address if style.shop is not None else None,
        manage_post_id=manage_post_id,
        is_hidden=is_hidden,
        created_at=style.created_at,
    )


def serialize_style_comment(comment: StyleComment, is_mine: bool = False) -> StyleCommentRead:
    author = comment.user
    return StyleCommentRead(
        id=comment.id,
        content=comment.content,
        created_at=comment.created_at,
        author_name=author.username if author is not None else "焕甲用户",
        author_avatar_url=author.avatar_url if author is not None else None,
        is_mine=is_mine,
    )


def serialize_post(post: UserPost) -> UserPostRead:
    return UserPostRead(
        id=post.id,
        title=post.title,
        description=post.description,
        image_url=post.image_url,
        tags=post.tags_json or [],
        created_at=post.created_at,
        updated_at=post.updated_at,
        is_hidden=post.is_hidden,
    )


def serialize_author_post(
    style: NailStyle,
    post: UserPost | None = None,
    is_liked: bool = False,
    like_count: int = 0,
    view_count: int = 0,
    unique_viewer_count: int = 0,
) -> AuthorPostRead:
    return AuthorPostRead(
        id=style.id,
        manage_post_id=post.id if post is not None else None,
        title=style.title,
        description=style.description,
        image_url=style.image_url,
        tags=style.tags_json or [],
        created_at=post.created_at if post is not None else style.created_at,
        updated_at=post.updated_at if post is not None else style.created_at,
        is_hidden=post.is_hidden if post is not None else False,
        is_liked=is_liked,
        like_count=like_count,
        view_count=view_count,
        unique_viewer_count=unique_viewer_count,
    )
