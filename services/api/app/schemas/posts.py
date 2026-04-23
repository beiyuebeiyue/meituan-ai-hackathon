from datetime import datetime

from pydantic import BaseModel, Field


class UserPostRead(BaseModel):
    id: str
    title: str
    description: str
    image_url: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime


class UserPostListResponse(BaseModel):
    items: list[UserPostRead]
