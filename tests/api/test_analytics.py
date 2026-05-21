from __future__ import annotations

from datetime import datetime, timezone

from app.core.security import get_password_hash
from app.models.booking import Booking
from app.models.analytics_event import AnalyticsIdentityLink
from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.models.user import User
from app.services.analytics_service import AnalyticsService


def _ops_headers(client) -> dict[str, str]:
    response = client.post("/api/v1/ops/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create_consumer(client, phone: str = "13900009991") -> tuple[str, dict]:
    response = client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "password": "secret123", "username": f"u{phone[-4:]}"},
    )
    assert response.status_code == 200
    return response.json()["access_token"], response.json()["user"]


def _style(db_session, image_factory, shop_id: str | None = None) -> NailStyle:
    style = NailStyle(
        title="绿色通勤款",
        description="desc",
        image_url="http://example.com/style.png",
        local_image_path=str(image_factory("analytics-style.png")),
        source_type="test",
        tags_json=["绿色", "通勤"],
        dominant_colors_json=["绿色"],
        style_metadata_json={},
        popularity_score=10,
        is_trending=True,
        shop_id=shop_id,
    )
    db_session.add(style)
    db_session.commit()
    db_session.refresh(style)
    return style


def test_analytics_events_support_anonymous_login_and_idempotency(client, db_session, image_factory):
    style = _style(db_session, image_factory)

    payload = {
        "items": [
            {
                "event_id": "evt-anon-1",
                "event_name": "ai_recommendation_shown",
                "anonymous_id": "anon-1",
                "session_id": "sess-1",
                "style_id": style.id,
                "source": "ask_ai",
                "screen": "ask_ai",
                "properties": {"note_id": "note-1", "phone": "should-not-be-sent"},
            }
        ]
    }
    response = client.post("/api/v1/events/analytics", json=payload)
    assert response.status_code == 200
    assert response.json() == {"inserted": 1, "skipped": 0}

    duplicate = client.post("/api/v1/events/analytics", json=payload)
    assert duplicate.status_code == 200
    assert duplicate.json() == {"inserted": 0, "skipped": 1}

    token, user = _create_consumer(client)
    authed = client.post(
        "/api/v1/events/analytics",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [
                {
                    "event_id": "evt-authed-1",
                    "event_name": "ai_recommendation_click",
                    "anonymous_id": "anon-1",
                    "session_id": "sess-1",
                    "style_id": style.id,
                    "source": "ask_ai",
                    "screen": "ask_ai",
                }
            ]
        },
    )
    assert authed.status_code == 200

    overview = client.get("/api/v1/ops/analytics/overview", headers=_ops_headers(client))
    assert overview.status_code == 200
    data = overview.json()
    assert data["kpis"]["recommendation_impressions"] == 1
    assert data["kpis"]["recommendation_ctr"] == 1.0
    assert data["kpis"]["dau"] == 1
    assert user["id"] in {row.user_id for row in db_session.query(AnalyticsIdentityLink).all()}


def test_ops_analytics_overview_counts_server_revenue_and_rankings(client, db_session, image_factory):
    shop = db_session.query(MerchantShop).first()
    assert shop is not None
    user = User(
        uid=91000001,
        phone="13991000001",
        password_hash=get_password_hash("password"),
        username="analytics_user",
        role="consumer",
    )
    db_session.add(user)
    db_session.commit()
    style = _style(db_session, image_factory, shop_id=shop.id)
    booking = Booking(
        user_id=user.id,
        merchant_user_id=shop.merchant_user_id,
        shop_id=shop.id,
        style_id=style.id,
        appointment_time="今天 18:00",
        contact_phone="13900000000",
        amount_cents=18800,
        status="completed",
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    service = AnalyticsService()
    service.record_server_event(db_session, "tryon_started", user_id=user.id, style_id=style.id, source="test", occurred_at=datetime.now(timezone.utc))
    service.record_server_event(db_session, "tryon_completed", user_id=user.id, style_id=style.id, source="test", occurred_at=datetime.now(timezone.utc))
    service.record_server_event(
        db_session,
        "booking_completed",
        user_id=user.id,
        style_id=style.id,
        booking_id=booking.id,
        shop_id=shop.id,
        amount_cents=booking.amount_cents,
        source="test",
        occurred_at=datetime.now(timezone.utc),
    )
    service.record_server_event(
        db_session,
        "revenue_recorded",
        user_id=user.id,
        style_id=style.id,
        booking_id=booking.id,
        shop_id=shop.id,
        amount_cents=booking.amount_cents,
        source="test",
        occurred_at=datetime.now(timezone.utc),
    )

    response = client.get("/api/v1/ops/analytics/overview", headers=_ops_headers(client))
    assert response.status_code == 200
    data = response.json()
    assert data["kpis"]["tryon_started"] == 1
    assert data["kpis"]["tryon_completion_rate"] == 1.0
    assert data["kpis"]["completed_orders"] == 1
    assert data["kpis"]["revenue_cents"] == 18800
    assert data["kpis"]["average_order_value_cents"] == 18800
    assert data["top_styles"][0]["id"] == style.id
    assert data["top_shops"][0]["id"] == shop.id
