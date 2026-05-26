from __future__ import annotations

import math
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.merchant_trend import MerchantTrendClaim
from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.schemas.market import NearbyShopRead, NearbyShopSearchResponse


DEFAULT_CITY = "深圳"
GAODE_NAIL_KEYWORD = "美甲"
GAODE_POI_AROUND_API_BASE_URL = "https://restapi.amap.com/v5/place/around"
GAODE_GEOCODE_API_BASE_URL = "https://restapi.amap.com/v3/geocode/geo"
GAODE_REGEOCODE_API_BASE_URL = "https://restapi.amap.com/v3/geocode/regeo"
GAODE_STATIC_MAP_API_BASE_URL = "https://restapi.amap.com/v3/staticmap"
GAODE_DEFAULT_RADIUS_METERS = 5000
GAODE_DEFAULT_PAGE = 1
GAODE_DEFAULT_LIMIT = 25
GAODE_PLACEHOLDER_COVER_URL = ""
PLATFORM_SHOP_SEARCH_RADIUS_METERS = 5000
KEKE_SHOP_REGION = "龙岗区"
KEKE_SHOP_RATING = 4.9
KEKE_SHOP_AVERAGE_PRICE_TEXT = "人均¥137"
KEKE_SHOP_BUSINESS_TIME_TEXT = "10:00-24:00"
CUHK_SHENZHEN_LATITUDE = 22.683980
CUHK_SHENZHEN_LONGITUDE = 114.208552


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "" or value == []:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "" or value == []:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _coerce_str(value: Any, fallback: str = "") -> str:
    if value is None or value == []:
        return fallback
    return str(value)


def _extract_pois(payload: dict[str, Any]) -> list[dict[str, Any]]:
    pois = payload.get("pois") or []
    if isinstance(pois, list):
        return [item for item in pois if isinstance(item, dict)]
    if isinstance(pois, dict):
        nested = pois.get("poi") or []
        if isinstance(nested, list):
            return [item for item in nested if isinstance(item, dict)]
        if isinstance(nested, dict):
            return [nested]
    return []


def _split_location(location: Any) -> tuple[float | None, float | None]:
    if not isinstance(location, str) or "," not in location:
        return None, None
    lng_raw, lat_raw = location.split(",", 1)
    return _coerce_float(lng_raw), _coerce_float(lat_raw)


