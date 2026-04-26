from fastapi import APIRouter, Query

from app.schemas.market import NearbyShopSearchResponse
from app.services.market_service import MarketService


router = APIRouter(prefix="/market", tags=["market"])
market_service = MarketService()


@router.get("/shops/nearby", response_model=NearbyShopSearchResponse)
def get_nearby_shops(
    keyword: str | None = Query(default=None),
    city: str | None = Query(default=None),
    region: str | None = Query(default=None),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    sort: str = Query(default="default"),
    view: str | None = Query(default=None),
) -> NearbyShopSearchResponse:
    return market_service.search_nearby(
        keyword=keyword,
        city=city,
        region=region,
        lat=lat,
        lng=lng,
        sort=sort,
    )
