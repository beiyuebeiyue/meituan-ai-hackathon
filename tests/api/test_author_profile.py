from __future__ import annotations

from time import sleep

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.models.style_comment import StyleComment
from app.models.user import User
from app.models.user_style_like import UserStyleLike


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


def test_author_profile_edit_and_hide_posts(client, image_factory):
    headers, user = _register_and_login(client, phone="13910000001", username="author01")

    with image_factory("author-post.png").open("rb") as image_file:
        create_response = client.post(
            "/api/v1/posts",
            headers=headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "原始标题", "description": "原始描述", "tags": "裸粉,通勤"},
        )
    assert create_response.status_code == 200
    created_post = create_response.json()
    assert created_post["created_at"] == created_post["updated_at"]
    assert created_post["is_hidden"] is False

    author_public = client.get(f"/api/v1/users/{user['id']}/author-profile")
    assert author_public.status_code == 200
    public_payload = author_public.json()
    assert public_payload["published_count"] == 1
    assert public_payload["is_mine"] is False
    assert public_payload["posts"][0]["title"] == "原始标题"

    sleep(1.1)
    update_response = client.patch(
        f"/api/v1/posts/{created_post['id']}",
        headers=headers,
        json={"title": "编辑后的标题", "description": "更新后的描述", "tags": ["猫眼", "显白"]},
    )
    assert update_response.status_code == 200
    updated_post = update_response.json()
    assert updated_post["title"] == "编辑后的标题"
    assert updated_post["updated_at"] != updated_post["created_at"]

    hide_response = client.patch(
        f"/api/v1/posts/{created_post['id']}",
        headers=headers,
        json={"is_hidden": True},
    )
    assert hide_response.status_code == 200
    assert hide_response.json()["is_hidden"] is True

    author_private = client.get(f"/api/v1/users/{user['id']}/author-profile", headers=headers)
    assert author_private.status_code == 200
    private_payload = author_private.json()
    assert private_payload["is_mine"] is True
    assert private_payload["posts"][0]["is_hidden"] is True
    assert private_payload["posts"][0]["title"] == "编辑后的标题"

    hidden_public = client.get(f"/api/v1/users/{user['id']}/author-profile")
    assert hidden_public.status_code == 200
    assert hidden_public.json()["posts"] == []

    discover_response = client.get("/api/v1/nails/discover?page=1&page_size=20")
    assert discover_response.status_code == 200
    assert all(item["title"] != "编辑后的标题" for item in discover_response.json()["items"])


def test_admin_author_profile_includes_seed_styles(client, db_session, image_factory):
    login_response = client.post(
        "/api/v1/auth/login",
        json={"phone": get_settings().default_admin_phone, "password": get_settings().default_admin_password},
    )
    assert login_response.status_code == 200
    admin = login_response.json()["user"]
    admin_user = db_session.get(User, admin["id"])
    assert admin_user is not None

    style = NailStyle(
        title="seed-admin-style",
        description="seed-admin-description",
        image_url="/files/seed/styles/enhanced/admin-seed.png",
        local_image_path=str(image_factory("admin-seed.png")),
        source_type="seed_xlsx",
        tags_json=["裸粉"],
        dominant_colors_json=["#f8ddec"],
        style_metadata_json={"author_user_id": admin_user.id},
        popularity_score=9.0,
        is_trending=True,
    )
    db_session.add(style)
    db_session.commit()

    profile_response = client.get(f"/api/v1/users/{admin['id']}/author-profile")
    assert profile_response.status_code == 200
    payload = profile_response.json()
    assert payload["uid"] == 0
    assert payload["published_count"] >= 1
    assert len(payload["posts"]) >= 1
    assert payload["posts"][0]["manage_post_id"] is None


def test_author_profile_view_counts_only_visible_to_author(client, image_factory):
    author_headers, author = _register_and_login(client, phone="13910000021", username="author21")
    viewer_headers, _viewer = _register_and_login(client, phone="13910000022", username="viewer22")

    with image_factory("view-count-post.png").open("rb") as image_file:
        create_response = client.post(
            "/api/v1/posts",
            headers=author_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "浏览统计测试", "description": "浏览统计描述", "tags": "猫眼,显白"},
        )
    assert create_response.status_code == 200

    public_profile_response = client.get(f"/api/v1/users/{author['id']}/author-profile")
    assert public_profile_response.status_code == 200
    style_id = public_profile_response.json()["posts"][0]["id"]

    first_view = client.post(f"/api/v1/nails/{style_id}/views", headers=viewer_headers)
    second_view = client.post(f"/api/v1/nails/{style_id}/views", headers=viewer_headers)
    own_view = client.post(f"/api/v1/nails/{style_id}/views", headers=author_headers)
    assert first_view.status_code == 200
    assert second_view.status_code == 200
    assert own_view.status_code == 200

    author_profile_response = client.get(f"/api/v1/users/{author['id']}/author-profile", headers=author_headers)
    assert author_profile_response.status_code == 200
    author_post = author_profile_response.json()["posts"][0]
    assert author_profile_response.json()["is_mine"] is True
    assert author_post["view_count"] == 2
    assert author_post["unique_viewer_count"] == 1

    viewer_profile_response = client.get(f"/api/v1/users/{author['id']}/author-profile", headers=viewer_headers)
    assert viewer_profile_response.status_code == 200
    viewer_post = viewer_profile_response.json()["posts"][0]
    assert viewer_profile_response.json()["is_mine"] is False
    assert viewer_post["view_count"] == 0
    assert viewer_post["unique_viewer_count"] == 0


