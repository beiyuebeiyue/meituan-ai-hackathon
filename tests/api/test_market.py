from __future__ import annotations

from app.services.market_service import GaodePoiSearchProvider, MarketService, NearbyShopProvider


def test_market_requires_location(client):
    response = client.get("/api/v1/market/shops/nearby?city=深圳&sort=default")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "unavailable"
    assert payload["used_location"] is False
    assert payload["items"] == []
    assert "定位" in payload["message"]


def test_market_without_gaode_key_returns_prompt_without_demo_data(client):
    service = MarketService(
        provider=GaodePoiSearchProvider(
            api_key="",
            around_api_url="https://example.test/place/around",
        )
    )
    result = service.search_nearby(place=None, city="深圳", region=None, lat=22.5431, lng=114.0579, sort="distance")

    assert result.source == "unavailable"
    assert result.used_location is True
    assert result.items == []
    assert result.message and "高德 POI" in result.message


def test_gaode_provider_maps_success_response(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "1",
                "info": "OK",
                "pois": [
                    {
                        "id": "B001",
                        "name": "甲甲美学",
                        "type": "生活服务;美容美发店;美容美发店",
                        "typecode": "071100",
                        "address": "科技园路100号",
                        "location": "114.057900,22.543100",
                        "distance": "120",
                        "pname": "广东省",
                        "cityname": "深圳市",
                        "adname": "南山区",
                        "business": {"rating": "4.8", "cost": "88", "opentime_today": "10:00-22:00", "tel": "0755-12345678"},
                        "photos": [{"url": "https://example.test/shop.jpg"}],
                    }
                ],
            }

    def fake_get(url, *, params, timeout):
        assert url == "https://example.test/place/around"
        assert params["key"] == "gaode-key"
        assert params["keywords"] == "美甲"
        assert params["location"] == "114.057900,22.543100"
        assert params["radius"] == 5000
        assert params["sortrule"] == "distance"
        assert params["page_size"] == 25
        assert params["page_num"] == 1
        assert params["show_fields"] == "business,photos"
        assert timeout == 15.0
        return FakeResponse()

    monkeypatch.setattr("app.services.market_service.httpx.get", fake_get)
    provider = GaodePoiSearchProvider(
        api_key="gaode-key",
        around_api_url="https://example.test/place/around",
    )

    result = provider.search_nearby(place=None, city="深圳", region=None, lat=22.5431, lng=114.0579, sort="distance")

    assert result.source == "gaode"
    assert result.used_location is True
    assert result.items[0].id == "B001"
    assert result.items[0].name == "甲甲美学"
    assert result.items[0].distance_meters == 120
    assert result.items[0].address == "科技园路100号"
    assert result.items[0].latitude == 22.5431
    assert result.items[0].longitude == 114.0579
    assert result.items[0].rating == 4.8
    assert result.items[0].cover_image_url == "https://example.test/shop.jpg"
    assert result.items[0].average_price_text == "人均¥88"
    assert result.items[0].business_time_text == "10:00-22:00"
    assert result.items[0].phone_text == "0755-12345678"


def test_gaode_provider_does_not_fake_unreachable_autonavi_photo_urls(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "1",
                "info": "OK",
                "pois": [
                    {
                        "id": "B001",
                        "name": "甲甲美学",
                        "address": "科技园路100号",
                        "location": "114.057900,22.543100",
                        "cityname": "深圳市",
                        "adname": "南山区",
                        "photos": [{"url": "https://store.is.autonavi.com/showpic/e23ace19551f7cd0291d05d6bb841bcf"}],
                    }
                ],
            }

    monkeypatch.setattr("app.services.market_service.httpx.get", lambda *args, **kwargs: FakeResponse())
    provider = GaodePoiSearchProvider(
        api_key="gaode-key",
        around_api_url="https://example.test/place/around",
    )

    result = provider.search_nearby(place=None, city="深圳", region=None, lat=22.5431, lng=114.0579, sort="distance")

    assert result.items[0].cover_image_url is None


def test_gaode_provider_uses_fixed_nail_keyword(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"status": "1", "pois": []}

    def fake_get(url, *, params, timeout):
        assert params["keywords"] == "美甲"
        assert params["sortrule"] == "weight"
        return FakeResponse()

    monkeypatch.setattr("app.services.market_service.httpx.get", fake_get)
    provider = GaodePoiSearchProvider(
        api_key="gaode-key",
        around_api_url="https://example.test/place/around",
    )

    result = provider.search_nearby(place=None, city="深圳", region=None, lat=22.5431, lng=114.0579, sort="default")

    assert result.source == "gaode"


