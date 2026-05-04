from typing import Literal

from pydantic import BaseModel, Field


class NearbyShopRead(BaseModel):
    id: str
    platform_shop_id: str | None = None
    name: str
    cover_image_url: str
    city: str
    region: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    distance_meters: int | None = None
    rating: float | None = None
    heat_text: str
    average_price_text: str
    business_time_text: str | None = None
    phone_text: str | None = None


class NearbyShopSearchResponse(BaseModel):
    items: list[NearbyShopRead] = Field(default_factory=list)
    resolved_city: str
    resolved_region: str | None = None
    center_lat: float | None = None
    center_lng: float | None = None
    used_location: bool = False
    available_sorts: list[str] = Field(default_factory=lambda: ["default", "distance"])
    source: Literal["gaode", "unavailable"] = "unavailable"
    message: str | None = None
