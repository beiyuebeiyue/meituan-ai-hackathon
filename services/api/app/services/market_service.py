from __future__ import annotations

import hashlib
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.market import NearbyShopRead, NearbyShopSearchResponse


DEFAULT_CITY = "广州"
MEITUAN_NAIL_KEYWORD = "美甲"
MEITUAN_NAIL_CATEGORY = "丽人"
MEITUAN_DEFAULT_RADIUS_METERS = 5000
MEITUAN_DEFAULT_PAGE = 1
MEITUAN_DEFAULT_LIMIT = 25
MEITUAN_PLACEHOLDER_COVER_URL = (
    "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=1200&q=80"
)


def build_meituan_poi_sign(params: dict[str, Any], appsecret: str) -> str:
    normalized: dict[str, str] = {}
    for raw_key, raw_value in params.items():
        key = raw_key.lower()
        if key in {"sign", "appsecret", "appsecrect"}:
            continue
        if raw_value is None or raw_value == "":
            continue
        normalized[key] = str(raw_value)

    payload = appsecret + "".join(f"{key}{normalized[key]}" for key in sorted(normalized)) + appsecret
    return hashlib.md5(payload.encode("utf-8")).hexdigest().lower()


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
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
        keyword: str | None,
        city: str | None,
        region: str | None,
        lat: float | None,
        lng: float | None,
        sort: str,
    ) -> NearbyShopSearchResponse:
        raise NotImplementedError


class MeituanPoiSearchProvider(NearbyShopProvider):
    def __init__(
        self,
        *,
        appkey: str | None = None,
        appsecret: str | None = None,
        session: str | None = None,
        api_base_url: str | None = None,
        timeout_seconds: float = 5.0,
    ) -> None:
        settings = get_settings()
        self.appkey = appkey if appkey is not None else settings.meituan_poi_appkey
        self.appsecret = appsecret if appsecret is not None else settings.meituan_poi_appsecret
        self.session = session if session is not None else settings.meituan_poi_session
        self.api_base_url = api_base_url if api_base_url is not None else settings.meituan_poi_api_base_url
        self.timeout_seconds = timeout_seconds

    @property
    def is_configured(self) -> bool:
        return bool(self.appkey and self.appsecret and self.session and self.api_base_url)

    def search_nearby(
        self,
        *,
        keyword: str | None,
        city: str | None,
        region: str | None,
        lat: float | None,
        lng: float | None,
        sort: str,
    ) -> NearbyShopSearchResponse:
        if not self.is_configured:
            raise RuntimeError("美团 POI 配置不完整")
        if lat is None or lng is None:
            raise RuntimeError("需要开启定位后才能搜索附近美甲店")
        resolved_keyword = (keyword or "").strip() or MEITUAN_NAIL_KEYWORD

        payload: dict[str, Any] = {
            "appkey": self.appkey,
            "session": self.session,
            "timestamp": str(int(time.time() * 1000)),
            "keyword": resolved_keyword,
            "categories": MEITUAN_NAIL_CATEGORY,
            "radius": MEITUAN_DEFAULT_RADIUS_METERS,
            "page": MEITUAN_DEFAULT_PAGE,
            "limit": MEITUAN_DEFAULT_LIMIT,
            "latitude": lat,
            "longitude": lng,
        }
        if city:
            payload["city"] = city

        payload["sign"] = build_meituan_poi_sign(payload, self.appsecret)

        response = httpx.post(self.api_base_url, json=payload, timeout=self.timeout_seconds)
        response.raise_for_status()
        response_payload = response.json()
        if response_payload.get("status") != "OK":
            message = response_payload.get("message") or response_payload.get("msg") or "美团 POI 查询失败"
            raise RuntimeError(str(message))

        records = response_payload.get("records") or []
        if not isinstance(records, list):
            raise RuntimeError("美团 POI 响应格式异常")

        resolved_city = city or DEFAULT_CITY
        mapped_items = [
            self._map_record(record, index=index, city=resolved_city, region=region)
            for index, record in enumerate(records)
            if isinstance(record, dict)
        ]

        if region:
            region_filtered = [
                item
                for item in mapped_items
                if region in item.region or region in item.address or region in item.name or region in item.heat_text
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
            resolved_region=region,
            used_location=True,
            available_sorts=["default", "distance"],
            source="meituan",
            message=None if mapped_items else "附近暂未搜索到可展示的美甲店。",
        )

    def _map_record(self, record: dict[str, Any], *, index: int, city: str, region: str | None) -> NearbyShopRead:
        name = str(record.get("name") or "美甲店")
        branch_name = str(record.get("branchname") or record.get("branchName") or "").strip()
        full_name = f"{name}·{branch_name}" if branch_name and branch_name not in name else name
        category = str(record.get("category") or MEITUAN_NAIL_CATEGORY)

        return NearbyShopRead(
            id=str(record.get("openshopid") or record.get("openShopId") or record.get("poiId") or f"meituan-{index}"),
            name=full_name,
            cover_image_url=str(record.get("cover_image_url") or record.get("coverImageUrl") or MEITUAN_PLACEHOLDER_COVER_URL),
            city=city,
            region=region or category or "附近",
            address=str(record.get("shopaddress") or record.get("shopAddress") or record.get("address") or "地址暂未开放"),
            latitude=_coerce_float(record.get("latitude")),
            longitude=_coerce_float(record.get("longitude")),
            distance_meters=_coerce_int(record.get("distance")),
            rating=_coerce_float(record.get("rating")) or 0,
            heat_text=category or "美团点评门店",
            average_price_text=str(record.get("average_price_text") or record.get("avgPrice") or "价格到店咨询"),
        )


class MarketService:
    def __init__(self, provider: NearbyShopProvider | None = None, *, enabled: bool | None = None) -> None:
        settings = get_settings()
        self.enabled = settings.meituan_poi_enabled if enabled is None else enabled
        self.provider = provider or MeituanPoiSearchProvider()

    def search_nearby(
        self,
        *,
        keyword: str | None,
        city: str | None,
        region: str | None,
        lat: float | None,
        lng: float | None,
        sort: str,
    ) -> NearbyShopSearchResponse:
        normalized_sort = sort if sort in {"default", "distance"} else "default"
        if lat is None or lng is None:
            return unavailable_market_response(
                city=city,
                region=region,
                used_location=False,
                message="需要开启定位后才能搜索附近美甲店。",
            )
        if not self.enabled:
            return unavailable_market_response(
                city=city,
                region=region,
                used_location=True,
                message="美团 POI 接口尚未启用，请配置 MEITUAN_POI_ENABLED 和接口密钥。",
            )

        try:
            return self.provider.search_nearby(
                keyword=keyword,
                city=city,
                region=region,
                lat=lat,
                lng=lng,
                sort=normalized_sort,
            )
        except Exception as exc:
            return unavailable_market_response(
                city=city,
                region=region,
                used_location=True,
                message=f"暂时无法访问美团 POI 接口：{exc}",
            )
