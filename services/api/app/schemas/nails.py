from datetime import datetime

from pydantic import BaseModel, Field


class NailStyleRead(BaseModel):
    id: str
    title: str
    description: str
    image_url: str
    tags: list[str] = Field(default_factory=list)
    dominant_colors: list[str] = Field(default_factory=list)
    popularity_score: float = 0.0
    is_trending: bool = False
    nail_type: str = "press_on"
    is_liked: bool = False
    like_count: int = 0
    is_favorited: bool = False
    favorite_count: int = 0
    comment_count: int = 0
    author_id: str | None = None
    author_name: str = "焕甲图库"
    author_avatar_url: str | None = None
    author_is_shop: bool = False
    is_following_author: bool = False
    is_authored_by_me: bool = False
    shop_id: str | None = None
    shop_name: str | None = None
    shop_city: str | None = None
    shop_address: str | None = None
    verified_consumption: bool = False
    verified_shop_id: str | None = None
    verified_shop_name: str | None = None
    verified_shop_city: str | None = None
    verified_shop_address: str | None = None
    manage_post_id: str | None = None
    is_hidden: bool = False
    created_at: datetime


class NailStyleDetailRead(NailStyleRead):
    pass


class StyleCommentCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class StyleCommentRead(BaseModel):
    id: str
    content: str
    created_at: datetime
    author_name: str
    author_avatar_url: str | None = None
    author_is_shop: bool = False
    is_style_author: bool = False
    is_mine: bool = False


class StyleCommentListResponse(BaseModel):
    items: list[StyleCommentRead]


class NailStyleListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[NailStyleRead]
