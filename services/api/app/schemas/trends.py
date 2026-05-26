from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TrendNailStyleRead(BaseModel):
    id: str
    title: str
    description: str = ""
    image_url: str
    tags: list[str] = Field(default_factory=list)
    popularity_score: float = 0.0
    like_count: int = 0
    claim_count: int = 0
    can_do_style: bool = False


class OpsTrendNailCandidateListResponse(BaseModel):
    items: list[TrendNailStyleRead] = Field(default_factory=list)


class OpsTrendCampaignCreateRequest(BaseModel):
    title: str = Field(default="本周热门手工甲", min_length=1, max_length=160)
    description: str = Field(default="", max_length=1000)
    style_ids: list[str] = Field(min_length=1)
    merchant_user_ids: list[str] | None = None


class OpsTrendCampaignRead(BaseModel):
    id: str
    title: str
    description: str = ""
    status: str
    created_by: str
    created_at: datetime
    merchant_count: int = 0
    claim_count: int = 0
    styles: list[TrendNailStyleRead] = Field(default_factory=list)


class MerchantTrendNotificationRead(BaseModel):
    id: str
    campaign_id: str | None = None
    title: str
    body: str = ""
    read_at: datetime | None = None
    created_at: datetime
    styles: list[TrendNailStyleRead] = Field(default_factory=list)


class MerchantTrendNotificationListResponse(BaseModel):
    items: list[MerchantTrendNotificationRead] = Field(default_factory=list)


class MerchantTrendClaimCreateRequest(BaseModel):
    style_id: str = Field(min_length=1, max_length=36)
    campaign_id: str | None = Field(default=None, max_length=36)


class MerchantTrendClaimRead(BaseModel):
    style_id: str
    shop_id: str
    campaign_id: str | None = None
    can_do_style: bool = True
