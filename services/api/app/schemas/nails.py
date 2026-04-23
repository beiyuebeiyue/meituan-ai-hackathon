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
    is_favorited: bool = False
    created_at: datetime


class NailStyleListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[NailStyleRead]
