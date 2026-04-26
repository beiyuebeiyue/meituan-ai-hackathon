from datetime import datetime

from pydantic import BaseModel, Field


class UserPostRead(BaseModel):
    id: str
    title: str
    description: str
    image_url: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    is_hidden: bool = False


class AuthorPostRead(BaseModel):
    id: str
    manage_post_id: str | None = None
    title: str
    description: str
    image_url: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    is_hidden: bool = False
    is_liked: bool = False
    like_count: int = 0
    view_count: int = 0
    unique_viewer_count: int = 0


class UserPostListResponse(BaseModel):
    items: list[UserPostRead]


class UserPostUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    is_hidden: bool | None = None
