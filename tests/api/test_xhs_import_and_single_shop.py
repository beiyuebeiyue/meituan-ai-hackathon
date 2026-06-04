from __future__ import annotations

import json

from app.models.nail_style import NailStyle
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


def test_nail_lists_can_exclude_xhs_posts(client, db_session):
    xhs_style = NailStyle(
        title="小红书导入款",
        description="xhs",
        image_url="/files/uploads/xhs.webp",
        local_image_path="data/uploads/xhs.webp",
        source_type="xhs_note",
        nail_type="press_on",
        tags_json=["绿色"],
        dominant_colors_json=[],
        style_metadata_json={"xhs_note_id": "xhs-note-1"},
        popularity_score=100,
        is_trending=True,
    )
    native_style = NailStyle(
        title="原生款",
        description="native",
        image_url="/files/uploads/native.webp",
        local_image_path="data/uploads/native.webp",
        source_type="user_upload",
        nail_type="press_on",
        tags_json=["绿色"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=1,
        is_trending=False,
    )
    db_session.add_all([xhs_style, native_style])
    db_session.commit()

    included = client.get("/api/v1/nails/search?query=绿色&include_xhs_posts=true").json()
    excluded = client.get("/api/v1/nails/search?query=绿色&include_xhs_posts=false").json()

    assert {item["source_type"] for item in included["items"]} == {"xhs_note", "user_upload"}
    assert [item["source_type"] for item in excluded["items"]] == ["user_upload"]


def test_discover_materializes_xhs_assets_when_database_is_empty(client, app_env):
    assets_root = app_env.xhs_crawler_assets_path
    run_dir = assets_root / "20260603"
    image_dir = run_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    image_path = image_dir / "nail.webp"
    image_path.write_bytes(b"fake-image")
    note_id = "xhs-note-auto-1"

    (assets_root / "xhs_note_registry.json").write_text(json.dumps({"note_ids": [note_id]}), encoding="utf-8")
    (run_dir / "xhs_note_digest.json").write_text(
        json.dumps(
            {
                "notes": [
                    {
                        "note_id": note_id,
                        "title": "自动导入猫眼美甲",
                        "standard_nail_image": "20260603/images/nail.webp",
                        "tag_list": ["猫眼", "显白"],
                        "liked_count": 120,
                        "collected_count": 30,
                        "share_count": 6,
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    response = client.get("/api/v1/nails/discover?include_xhs_posts=true")
    payload = response.json()

    assert response.status_code == 200
    assert payload["total"] == 1
    assert payload["items"][0]["title"] == "自动导入猫眼美甲"
    assert payload["items"][0]["source_type"] == "xhs_note"
    assert payload["items"][0]["image_url"] == "/openclaw-assets/20260603/images/nail.webp"


def test_merchant_shop_create_updates_single_shop(client, db_session):
    headers, merchant = _register_and_login(client, phone="13910009101", username="merchant-single")
    user = db_session.get(User, merchant["id"])
    assert user is not None
    user.role = "merchant"
    db_session.add(user)
    db_session.commit()

    first = client.post(
        "/api/v1/merchant/shops",
        headers=headers,
        json={"name": "第一家店", "city": "深圳", "address": "南山", "is_default": True},
    )
    second = client.post(
        "/api/v1/merchant/shops",
        headers=headers,
        json={"name": "更新后的店", "city": "广州", "address": "天河", "is_default": True},
    )
    list_response = client.get("/api/v1/merchant/shops/me", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert list_response.json()["items"] == [second.json()]
