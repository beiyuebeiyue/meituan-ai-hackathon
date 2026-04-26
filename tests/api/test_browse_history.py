from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from app.models.mixins import utcnow
from app.models.nail_style import NailStyle
from app.models.user_browse_history import UserBrowseHistory


def test_browse_history_only_keeps_recent_30_days_and_prunes_old_records(client, db_session, image_factory):
    style_old = NailStyle(
        title="旧记录法式",
        description="过期浏览记录",
        image_url="http://example.com/old.png",
        local_image_path=str(image_factory("browse-old.png")),
        source_type="seed_xlsx",
        tags_json=["法式"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=10,
        is_trending=False,
    )
    style_new = NailStyle(
        title="最近猫眼",
        description="最近浏览记录",
        image_url="http://example.com/new.png",
        local_image_path=str(image_factory("browse-new.png")),
        source_type="seed_xlsx",
        tags_json=["猫眼"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=15,
        is_trending=True,
    )
    db_session.add_all([style_old, style_new])
    db_session.commit()

    auth_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )
    headers = {"Authorization": f"Bearer {auth_response.json()['access_token']}"}

    assert client.post("/api/v1/users/me/browse-history", data={"style_id": style_old.id}, headers=headers).status_code == 200
    assert client.post("/api/v1/users/me/browse-history", data={"style_id": style_new.id}, headers=headers).status_code == 200

    old_history = db_session.scalar(select(UserBrowseHistory).where(UserBrowseHistory.nail_style_id == style_old.id))
    new_history = db_session.scalar(select(UserBrowseHistory).where(UserBrowseHistory.nail_style_id == style_new.id))
    assert old_history is not None
    assert new_history is not None

    old_history.updated_at = utcnow() - timedelta(days=31)
    db_session.add(old_history)
    db_session.commit()

    history_response = client.get("/api/v1/users/me/browse-history", headers=headers)
    assert history_response.status_code == 200
    items = history_response.json()["items"]
    assert len(items) == 1
    assert items[0]["style"]["id"] == style_new.id

    remaining_ids = {item.nail_style_id for item in db_session.scalars(select(UserBrowseHistory)).all()}
    assert style_old.id not in remaining_ids
    assert style_new.id in remaining_ids


def test_browse_history_supports_batch_delete(client, db_session, image_factory):
    styles = [
        NailStyle(
            title=f"浏览记录 {index}",
            description="批量删除测试",
            image_url=f"http://example.com/{index}.png",
            local_image_path=str(image_factory(f"browse-batch-{index}.png")),
            source_type="seed_xlsx",
            tags_json=["测试"],
            dominant_colors_json=[],
            style_metadata_json={},
            popularity_score=10 + index,
            is_trending=False,
        )
        for index in range(3)
    ]
    db_session.add_all(styles)
    db_session.commit()

    auth_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )
    headers = {"Authorization": f"Bearer {auth_response.json()['access_token']}"}

    for style in styles:
        assert client.post("/api/v1/users/me/browse-history", data={"style_id": style.id}, headers=headers).status_code == 200

    list_response = client.get("/api/v1/users/me/browse-history", headers=headers)
    assert list_response.status_code == 200
    history_ids = [item["id"] for item in list_response.json()["items"][:2]]

    delete_response = client.post(
        "/api/v1/users/me/browse-history/batch-delete",
        json={"history_ids": history_ids},
        headers=headers,
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted_count"] == 2

    remaining = client.get("/api/v1/users/me/browse-history", headers=headers)
    assert remaining.status_code == 200
    remaining_items = remaining.json()["items"]
    assert len(remaining_items) == 1
