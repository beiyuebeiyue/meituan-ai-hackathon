from __future__ import annotations


def test_default_admin_can_login_with_phone(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["uid"] == 0
    assert payload["user"]["username"] == "momo酱"
    assert payload["user"]["phone"] == "13886722666"


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
