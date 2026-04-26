from __future__ import annotations

from app.models.user import User
from app.services.auth_service import AuthService


def test_default_admin_can_login_with_phone(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["uid"] == 0
    assert payload["user"]["username"] == "keke"
    assert payload["user"]["avatar_url"] == "/files/uploads/avatars/0/p0.png"
    assert payload["user"]["phone"] == "13886722666"
    assert payload["user"]["role"] == "merchant"

    shop_response = client.get(
        "/api/v1/merchant/shops/me",
        headers={"Authorization": f"Bearer {payload['access_token']}"},
    )
    assert shop_response.status_code == 200
    assert shop_response.json()["items"][0]["name"] == "keke"


def test_default_demo_credentials_can_login_as_consumer_or_merchant(client):
    consumer_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722665", "password": "admin@123456", "requested_role": "consumer"},
    )
    merchant_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456", "requested_role": "merchant"},
    )

    assert consumer_response.status_code == 200
    assert merchant_response.status_code == 200
    consumer = consumer_response.json()["user"]
    merchant = merchant_response.json()["user"]
    assert consumer["role"] == "consumer"
    assert consumer["uid"] == 1
    assert consumer["phone"] == "13886722665"
    assert merchant["role"] == "merchant"
    assert merchant["uid"] == 0


def test_consumer_entry_does_not_remap_merchant_phone(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456", "requested_role": "consumer"},
    )

    assert response.status_code == 403
    assert "当前账号身份与登录入口不匹配" in response.text


def test_requested_merchant_role_rejects_consumer_account(client):
    client.post(
        "/api/v1/auth/register",
        json={"phone": "13900000013", "password": "pass123456", "username": "user13"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13900000013", "password": "pass123456", "requested_role": "merchant"},
    )

    assert response.status_code == 403
    assert "当前账号身份与登录入口不匹配" in response.text


def test_registered_users_receive_incrementing_uid(client):
    first_response = client.post(
        "/api/v1/auth/register",
        json={"phone": "13900000011", "password": "pass123456", "username": "user11"},
    )
    second_response = client.post(
        "/api/v1/auth/register",
        json={"phone": "13900000012", "password": "pass123456", "username": "user12"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.json()["user"]["uid"] == 1
    assert second_response.json()["user"]["uid"] == 2
    assert first_response.json()["user"]["role"] == "consumer"
    assert second_response.json()["user"]["role"] == "consumer"


def test_uid2_user_is_renamed_when_display_defaults_are_reapplied(client, db_session):
    client.post(
        "/api/v1/auth/register",
        json={"phone": "13900000021", "password": "pass123456", "username": "user21"},
    )
    second_response = client.post(
        "/api/v1/auth/register",
        json={"phone": "13900000022", "password": "pass123456", "username": "user22"},
    )
    assert second_response.json()["user"]["uid"] == 2

    AuthService().ensure_user_uids(db_session)
    user = db_session.query(User).filter(User.uid == 2).one()
    assert user.username == "momo酱"