def _distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    earth_radius_meters = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    return int(earth_radius_meters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def _first_photo_url(record: dict[str, Any]) -> str | None:
    photos = record.get("photos") or record.get("photo")
    if isinstance(photos, list):
        for item in photos:
            if isinstance(item, dict) and item.get("url"):
                return _safe_photo_url(str(item["url"]))
    if isinstance(photos, dict) and photos.get("url"):
        return _safe_photo_url(str(photos["url"]))
    return None


def _safe_photo_url(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.netloc.endswith("store.is.autonavi.com"):
        return None
    return url


def _fallback_center_for_place(place: str | None) -> tuple[float, float] | None:
    normalized = (place or "").strip()
    if any(keyword in normalized for keyword in ("香港中文大学深圳", "香港中文大学（深圳）", "港中深", "CUHK")):
        return CUHK_SHENZHEN_LATITUDE, CUHK_SHENZHEN_LONGITUDE
    return None


def unavailable_market_response(
    *,
    city: str | None,
    region: str | None,
    used_location: bool,
    message: str,
) -> NearbyShopSearchResponse:
    return NearbyShopSearchResponse(
        items=[],
        resolved_city=city or DEFAULT_CITY,
        resolved_region=region,
        used_location=used_location,
        available_sorts=["default", "distance"],
        source="unavailable",
        message=message,
    )


class NearbyShopProvider:
    def search_nearby(
        self,
        *,
        place: str | None,
        city: str | None,
        region: str | None,
        lat: float | None,
        lng: float | None,
        sort: str,
        style_id: str | None = None,
    ) -> NearbyShopSearchResponse:
        raise NotImplementedError


class GaodePoiSearchProvider(NearbyShopProvider):
    def __init__(
        self,
        *,
        api_key: str | None = None,
        around_api_url: str | None = None,
        geocode_api_url: str | None = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.gaode_api_key
        self.around_api_url = around_api_url or GAODE_POI_AROUND_API_BASE_URL
        self.geocode_api_url = geocode_api_url or GAODE_GEOCODE_API_BASE_URL
        self.timeout_seconds = timeout_seconds

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def search_nearby(
        self,
        *,
        place: str | None,
        city: str | None,
        region: str | None,
        lat: float | None,
        lng: float | None,
        sort: str,
    ) -> NearbyShopSearchResponse:
        if not self.is_configured:
            raise RuntimeError("高德 POI 配置不完整，请配置 GAODE_API_KEY")

        resolved_place = (place or "").strip()
        if resolved_place:
            return self._search_by_place(place=resolved_place, city=city, region=region, sort=sort)

        if lat is None or lng is None:
            raise RuntimeError("需要开启定位或输入城市/地名后才能搜索附近美甲店")

        return self._search_around(city=city, region=region, lat=lat, lng=lng, sort=sort)

    def _search_around(
        self,
        *,
        city: str | None,
        region: str | None,
        lat: float,
        lng: float,
        sort: str,
    ) -> NearbyShopSearchResponse:
        resolved_city = city or DEFAULT_CITY
        resolved_region = region
        resolved_sort = "distance" if sort == "distance" else "weight"
        params: dict[str, Any] = {
            "key": self.api_key,
            "location": f"{lng:.6f},{lat:.6f}",
            "keywords": GAODE_NAIL_KEYWORD,
            "radius": GAODE_DEFAULT_RADIUS_METERS,
            "sortrule": resolved_sort,
            "page_size": GAODE_DEFAULT_LIMIT,
            "page_num": GAODE_DEFAULT_PAGE,
            "show_fields": "business,photos",
            "output": "json",
        }
        if resolved_city:
            params["region"] = resolved_city
            params["city_limit"] = "false"

        response = httpx.get(self.around_api_url, params=params, timeout=self.timeout_seconds)
        response.raise_for_status()
        response_payload = response.json()
        if str(response_payload.get("status")) != "1":
            message = response_payload.get("info") or response_payload.get("message") or "高德 POI 查询失败"
            infocode = response_payload.get("infocode")
            raise RuntimeError(f"{message}{f'({infocode})' if infocode else ''}")

        mapped_items = [
            self._map_record(record, index=index, city=resolved_city, region=resolved_region)
            for index, record in enumerate(_extract_pois(response_payload))
        ]

        if resolved_region:
            region_filtered = [
                item
                for item in mapped_items
                if resolved_region in item.region
                or resolved_region in item.address
                or resolved_region in item.name
                or resolved_region in item.heat_text
            ]
            if region_filtered:
                mapped_items = region_filtered

        if sort == "distance":
            mapped_items.sort(
                key=lambda item: (
                    item.distance_meters is None,
                    item.distance_meters if item.distance_meters is not None else 999999999,
                    item.name,
                )
            )

        return NearbyShopSearchResponse(
            items=mapped_items,
            resolved_city=resolved_city,
            resolved_region=resolved_region,
            center_lat=lat,
            center_lng=lng,
            used_location=True,
            available_sorts=["default", "distance"],
            source="gaode",
            message=None if mapped_items else "附近暂未搜索到可展示的美甲店。",
        )

    def _search_by_place(
        self,
        *,
        place: str,
        city: str | None,
        region: str | None,
        sort: str,
    ) -> NearbyShopSearchResponse:
        lng, lat, resolved_city, resolved_region = self._geocode_place(place=place, city=city)
        result = self._search_around(
            city=resolved_city or city or DEFAULT_CITY,
            region=None,
            lat=lat,
            lng=lng,
            sort=sort,
        )
        result.resolved_region = region or resolved_region or place
        if not result.items:
            result.message = f"暂未搜索到“{place}”附近的美甲店。"
        return result

    def _geocode_place(self, *, place: str, city: str | None) -> tuple[float, float, str, str]:
        params: dict[str, Any] = {
            "key": self.api_key,
            "address": place,
            "output": "json",
        }
        if city:
            params["city"] = city

        response = httpx.get(self.geocode_api_url, params=params, timeout=self.timeout_seconds)
        response.raise_for_status()
        response_payload = response.json()
        if str(response_payload.get("status")) != "1":
            message = response_payload.get("info") or response_payload.get("message") or "高德地理编码失败"
            infocode = response_payload.get("infocode")
            raise RuntimeError(f"{message}{f'({infocode})' if infocode else ''}")

        geocodes = response_payload.get("geocodes") or []
        if isinstance(geocodes, dict):
            geocodes = [geocodes]
        if not isinstance(geocodes, list):
            geocodes = []

        for item in geocodes:
            if not isinstance(item, dict):
                continue
            lng, lat = _split_location(item.get("location"))
            if lng is None or lat is None:
                continue
            resolved_city = _coerce_str(item.get("city"), city or DEFAULT_CITY)
            resolved_region = (
                _coerce_str(item.get("formatted_address"))
                or _coerce_str(item.get("district"))
                or place
            )
            return lng, lat, resolved_city or city or DEFAULT_CITY, resolved_region

        raise RuntimeError(f"未找到“{place}”的位置信息")

    def _map_record(self, record: dict[str, Any], *, index: int, city: str, region: str | None) -> NearbyShopRead:
        business = record.get("business") if isinstance(record.get("business"), dict) else {}
        longitude, latitude = _split_location(record.get("location"))
        record_city = _coerce_str(record.get("cityname"), city)
        record_region = region or _coerce_str(record.get("adname")) or _coerce_str(business.get("business_area")) or "附近"
        cost = _coerce_str(business.get("cost"))
        rating = _coerce_float(business.get("rating"))
        business_time = _coerce_str(business.get("opentime_today")) or _coerce_str(business.get("opentime_week"))
        phone = _coerce_str(business.get("tel"))

        return NearbyShopRead(
            id=_coerce_str(record.get("id"), f"gaode-{index}"),
            name=_coerce_str(record.get("name"), "美甲店"),
            cover_image_url=_first_photo_url(record),
            city=record_city or city,
            region=record_region,
            address=_coerce_str(record.get("address"), "地址暂未开放"),
            latitude=latitude,
            longitude=longitude,
            distance_meters=_coerce_int(record.get("distance")),
            rating=rating,
            heat_text=_coerce_str(business.get("business_area")),
            average_price_text=f"人均¥{cost}" if cost else "价格到店咨询",
            business_time_text=business_time or None,
            phone_text=phone or None,
        )


class MarketService:
    def __init__(self, provider: NearbyShopProvider | None = None) -> None:
        self.provider = provider or GaodePoiSearchProvider()

    def search_nearby(
        self,
        *,
        db: Session | None = None,
        place: str | None,
        city: str | None,
        region: str | None,
        lat: float | None,
        lng: float | None,
        sort: str,
        style_id: str | None = None,
    ) -> NearbyShopSearchResponse:
        normalized_sort = sort if sort in {"default", "distance"} else "default"
        if not (place or "").strip() and (lat is None or lng is None):
            return unavailable_market_response(
                city=city,
                region=region,
                used_location=False,
                message="需要开启定位或输入城市/地名后才能搜索附近美甲店。",
            )

        try:
            result = self.provider.search_nearby(
                place=place,
                city=city,
                region=region,
                lat=lat,
                lng=lng,
                sort=normalized_sort,
            )
            return self._merge_platform_shops(db, result, sort=normalized_sort, style_id=style_id)
        except Exception as exc:
            result = unavailable_market_response(
                city=city,
                region=region,
                used_location=not bool((place or "").strip()),
                message=f"暂时无法访问高德 POI 接口：{exc}",
            )
            fallback_center = _fallback_center_for_place(place)
            if fallback_center is not None:
                result.center_lat, result.center_lng = fallback_center
                result.resolved_region = region or place
            elif lat is not None and lng is not None:
                result.center_lat = lat
                result.center_lng = lng
            return self._merge_platform_shops(db, result, sort=normalized_sort, style_id=style_id)

    def _merge_platform_shops(
        self,
        db: Session | None,
        result: NearbyShopSearchResponse,
        *,
        sort: str,
        style_id: str | None,
    ) -> NearbyShopSearchResponse:
        if db is None or result.center_lat is None or result.center_lng is None:
            return result

        claimed_shop_ids = (
            set(db.scalars(select(MerchantTrendClaim.shop_id).where(MerchantTrendClaim.style_id == style_id)))
            if style_id
            else set()
        )
        platform_items: list[NearbyShopRead] = []
        for shop in db.scalars(select(MerchantShop).order_by(MerchantShop.is_default.desc(), MerchantShop.created_at.asc())):
            if shop.latitude is None or shop.longitude is None:
                continue
            distance = _distance_meters(result.center_lat, result.center_lng, shop.latitude, shop.longitude)
            if distance > PLATFORM_SHOP_SEARCH_RADIUS_METERS:
                continue
            platform_items.append(
                self._map_platform_shop(
                    db,
                    shop,
                    distance_meters=distance,
                    can_do_style=shop.id in claimed_shop_ids,
                )
            )

        if not platform_items:
            return result

        existing_platform_ids = {item.platform_shop_id for item in result.items if item.platform_shop_id}
        merged_items = [item for item in platform_items if item.platform_shop_id not in existing_platform_ids] + result.items
        if style_id:
            merged_items.sort(
                key=lambda item: (
                    not item.can_do_style,
                    item.distance_meters is None,
                    item.distance_meters if item.distance_meters is not None else 999999999,
                    item.name,
                )
            )
        elif sort == "distance":
            merged_items.sort(
                key=lambda item: (
                    item.distance_meters is None,
                    item.distance_meters if item.distance_meters is not None else 999999999,
                    item.name,
                )
            )
        result.items = merged_items
        if result.source == "unavailable":
            result.message = None if merged_items else result.message
        return result

    def _map_platform_shop(self, db: Session, shop: MerchantShop, *, distance_meters: int, can_do_style: bool = False) -> NearbyShopRead:
        cover_style = db.scalar(
            select(NailStyle)
            .where(NailStyle.shop_id == shop.id)
            .order_by(NailStyle.is_trending.desc(), NailStyle.popularity_score.desc(), NailStyle.created_at.desc())
        )
        merchant_name = shop.merchant.username if shop.merchant is not None else shop.name
        is_keke = merchant_name == "keke" or shop.name == "keke"
        return NearbyShopRead(
            id=f"platform-{shop.id}",
            platform_shop_id=shop.id,
            merchant_user_id=shop.merchant_user_id,
            name=shop.name,
            cover_image_url=cover_style.image_url if cover_style is not None else GAODE_PLACEHOLDER_COVER_URL,
            city=shop.city or DEFAULT_CITY,
            region=KEKE_SHOP_REGION if is_keke else shop.city or DEFAULT_CITY,
            address=shop.address or "地址暂未开放",
            latitude=shop.latitude,
            longitude=shop.longitude,
            distance_meters=distance_meters,
            rating=KEKE_SHOP_RATING if is_keke else None,
            heat_text=KEKE_SHOP_REGION if is_keke else "平台商家",
            average_price_text=KEKE_SHOP_AVERAGE_PRICE_TEXT if is_keke else "价格到店咨询",
            business_time_text=KEKE_SHOP_BUSINESS_TIME_TEXT if is_keke else None,
            phone_text=shop.contact_phone,
            can_do_style=can_do_style,
        )
