from typing import Any, Literal

from pydantic import BaseModel, Field


class AIRecommendRequest(BaseModel):
    query_text: str = Field(min_length=1, max_length=200)
    limit: int = Field(default=5, ge=1, le=10)


class AIRecommendItem(BaseModel):
    style_id: str
    title: str
    image_url: str
    tags: list[str]
    reason: str
    score: float


class AIRecommendResponse(BaseModel):
    request_id: str
    items: list[AIRecommendItem]


class AIHotXhsRecommendationItem(BaseModel):
    note_id: str
    title: str
    image_url: str
    tags: list[str]
    reason: str
    score: float
    liked_count: int
    collected_count: int
    share_count: int
    nail_features: dict[str, Any] | None = Field(default=None, exclude=True)


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)


class AIChatRequest(BaseModel):
    messages: list[AIChatMessage] = Field(min_length=1, max_length=20)


class AIChatResponse(BaseModel):
    reply: str
    model: str
    recommendations: list[AIHotXhsRecommendationItem] = Field(default_factory=list)
    needs_hand_image: bool = False
    hand_picker_message: str | None = None


class XhsRecommendationStyleResponse(BaseModel):
    style_id: str
