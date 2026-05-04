from datetime import datetime

from pydantic import BaseModel


class TryOnJobCreateResponse(BaseModel):
    job_id: str
    status: str
    stage: str = "pending"


class TryOnJobRead(BaseModel):
    job_id: str
    status: str
    stage: str = "pending"
    result_image_url: str | None = None
    source_hand_image_url: str | None = None
    error_message: str | None = None
    prompt_text: str | None = None
    selected_style_id: str
    created_at: datetime


class TryOnHistoryItemRead(BaseModel):
    job_id: str
    status: str
    stage: str = "pending"
    result_image_url: str | None = None
    source_hand_image_url: str | None = None
    prompt_text: str | None = None
    selected_style_id: str
    style_title: str
    style_image_url: str
    created_at: datetime


class TryOnHistoryListResponse(BaseModel):
    items: list[TryOnHistoryItemRead]