def test_profile_bio_cannot_exceed_128_characters(client):
    headers, _user = _register_and_login(client, phone="13910000023", username="bio-limit-user")
    response = client.put(
        "/api/v1/users/me",
        headers=headers,
        data={"bio": "a" * 129},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "个人简介不能超过128个字符"


def test_author_profile_uses_user_location_city(client):
    headers, user = _register_and_login(client, phone="13910000024", username="location-user")

    update_response = client.patch(
        "/api/v1/users/me/location",
        headers=headers,
        json={"city": "上海"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["location_city"] == "上海"

    profile_response = client.get(f"/api/v1/users/{user['id']}/author-profile", headers=headers)
    assert profile_response.status_code == 200
    assert profile_response.json()["city"] == "上海"


def test_follow_lists_respect_privacy_settings(client):
    author_headers, author = _register_and_login(client, phone="13910000025", username="privacy-author")
    viewer_headers, viewer = _register_and_login(client, phone="13910000026", username="privacy-viewer")

    assert client.post(f"/api/v1/users/{viewer['id']}/follow", headers=author_headers).status_code == 200
    assert client.post(f"/api/v1/users/{author['id']}/follow", headers=viewer_headers).status_code == 200

    following_response = client.get(f"/api/v1/users/{author['id']}/following", headers=viewer_headers)
    followers_response = client.get(f"/api/v1/users/{author['id']}/followers", headers=viewer_headers)
    assert following_response.status_code == 200
    assert following_response.json()["items"][0]["id"] == viewer["id"]
    assert followers_response.status_code == 200
    assert followers_response.json()["items"][0]["id"] == viewer["id"]

    privacy_response = client.patch(
        "/api/v1/users/me/privacy",
        headers=author_headers,
        json={"show_following_public": False, "show_followers_public": False},
    )
    assert privacy_response.status_code == 200
    assert privacy_response.json()["show_following_public"] is False
    assert privacy_response.json()["show_followers_public"] is False

    private_profile = client.get(f"/api/v1/users/{author['id']}/author-profile", headers=viewer_headers)
    assert private_profile.status_code == 200
    assert private_profile.json()["can_view_following"] is False
    assert private_profile.json()["can_view_followers"] is False
    assert client.get(f"/api/v1/users/{author['id']}/following", headers=viewer_headers).status_code == 403
    assert client.get(f"/api/v1/users/{author['id']}/followers", headers=viewer_headers).status_code == 403
    assert client.get(f"/api/v1/users/{author['id']}/following", headers=author_headers).status_code == 200
    assert client.get(f"/api/v1/users/{author['id']}/followers", headers=author_headers).status_code == 200


def test_comment_like_privacy_and_block_list(client, db_session, image_factory):
    author_headers, author = _register_and_login(client, phone="13910000027", username="private-actions-author")
    viewer_headers, viewer = _register_and_login(client, phone="13910000028", username="private-actions-viewer")
    viewer_user = db_session.get(User, viewer["id"])
    assert viewer_user is not None

    style = NailStyle(
        title="privacy-style",
        description="privacy-description",
        image_url="/files/seed/styles/enhanced/privacy-style.png",
        local_image_path=str(image_factory("privacy-style.png")),
        source_type="seed_xlsx",
        tags_json=["裸粉"],
        dominant_colors_json=["#f8ddec"],
        style_metadata_json={"author_user_id": viewer_user.id},
        popularity_score=9.0,
        is_trending=True,
    )
    db_session.add(style)
    db_session.commit()
    db_session.add(StyleComment(user_id=author["id"], nail_style_id=style.id, content="公开评论"))
    db_session.add(UserStyleLike(user_id=author["id"], nail_style_id=style.id))
    db_session.commit()

    comments_response = client.get(f"/api/v1/users/{author['id']}/style-comments", headers=viewer_headers)
    likes_response = client.get(f"/api/v1/users/{author['id']}/liked-styles", headers=viewer_headers)
    assert comments_response.status_code == 200
    assert comments_response.json()["items"][0]["comment_content"] == "公开评论"
    assert likes_response.status_code == 200
    assert likes_response.json()["items"][0]["id"] == style.id

    privacy_response = client.patch(
        "/api/v1/users/me/privacy",
        headers=author_headers,
        json={"show_comments_public": False, "show_likes_public": False},
    )
    assert privacy_response.status_code == 200
    assert privacy_response.json()["show_comments_public"] is False
    assert privacy_response.json()["show_likes_public"] is False
    assert client.get(f"/api/v1/users/{author['id']}/style-comments", headers=viewer_headers).status_code == 403
    assert client.get(f"/api/v1/users/{author['id']}/liked-styles", headers=viewer_headers).status_code == 403
    assert client.get(f"/api/v1/users/{author['id']}/style-comments", headers=author_headers).status_code == 200
    assert client.get(f"/api/v1/users/{author['id']}/liked-styles", headers=author_headers).status_code == 200

    assert client.post(f"/api/v1/users/{viewer['id']}/block", headers=author_headers).status_code == 200
    blocked_response = client.get("/api/v1/users/me/blocks", headers=author_headers)
    assert blocked_response.status_code == 200
    assert blocked_response.json()["items"][0]["id"] == viewer["id"]
