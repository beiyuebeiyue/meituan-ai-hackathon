from __future__ import annotations

from app.services.market_service import (
    MarketService,
    MeituanPoiSearchProvider,
    NearbyShopProvider,
    build_meituan_poi_sign,
)


def test_market_requires_location(client):
    response = client.get("/api/v1/market/shops/nearby?city=广州&sort=default")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "unavailable"
    assert payload["used_location"] is False
    assert payload["items"] == []
    assert "定位" in payload["message"]


def test_market_disabled_returns_prompt_without_demo_data(client):
    response = client.get(
        "/api/v1/market/shops/nearby",
        params={
            "city": "广州",
            "lat": 23.1324,
            "lng": 113.3229,
            "sort": "distance",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "unavailable"
    assert payload["used_location"] is True
    assert payload["items"] == []
    assert "美团 POI 接口尚未启用" in payload["message"]


def test_meituan_poi_sign_sorts_lowercases_and_ignores_empty_values():
    sign = build_meituan_poi_sign(
        {
            "B": "2",
            "a": "1",
            "AB": "3",
            "empty": "",
            "none": None,
            "sign": "ignored",
        },
        "xyz",
    )

    assert sign == "32d22b4bb85983b360ade00ffb469420"


def test_meituan_provider_maps_success_response(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "OK",
                "records": [
                    {
                        "openshopid": "shop-1",
                        "name": "甲甲美学",
                        "branchname": "天河店",
                        "distance": 120,
                        "shopaddress": "天河路100号",
                        "category": "丽人",
                    }
                ],
            }

    def fake_post(url, *, json, timeout):
        assert url == "https://example.test/search"
        assert json["keyword"] == "甲甲美学"
        assert json["categories"] == "丽人"
        assert json["radius"] == 5000
        assert json["limit"] == 25
        assert json["latitude"] == 23.12
        assert json["longitude"] == 113.32
        assert json["sign"]
        assert timeout == 5.0
        return FakeResponse()

    monkeypatch.setattr("app.services.market_service.httpx.post", fake_post)
    provider = MeituanPoiSearchProvider(
        appkey="app-key",
        appsecret="app-secret",
        session="session",
        api_base_url="https://example.test/search",
    )

    result = provider.search_nearby(keyword="甲甲美学", city="广州", region=None, lat=23.12, lng=113.32, sort="distance")

    assert result.source == "meituan"
    assert result.used_location is True
    assert result.items[0].id == "shop-1"
    assert result.items[0].name == "甲甲美学·天河店"
    assert result.items[0].distance_meters == 120
    assert result.items[0].address == "天河路100号"
    assert result.items[0].latitude is None


def test_meituan_provider_uses_default_keyword_when_empty(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": "OK", "records": []}

    def fake_post(url, *, json, timeout):
        assert json["keyword"] == "美甲"
        return FakeResponse()

    monkeypatch.setattr("app.services.market_service.httpx.post", fake_post)
    provider = MeituanPoiSearchProvider(
        appkey="app-key",
        appsecret="app-secret",
        session="session",
        api_base_url="https://example.test/search",
    )

    result = provider.search_nearby(keyword="", city="广州", region=None, lat=23.12, lng=113.32, sort="default")

    assert result.source == "meituan"


def test_market_service_returns_unavailable_when_provider_fails():
    class FailingProvider(NearbyShopProvider):
        def search_nearby(self, *, keyword, city, region, lat, lng, sort):
            raise RuntimeError("unauthorized")

    service = MarketService(provider=FailingProvider(), enabled=True)

    result = service.search_nearby(keyword=None, city="广州", region=None, lat=23.1324, lng=113.3229, sort="default")

    assert result.source == "unavailable"
    assert result.items == []
    assert result.message and "暂时无法访问美团 POI 接口" in result.message
