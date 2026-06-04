from __future__ import annotations

from ipaddress import ip_address
from urllib.parse import unquote

from fastapi import Request


def _header_value(request: Request, *names: str) -> str | None:
    for name in names:
        value = request.headers.get(name)
        if value and value.strip().lower() != "unknown":
            return unquote(value.strip())
    return None


def _client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",", 1)[0].strip()
        if first_ip:
            return first_ip
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else None


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

    country = _header_value(request, "x-vercel-ip-country")
    if country and country != "XX":
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
    return "未知"
