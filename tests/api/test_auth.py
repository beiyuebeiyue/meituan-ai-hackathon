from __future__ import annotations


def test_default_admin_can_login_with_phone(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["username"] == "admin"
    assert payload["user"]["phone"] == "13886722666"
