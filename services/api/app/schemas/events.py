from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class StyleEventInput(BaseModel):
    style_id: str
    event_type: str
    source: str
    count: int = Field(default=1, ge=1, le=1000)


class StyleEventBatchRequest(BaseModel):
    items: list[StyleEventInput]


AnalyticsEventName = Literal[
    "app_open",
    "style_impression",
    "style_click",
    "ai_recommendation_shown",
    "ai_recommendation_click",
    "tryon_start_clicked",
    "tryon_result_viewed",
    "booking_start_clicked",
    "booking_submit_clicked",
    "tryon_started",
    "tryon_completed",
    "tryon_failed",
    "booking_created",
    "booking_completed",
    "booking_cancelled",
    "revenue_recorded",
]


class AnalyticsEventInput(BaseModel):
    event_id: str = Field(min_length=1, max_length=80)
    event_name: AnalyticsEventName
    anonymous_id: str | None = Field(default=None, max_length=80)
    session_id: str | None = Field(default=None, max_length=80)
    style_id: str | None = Field(default=None, max_length=36)
    tryon_job_id: str | None = Field(default=None, max_length=36)
    booking_id: str | None = Field(default=None, max_length=36)
    shop_id: str | None = Field(default=None, max_length=36)
    source: str = Field(default="", max_length=80)
    screen: str = Field(default="", max_length=80)
    amount_cents: int | None = Field(default=None, ge=0)
    properties: dict[str, object] = Field(default_factory=dict)
    occurred_at: datetime | None = None


class AnalyticsEventBatchRequest(BaseModel):
    items: list[AnalyticsEventInput] = Field(min_length=1, max_length=100)


class AnalyticsEventBatchResponse(BaseModel):
    inserted: int
    skipped: int
