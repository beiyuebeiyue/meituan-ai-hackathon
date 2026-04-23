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