def test_gaode_provider_geocodes_place_before_around_search(monkeypatch):
    class FakeGeocodeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "1",
                "geocodes": [
                    {
                        "formatted_address": "广东省深圳市龙岗区香港中文大学深圳",
                        "city": "深圳市",
                        "district": "龙岗区",
                        "location": "114.206900,22.693200",
                    }
                ],
            }

    class FakeAroundResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "1",
                "pois": [
                    {
                        "id": "B002",
                        "name": "南山美甲社",
                        "address": "南山大道1号",
                        "location": "113.931000,22.533900",
                        "distance": "80",
                        "cityname": "深圳市",
                        "adname": "南山区",
                    }
                ],
            }

    calls = []

    def fake_get(url, *, params, timeout):
        calls.append((url, params))
        if url == "https://example.test/geocode/geo":
            assert params["key"] == "gaode-key"
            assert params["address"] == "香港中文大学深圳"
            assert params["city"] == "深圳"
            return FakeGeocodeResponse()
        assert url == "https://example.test/place/around"
        assert params["keywords"] == "美甲"
        assert params["location"] == "114.206900,22.693200"
        assert params["radius"] == 5000
        assert params["sortrule"] == "weight"
        assert params["show_fields"] == "business,photos"
        return FakeAroundResponse()

    monkeypatch.setattr("app.services.market_service.httpx.get", fake_get)
    provider = GaodePoiSearchProvider(
        api_key="gaode-key",
        around_api_url="https://example.test/place/around",
        geocode_api_url="https://example.test/geocode/geo",
    )

    result = provider.search_nearby(place="香港中文大学深圳", city="深圳", region=None, lat=None, lng=None, sort="default")

    assert result.source == "gaode"
    assert result.used_location is True
    assert result.resolved_city == "深圳市"
    assert result.resolved_region == "广东省深圳市龙岗区香港中文大学深圳"
    assert result.items[0].name == "南山美甲社"
    assert [call[0] for call in calls] == [
        "https://example.test/geocode/geo",
        "https://example.test/place/around",
    ]


def test_gaode_provider_treats_region_input_as_geocoded_center(monkeypatch):
    class FakeGeocodeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "1",
                "geocodes": [
                    {
                        "formatted_address": "广东省深圳市龙岗区",
                        "city": "深圳市",
                        "district": "龙岗区",
                        "location": "114.246884,22.720889",
                    }
                ],
            }

    class FakeAroundResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "status": "1",
                "pois": [
                    {
                        "id": "B003",
                        "name": "龙岗美甲店",
                        "address": "龙岗中心城",
                        "location": "114.247000,22.721000",
                        "distance": "60",
                        "cityname": "深圳市",
                        "adname": "龙岗区",
                    }
                ],
            }

    calls = []

    def fake_get(url, *, params, timeout):
        calls.append((url, params))
        if url == "https://example.test/geocode/geo":
            assert params["address"] == "龙岗区"
            assert params["city"] == "深圳"
            return FakeGeocodeResponse()
        assert url == "https://example.test/place/around"
        assert params["keywords"] == "美甲"
        assert params["location"] == "114.246884,22.720889"
        assert "region" in params
        return FakeAroundResponse()

    monkeypatch.setattr("app.services.market_service.httpx.get", fake_get)
    provider = GaodePoiSearchProvider(
        api_key="gaode-key",
        around_api_url="https://example.test/place/around",
        geocode_api_url="https://example.test/geocode/geo",
    )

    result = provider.search_nearby(place="龙岗区", city="深圳", region=None, lat=None, lng=None, sort="default")

    assert result.source == "gaode"
    assert result.used_location is True
    assert result.resolved_city == "深圳市"
    assert result.resolved_region == "广东省深圳市龙岗区"
    assert result.items[0].name == "龙岗美甲店"
    assert [call[0] for call in calls] == [
        "https://example.test/geocode/geo",
        "https://example.test/place/around",
    ]


def test_market_service_returns_unavailable_when_provider_fails():
    class FailingProvider(NearbyShopProvider):
        def search_nearby(self, *, place, city, region, lat, lng, sort):
            raise RuntimeError("INVALID_USER_KEY")

    service = MarketService(provider=FailingProvider())

    result = service.search_nearby(place=None, city="深圳", region=None, lat=22.5431, lng=114.0579, sort="default")

    assert result.source == "unavailable"
    assert result.items == []
    assert result.message and "暂时无法访问高德 POI 接口" in result.message
