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
        amount_cents=18_800,
        status="completed",
    )
    pending = Booking(
        user_id=user.id,
        merchant_user_id=shop.merchant_user_id,
        shop_id=shop.id,
        style_id=style.id,
        appointment_time="明天 18:00",
        contact_phone="13900000000",
        amount_cents=8_800,
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
    assert metrics["revenue"] == {"total": 188, "today": 188}
    assert isinstance(data["popular_nails"], list)


def test_ops_popular_nails_missing_digest_returns_empty(app_env):
    assert OpsAdminService().popular_nails(datetime(2099, 1, 1).date()) == []


def test_ops_xhs_nail_report_reads_markdown_file(client, app_env):
    report_dir = app_env.xhs_daily_report_assets_path / "20260510"
    report_dir.mkdir(parents=True)
    report_path = report_dir / "xhs_daily_nail_report.md"
    report_path.write_text("# 焕甲小红书美甲日报\n\n测试报告", encoding="utf-8")

    headers = _ops_headers(client)
    history = client.get("/api/v1/ops/reports/xhs-nail/history", headers=headers)
    assert history.status_code == 200
    assert history.json()[0]["date_key"] == "20260510"
    assert "测试报告" in history.json()[0]["markdown_content"]


def test_ops_ai_chat_returns_gateway_error_when_model_backend_unavailable(client):
    response = client.post(
        "/api/v1/ops/ai/chat",
        headers=_ops_headers(client),
        json={"messages": [{"role": "user", "content": "今天运营数据怎么样？"}]},
    )
    assert response.status_code == 502


def test_ops_ai_chat_prompt_uses_tools_instead_of_full_dashboard():
    from app.services.ops_chat_service import OpsChatService

    service = OpsChatService()
    prompt = service._system_prompt()
    calls = service._parse_tool_calls(
        '<ops_tool_call>{"name":"get_ops_analytics_overview","arguments":{"start_date":"2026-05-21"}}</ops_tool_call>'
    )

    assert "当前 dashboard JSON" not in prompt
    assert "xhs_note_digest" not in prompt
    assert "get_ops_analytics_overview" in prompt
    assert "get_popular_nails" not in prompt
    assert "longcat_tool_call" not in prompt
    assert calls == [{"name": "get_ops_analytics_overview", "arguments": {"start_date": "2026-05-21"}}]
    assert service._parse_tool_calls("<longcat_tool_call>get_ops_analytics_overview</longcat_tool_call>") == []


def test_ops_ai_chat_can_route_to_openclaw(client, app_env, monkeypatch):
    from app.routers import ops_admin
    from app.schemas.ops import OpsChatResponse

    app_env.openclaw_enabled = True

    def fake_openclaw_reply(dashboard, messages):
        return OpsChatResponse(reply=f"openclaw:{messages[-1].content}", model="openclaw/default")

    monkeypatch.setattr(ops_admin.ops_chat_service, "_openclaw_reply", fake_openclaw_reply)

    response = client.post(
        "/api/v1/ops/ai/chat",
        headers=_ops_headers(client),
        json={"messages": [{"role": "user", "content": "今天运营数据怎么样？"}]},
    )

    assert response.status_code == 200
    assert response.json() == {"reply": "openclaw:今天运营数据怎么样？", "model": "openclaw/default"}


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


def test_ops_posts_list_and_search(client, db_session):
    user = _consumer(90000004, "post_consumer")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    shop = db_session.query(MerchantShop).first()
    assert shop is not None

    public_post = UserPost(
        user_id=user.id,
        shop_id=shop.id,
        title="猫眼法式热门款",
        description="适合夏天的蓝色猫眼",
        image_url="/files/posts/cat-eye.png",
        local_image_path="data/posts/cat-eye.png",
        tags_json=["猫眼", "法式", "蓝色"],
    )
    hidden_post = UserPost(
        user_id=user.id,
        title="隐藏测试款",
        description="运营也应该能看到隐藏帖子",
        image_url="/files/posts/hidden.png",
        local_image_path="data/posts/hidden.png",
        tags_json=["隐藏"],
        is_hidden=True,
    )
    db_session.add_all([public_post, hidden_post])
    db_session.commit()

    headers = _ops_headers(client)

    unauthorized = client.get("/api/v1/ops/posts")
    assert unauthorized.status_code == 401

    all_posts = client.get("/api/v1/ops/posts", headers=headers)
    assert all_posts.status_code == 200
    assert all_posts.json()["total"] == 2
    statuses = {item["title"]: item["is_hidden"] for item in all_posts.json()["items"]}
    assert statuses["猫眼法式热门款"] is False
    assert statuses["隐藏测试款"] is True

    by_title = client.get("/api/v1/ops/posts?query=猫眼", headers=headers)
    assert by_title.status_code == 200
    assert by_title.json()["total"] == 1
    assert by_title.json()["items"][0]["shop_name"] == shop.name
    assert by_title.json()["items"][0]["tags"] == ["猫眼", "法式", "蓝色"]

    by_shop = client.get(f"/api/v1/ops/posts?query={shop.name}", headers=headers)
    assert by_shop.status_code == 200
    assert by_shop.json()["total"] == 1
