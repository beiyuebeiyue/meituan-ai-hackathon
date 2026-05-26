from __future__ import annotations

from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.models.tryon_job import TryOnJob
from app.models.user import User


def _register_and_login(client, *, phone: str, username: str) -> tuple[dict[str, str], dict[str, object]]:
    client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "password": "pass123456", "username": username},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": phone, "password": "pass123456"},
    )
    payload = response.json()
    return {"Authorization": f"Bearer {payload['access_token']}"}, payload["user"]


def _promote_to_merchant(db_session, user_payload: dict[str, object]) -> User:
    user = db_session.get(User, user_payload["id"])
    assert user is not None
    user.role = "merchant"
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _ops_headers(client) -> dict[str, str]:
    response = client.post("/api/v1/ops/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_trend_campaign_claim_prioritizes_market_and_sends_tryon_result(client, db_session, image_factory):
    merchant_headers, merchant_payload = _register_and_login(client, phone="13960000001", username="trend_merchant")
    _other_headers, other_payload = _register_and_login(client, phone="13960000002", username="other_merchant")
    consumer_headers, consumer_payload = _register_and_login(client, phone="13960000003", username="trend_consumer")
    merchant = _promote_to_merchant(db_session, merchant_payload)
    other_merchant = _promote_to_merchant(db_session, other_payload)

    shop = MerchantShop(
        merchant_user_id=merchant.id,
        name="可做这款的店",
        city="深圳",
        address="南山区科技园",
        latitude=22.5431,
        longitude=114.0579,
        is_default=True,
    )
    other_shop = MerchantShop(
        merchant_user_id=other_merchant.id,
        name="普通门店",
        city="深圳",
        address="南山区后海",
        latitude=22.5432,
        longitude=114.058,
        is_default=True,
    )
    style = NailStyle(
        title="手工甲热门款",
        description="适合推给商家的手工甲",
        image_url="http://example.com/handmade.png",
        local_image_path=str(image_factory("handmade.png")),
        source_type="user_upload",
        nail_type="handmade",
        tags_json=["手工甲", "通勤"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=99,
        is_trending=True,
        shop_id=shop.id,
    )
    db_session.add_all([shop, other_shop, style])
    db_session.commit()
    db_session.refresh(style)

    candidates = client.get("/api/v1/ops/trend-nails/candidates?limit=10", headers=_ops_headers(client))
    assert candidates.status_code == 200
    assert any(item["id"] == style.id for item in candidates.json()["items"])

    campaign_response = client.post(
        "/api/v1/ops/trend-nail-campaigns",
        headers=_ops_headers(client),
        json={"title": "热门手工甲", "description": "请登记可做款式", "style_ids": [style.id]},
    )
    assert campaign_response.status_code == 200
    campaign = campaign_response.json()
    assert campaign["merchant_count"] >= 2

    notifications = client.get("/api/v1/merchant/trend-notifications", headers=merchant_headers)
    assert notifications.status_code == 200
    assert notifications.json()["items"][0]["styles"][0]["id"] == style.id

    claim_response = client.post(
        "/api/v1/merchant/trend-claims",
        headers=merchant_headers,
        json={"style_id": style.id, "campaign_id": campaign["id"]},
    )
    assert claim_response.status_code == 200
    assert claim_response.json()["can_do_style"] is True

    market_response = client.get(
        f"/api/v1/market/shops/nearby?city=深圳&lat=22.5431&lng=114.0579&style_id={style.id}&sort=distance"
    )
    assert market_response.status_code == 200
    shops = market_response.json()["items"]
    assert shops[0]["platform_shop_id"] == shop.id
    assert shops[0]["can_do_style"] is True
    assert shops[0]["merchant_user_id"] == merchant.id

    job = TryOnJob(
        user_id=consumer_payload["id"],
        hand_image_path="data/hand.png",
        selected_style_id=style.id,
        status="succeeded",
        stage="succeeded",
        result_image_path="data/tryon.png",
        result_image_url="/files/tryon_results/demo.png",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    message_response = client.post(
        f"/api/v1/messages/conversations/{merchant.id}/tryon-results",
        headers=consumer_headers,
        json={"tryon_job_id": job.id, "content": "这款能做吗？"},
    )
    assert message_response.status_code == 200
    payload = message_response.json()
    assert payload["image_url"] == "/files/tryon_results/demo.png"
    assert payload["shared_style"]["id"] == style.id
