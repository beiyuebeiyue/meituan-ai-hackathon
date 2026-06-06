from __future__ import annotations

from starlette.requests import Request

from app.core.config import get_settings
from app.utils import ip_location
from app.utils.ip_location import request_ip_location


def _request(headers: dict[str, str] | None = None, client_host: str = "203.0.113.10") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/login",
            "headers": [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()],
            "client": (client_host, 12345),
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


def test_cloudflare_country_header_is_used(monkeypatch):
    monkeypatch.setenv("IP_GEOLOCATION_ENABLED", "false")
    get_settings.cache_clear()

    location = request_ip_location(_request(headers={"cf-ipcountry": "CN", "cf-connecting-ip": "8.8.8.8"}))

    assert location == "中国"


def test_cloudflare_connecting_ip_uses_provider_location(monkeypatch):
    monkeypatch.setenv("IP_GEOLOCATION_ENABLED", "true")
    get_settings.cache_clear()

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"status": "success", "country": "中国", "regionName": "广东省", "city": "深圳市"}

    captured: dict[str, object] = {}

    def fake_get(url: str, **kwargs):
        captured["url"] = url
        captured["kwargs"] = kwargs
        return FakeResponse()

    monkeypatch.setattr(ip_location.httpx, "get", fake_get)

    location = request_ip_location(_request(headers={"cf-connecting-ip": "8.8.8.8"}))

    assert location == "中国广东省深圳市"
    assert captured["url"] == "http://ip-api.com/json/8.8.8.8"


def test_public_ip_without_geo_data_falls_back_to_internet(monkeypatch):
    monkeypatch.setenv("IP_GEOLOCATION_ENABLED", "false")
    get_settings.cache_clear()

    location = request_ip_location(_request(headers={"x-forwarded-for": "8.8.8.8, 10.0.0.1"}))

    assert location == "互联网"


def test_private_ip_still_displays_local(monkeypatch):
    monkeypatch.setenv("IP_GEOLOCATION_ENABLED", "true")
    get_settings.cache_clear()

    location = request_ip_location(_request(client_host="127.0.0.1"))

    assert location == "本地"
