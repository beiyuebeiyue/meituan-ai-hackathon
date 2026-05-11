from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MerchantShopRead(BaseModel):
    id: str
    merchant_user_id: str
    name: str
    city: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    contact_phone: str | None = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MerchantShopListResponse(BaseModel):
    items: list[MerchantShopRead]


class MerchantShopCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    city: str = Field(default="深圳", min_length=1, max_length=80)
    address: str = ""
    latitude: float | None = None
    longitude: float | None = None
    contact_phone: str | None = None
    is_default: bool = True


class MerchantShopUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    city: str | None = Field(default=None, min_length=1, max_length=80)
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    contact_phone: str | None = None
    is_default: bool | None = None


BookingStatus = Literal["pending", "accepted", "rejected", "completed", "cancelled"]


class BookingCreateRequest(BaseModel):
    shop_id: str = Field(min_length=1, max_length=36)
    style_id: str | None = Field(default=None, max_length=36)
    appointment_time: str = Field(min_length=1, max_length=80)
    contact_phone: str = Field(min_length=5, max_length=40)
    note: str | None = Field(default=None, max_length=500)


class BookingStatusUpdateRequest(BaseModel):
    status: BookingStatus


class BookingRead(BaseModel):
    id: str
    style_id: str | None = None
    style_title: str
    style_image_url: str
    shop_id: str
    shop_name: str
    shop_city: str
    merchant_user_id: str
    merchant_name: str
    user_id: str
    user_name: str
    appointment_time: str
    contact_phone: str
    amount_cents: int
    status: BookingStatus
    note: str | None = None
    created_at: datetime
    updated_at: datetime


class BookingListResponse(BaseModel):
    items: list[BookingRead]
