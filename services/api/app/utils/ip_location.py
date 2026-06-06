from __future__ import annotations

from ipaddress import ip_address
from urllib.parse import unquote

from fastapi import Request
import httpx

from app.core.config import get_settings


COUNTRY_LABELS = {
    "CN": "中国",
    "HK": "中国香港",
    "MO": "中国澳门",
    "TW": "中国台湾",
    "US": "美国",
    "JP": "日本",
    "KR": "韩国",
    "SG": "新加坡",
    "AU": "澳大利亚",
    "GB": "英国",
    "CA": "加拿大",
}


def _header_value(request: Request, *names: str) -> str | None:
    for name in names:
        value = request.headers.get(name)
        if value and value.strip().lower() != "unknown":
            return unquote(value.strip())
    return None


def _client_ip(request: Request) -> str | None:
    cf_connecting_ip = request.headers.get("cf-connecting-ip")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",", 1)[0].strip()
        if first_ip:
            return first_ip
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else None


def _country_label(country: str | None) -> str | None:
    if not country:
        return None
    normalized = country.strip()
    if not normalized or normalized.upper() == "XX":
        return None
    if len(normalized) == 2 and normalized.isalpha():
        return COUNTRY_LABELS.get(normalized.upper(), normalized.upper())
    return normalized


def _join_location(*parts: str | None) -> str | None:
    cleaned: list[str] = []
    for part in parts:
        value = (part or "").strip()
        if value and value.lower() != "unknown" and value not in cleaned:
            cleaned.append(value)
    return "".join(cleaned) if cleaned else None


def _provider_ip_location(client_ip: str) -> str | None:
    settings = get_settings()
    if not settings.ip_geolocation_enabled or settings.ip_geolocation_provider != "ip-api":
        return None

    try:
        response = httpx.get(
            f"http://ip-api.com/json/{client_ip}",
            params={"fields": "status,country,regionName,city", "lang": "zh-CN"},
            timeout=settings.ip_geolocation_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return None

    if payload.get("status") != "success":
        return None
    return _join_location(
        str(payload.get("country") or ""),
        str(payload.get("regionName") or ""),
        str(payload.get("city") or ""),
    )


def request_ip_location(request: Request) -> str:
    direct_location = _header_value(request, "x-ip-location", "x-geo-location")
    if direct_location:
        return direct_location

    province = _header_value(request, "x-geo-province", "x-vercel-ip-country-region")
    city = _header_value(request, "x-geo-city", "x-vercel-ip-city")
    if province and city and city not in province:
        return f"{province}{city}"
    if city:
        return city
    if province:
        return province

    country = _country_label(_header_value(request, "cf-ipcountry", "x-vercel-ip-country"))
    if country:
        return country

    client_ip = _client_ip(request)
    if not client_ip:
        return "未知"
    try:
        parsed_ip = ip_address(client_ip)
    except ValueError:
        return "未知"
    if parsed_ip.is_loopback or parsed_ip.is_private:
        return "本地"

    provider_location = _provider_ip_location(client_ip)
    if provider_location:
        return provider_location
    return "互联网"
