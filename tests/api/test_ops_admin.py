from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models.booking import Booking
from app.models.direct_message import DirectMessage
from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.models.tryon_job import TryOnJob
from app.models.user import User
from app.models.user_favorite import UserFavorite
from app.models.user_hand_photo import UserHandPhoto
from app.models.user_post import UserPost
from app.models.user_style_like import UserStyleLike
from app.services.ops_admin_service import OpsAdminService


def _ops_headers(client) -> dict[str, str]:
    response = client.post("/api/v1/ops/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _consumer(uid: int, username: str, created_at: datetime | None = None) -> User:
    user = User(
        uid=uid,
        phone=f"139{uid:08d}"[:11],
        password_hash=get_password_hash("password"),
        username=username,
        role="consumer",
        last_login_ip_location="上海",
    )
    if created_at is not None:
        user.created_at = created_at
        user.updated_at = created_at
    return user


def test_ops_login_success_and_failure(client):
    success = client.post("/api/v1/ops/auth/login", json={"username": "admin", "password": "admin"})
    assert success.status_code == 200
    assert success.json()["token_type"] == "bearer"
    assert success.json()["access_token"]

    failure = client.post("/api/v1/ops/auth/login", json={"username": "admin", "password": "wrong"})
    assert failure.status_code == 401


def test_ops_dashboard_metrics_and_popular_nails(client, db_session, image_factory):
    settings = get_settings()
    local_today = datetime.now(ZoneInfo(settings.ops_report_timezone)).date()
    yesterday = datetime.combine(local_today - timedelta(days=1), datetime.min.time(), tzinfo=ZoneInfo(settings.ops_report_timezone))
    old_user = _consumer(90000001, "old_consumer", yesterday)
    user = _consumer(90000002, "today_consumer")
    db_session.add_all([old_user, user])
    db_session.commit()

    shop = db_session.query(MerchantShop).first()
    assert shop is not None

    style = NailStyle(
        title="运营测试款",
        description="desc",
        image_url="http://example.com/style.png",
        local_image_path=str(image_factory("style.png")),
        source_type="test",
        tags_json=["法式"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=10,
        is_trending=True,
        shop_id=shop.id,
    )
    db_session.add(style)
    db_session.commit()
    db_session.refresh(style)

    completed = Booking(
        user_id=user.id,
        merchant_user_id=shop.merchant_user_id,
        shop_id=shop.id,
        style_id=style.id,
        appointment_time="今天 18:00",
        contact_phone="13900000000",
        status="completed",
    )
    pending = Booking(
        user_id=user.id,
        merchant_user_id=shop.merchant_user_id,
        shop_id=shop.id,
        style_id=style.id,
        appointment_time="明天 18:00",
        contact_phone="13900000000",
        status="pending",
    )
    db_session.add_all(
        [
            completed,
            pending,
            TryOnJob(
                user_id=user.id,
                hand_image_path="data/hand.png",
                selected_style_id=style.id,
                result_image_path="data/result.png",
                result_image_url="/files/result.png",
                status="completed",
                stage="done",
            ),
            UserPost(
                user_id=user.id,
                shop_id=shop.id,
                title="用户晒图",
                description="desc",
                image_url="/files/post.png",
                local_image_path="data/post.png",
                tags_json=[],
            ),
            UserHandPhoto(user_id=user.id, image_path="data/hand.png", image_url="/files/hand.png", sha256="a" * 64),
            UserStyleLike(user_id=user.id, nail_style_id=style.id),
            UserFavorite(user_id=user.id, nail_style_id=style.id),
            DirectMessage(sender_user_id=user.id, recipient_user_id=old_user.id, content="share", shared_style_id=style.id),
        ]
    )
    db_session.commit()

    unauthorized = client.get("/api/v1/ops/dashboard")
    assert unauthorized.status_code == 401

    response = client.get("/api/v1/ops/dashboard", headers=_ops_headers(client))
    assert response.status_code == 200
    data = response.json()
    metrics = data["metrics"]
    assert metrics["users"] == {"total": 2, "today": 1}
    assert metrics["images"] == {"total": 4, "today": 4}
    assert metrics["likes"] == {"total": 1, "today": 1}
    assert metrics["collects"] == {"total": 1, "today": 1}
    assert metrics["shares"] == {"total": 1, "today": 1}
    assert metrics["tryon_users"] == {"total": 1, "today": 1}
    assert metrics["bookings"] == {"total": 2, "today": 2}
    assert metrics["completed_bookings"] == {"total": 1, "today": 1}
    assert metrics["revenue"] == {"total": 100, "today": 100}
    assert isinstance(data["popular_nails"], list)


def test_ops_popular_nails_missing_digest_returns_empty(app_env):
    assert OpsAdminService().popular_nails(datetime(2099, 1, 1).date()) == []


def test_ops_ai_chat_uses_local_summary_without_openai_key(client):
    response = client.post(
        "/api/v1/ops/ai/chat",
        headers=_ops_headers(client),
        json={"messages": [{"role": "user", "content": "今天运营数据怎么样？"}]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["model"] == "local-ops-summary"
    assert "当前日期" in data["reply"]


def test_ops_user_merchant_lists_and_coupon_grants(client, db_session):
    user = _consumer(90000003, "coupon_consumer")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    shop = db_session.query(MerchantShop).first()
    assert shop is not None

    headers = _ops_headers(client)

    users = client.get("/api/v1/ops/users?query=coupon", headers=headers)
    assert users.status_code == 200
    assert users.json()["total"] == 1
    assert users.json()["items"][0]["id"] == user.id
    assert users.json()["items"][0]["last_login_ip_location"] == "上海"
    assert "location_city" not in users.json()["items"][0]

    merchants = client.get("/api/v1/ops/merchants", headers=headers)
    assert merchants.status_code == 200
    assert merchants.json()["total"] >= 1

    cities = client.get("/api/v1/ops/merchants/cities", headers=headers)
    assert cities.status_code == 200
    assert shop.city in cities.json()

    filtered_merchants = client.get(f"/api/v1/ops/merchants?city={shop.city}", headers=headers)
    assert filtered_merchants.status_code == 200
    assert filtered_merchants.json()["total"] >= 1
    assert {item["city"] for item in filtered_merchants.json()["items"]} == {shop.city}

    merchant_users = client.get("/api/v1/ops/merchant-users", headers=headers)
    assert merchant_users.status_code == 200
    assert merchant_users.json()["total"] >= 1
    assert shop.merchant_user_id in {item["id"] for item in merchant_users.json()["items"]}
    assert "location_city" not in merchant_users.json()["items"][0]

    user_coupon = client.post(
        "/api/v1/ops/coupons/grants",
        headers=headers,
        json={"target_type": "user", "target_id": user.id, "coupon_name": "新客券", "amount": 30, "note": "测试"},
    )
    assert user_coupon.status_code == 200
    assert user_coupon.json()["target_name"] == "coupon_consumer"

    merchant_coupon = client.post(
        "/api/v1/ops/coupons/grants",
        headers=headers,
        json={"target_type": "merchant_shop", "target_id": shop.id, "coupon_name": "商家券", "amount": 50},
    )
    assert merchant_coupon.status_code == 422

    invalid = client.post(
        "/api/v1/ops/coupons/grants",
        headers=headers,
        json={"target_type": "bad", "target_id": user.id, "coupon_name": "坏数据", "amount": 1},
    )
    assert invalid.status_code == 422

    grants = client.get("/api/v1/ops/coupons/grants", headers=headers)
    assert grants.status_code == 200
    assert grants.json()["total"] == 1
