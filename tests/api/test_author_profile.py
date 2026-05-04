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


def _promote_to_merchant(db_session, user_payload: dict[str, object]) -> None:
    user = db_session.get(User, user_payload["id"])
    assert user is not None
    user.role = "merchant"
    db_session.add(user)
    db_session.commit()


def test_consumer_can_create_personal_post(client, image_factory):
    headers, user = _register_and_login(client, phone="13910000031", username="consumer31")

    with image_factory("consumer-post.png").open("rb") as image_file:
        create_response = client.post(
            "/api/v1/posts",
            headers=headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "普通用户发布", "description": "个人美甲分享", "tags": "裸粉"},
        )

    assert create_response.status_code == 200
    created_post = create_response.json()
    assert created_post["title"] == "普通用户发布"

    profile_response = client.get(f"/api/v1/users/{user['id']}/author-profile", headers=headers)
    assert profile_response.status_code == 200
    profile_payload = profile_response.json()
    assert profile_payload["published_count"] == 1
    assert profile_payload["posts"][0]["title"] == "普通用户发布"


def test_consumer_can_bind_completed_booking_as_verified_consumption(client, db_session, image_factory):
    merchant_headers, merchant = _register_and_login(client, phone="13910000041", username="merchant41")
    _promote_to_merchant(db_session, merchant)
    consumer_headers, _consumer = _register_and_login(client, phone="13910000042", username="consumer42")

    with image_factory("merchant-style.png").open("rb") as image_file:
        create_merchant_post = client.post(
            "/api/v1/posts",
            headers=merchant_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "商家款式", "description": "门店款式", "tags": "显白"},
        )
    assert create_merchant_post.status_code == 200

    merchant_profile = client.get(f"/api/v1/users/{merchant['id']}/author-profile", headers=merchant_headers).json()
    style_id = merchant_profile["posts"][0]["id"]
    style_detail = client.get(f"/api/v1/nails/{style_id}", headers=consumer_headers).json()

    booking_response = client.post(
        "/api/v1/bookings",
        headers=consumer_headers,
        json={
            "style_id": style_id,
            "shop_id": style_detail["shop_id"],
            "appointment_time": "2026-05-04 10:00",
            "contact_phone": "13886722665",
        },
    )
    assert booking_response.status_code == 200
    booking_id = booking_response.json()["id"]

    complete_response = client.patch(
        f"/api/v1/bookings/merchant/{booking_id}",
        headers=merchant_headers,
        json={"status": "completed"},
    )
    assert complete_response.status_code == 200

    with image_factory("verified-consumer-post.png").open("rb") as image_file:
        create_verified_post = client.post(
            "/api/v1/posts",
            headers=consumer_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={
                "title": "真实消费分享",
                "description": "刚做完的款式",
                "tags": "真实消费",
                "verified_booking_id": booking_id,
            },
        )
    assert create_verified_post.status_code == 200
    created_post = create_verified_post.json()
    assert created_post["verified_consumption"] is True
    assert created_post["verified_shop_name"] == style_detail["shop_name"]

    consumer_profile = client.get(f"/api/v1/users/{_consumer['id']}/author-profile", headers=consumer_headers).json()
    verified_style_id = consumer_profile["posts"][0]["id"]
    verified_detail = client.get(f"/api/v1/nails/{verified_style_id}", headers=consumer_headers).json()
    assert verified_detail["verified_consumption"] is True
    assert verified_detail["verified_shop_id"] == style_detail["shop_id"]
    assert verified_detail["verified_shop_name"] == style_detail["shop_name"]


def test_consumer_can_create_shop_level_booking_without_style(client, db_session, image_factory):
    merchant_headers, merchant = _register_and_login(client, phone="13910000046", username="merchant46")
    _promote_to_merchant(db_session, merchant)
    consumer_headers, _consumer = _register_and_login(client, phone="13910000047", username="consumer47")

    with image_factory("merchant-style-shop-only.png").open("rb") as image_file:
        create_merchant_post = client.post(
            "/api/v1/posts",
            headers=merchant_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "门店预约来源", "description": "用于创建默认门店", "tags": "预约"},
        )
    assert create_merchant_post.status_code == 200

    merchant_profile = client.get(f"/api/v1/users/{merchant['id']}/author-profile", headers=merchant_headers).json()
    shop_id = merchant_profile["shop_id"]
    assert shop_id

    booking_response = client.post(
        "/api/v1/bookings",
        headers=consumer_headers,
        json={
            "shop_id": shop_id,
            "appointment_time": "2026-05-04 12:00",
            "contact_phone": "13886722665",
            "note": "到店选款",
        },
    )
    assert booking_response.status_code == 200
    payload = booking_response.json()
    assert payload["style_id"] is None
    assert payload["style_title"] == "门店预约"
    assert payload["shop_id"] == shop_id
    assert payload["merchant_user_id"] == merchant["id"]


def test_consumer_cannot_bind_unfinished_or_foreign_booking(client, db_session, image_factory):
    merchant_headers, merchant = _register_and_login(client, phone="13910000043", username="merchant43")
    _promote_to_merchant(db_session, merchant)
    consumer_headers, _consumer = _register_and_login(client, phone="13910000044", username="consumer44")
    other_headers, _other = _register_and_login(client, phone="13910000045", username="consumer45")

    with image_factory("merchant-style-2.png").open("rb") as image_file:
        client.post(
            "/api/v1/posts",
            headers=merchant_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "商家款式2", "description": "门店款式", "tags": "显白"},
        )
    merchant_profile = client.get(f"/api/v1/users/{merchant['id']}/author-profile", headers=merchant_headers).json()
    style_id = merchant_profile["posts"][0]["id"]
    style_detail = client.get(f"/api/v1/nails/{style_id}", headers=consumer_headers).json()
    booking = client.post(
        "/api/v1/bookings",
        headers=consumer_headers,
        json={
            "style_id": style_id,
            "shop_id": style_detail["shop_id"],
            "appointment_time": "2026-05-04 11:00",
            "contact_phone": "13886722665",
        },
    ).json()

    with image_factory("unfinished-booking-post.png").open("rb") as image_file:
        unfinished_response = client.post(
            "/api/v1/posts",
            headers=consumer_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "未完成订单", "verified_booking_id": booking["id"]},
        )
    assert unfinished_response.status_code == 400

    client.patch(f"/api/v1/bookings/merchant/{booking['id']}", headers=merchant_headers, json={"status": "completed"})
    with image_factory("foreign-booking-post.png").open("rb") as image_file:
        foreign_response = client.post(
            "/api/v1/posts",
            headers=other_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "别人的订单", "verified_booking_id": booking["id"]},
        )
    assert foreign_response.status_code == 404

    with image_factory("forged-shop-post.png").open("rb") as image_file:
        forged_response = client.post(
            "/api/v1/posts",
            headers=consumer_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "伪造门店", "shop_id": style_detail["shop_id"]},
        )
    assert forged_response.status_code == 400


def test_author_profile_edit_and_hide_posts(client, db_session, image_factory):
    headers, user = _register_and_login(client, phone="13910000001", username="author01")
    _promote_to_merchant(db_session, user)

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
    style_id = public_payload["posts"][0]["id"]

    owner_detail = client.get(f"/api/v1/nails/{style_id}", headers=headers)
    assert owner_detail.status_code == 200
    assert owner_detail.json()["manage_post_id"] == created_post["id"]
    assert owner_detail.json()["is_hidden"] is False

    public_detail = client.get(f"/api/v1/nails/{style_id}")
    assert public_detail.status_code == 200
    assert public_detail.json()["manage_post_id"] is None

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

    hidden_owner_detail = client.get(f"/api/v1/nails/{style_id}", headers=headers)
    assert hidden_owner_detail.status_code == 200
    assert hidden_owner_detail.json()["is_hidden"] is True

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


def test_author_profile_view_counts_visible_to_author(client, db_session, image_factory):
    author_headers, author = _register_and_login(client, phone="13910000021", username="author21")
    viewer_headers, _viewer = _register_and_login(client, phone="13910000022", username="viewer22")
    _promote_to_merchant(db_session, author)

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
    assert author_post["view_count"] == 3
    assert author_post["unique_viewer_count"] == 2

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


def test_profile_bio_can_be_cleared(client):
    headers, user = _register_and_login(client, phone="13910000027", username="bio-clear-user")
    set_response = client.put(
        "/api/v1/users/me",
        headers=headers,
        data={"bio": "先写一段简介"},
    )
    assert set_response.status_code == 200
    assert set_response.json()["bio"] == "先写一段简介"

    clear_response = client.put(
        "/api/v1/users/me",
        headers=headers,
        data={"clear_bio": "true"},
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["bio"] == ""

    profile_response = client.get(f"/api/v1/users/{user['id']}/author-profile", headers=headers)
    assert profile_response.status_code == 200
    assert profile_response.json()["bio"] == ""


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


def test_follow_lists_are_public_for_social_profiles(client, db_session):
    author_headers, author = _register_and_login(client, phone="13910000025", username="privacy-author")
    viewer_headers, viewer = _register_and_login(client, phone="13910000026", username="privacy-viewer")
    _promote_to_merchant(db_session, author)

    assert client.post(f"/api/v1/users/{author['id']}/follow", headers=viewer_headers).status_code == 200

    following_response = client.get(f"/api/v1/users/{author['id']}/following", headers=viewer_headers)
    followers_response = client.get(f"/api/v1/users/{author['id']}/followers", headers=viewer_headers)
    assert following_response.status_code == 200
    assert following_response.json()["items"] == []
    assert followers_response.status_code == 200
    assert followers_response.json()["items"][0]["id"] == viewer["id"]

    privacy_response = client.patch(
        "/api/v1/users/me/privacy",
        headers=author_headers,
        json={"show_following_public": True, "show_followers_public": True},
    )
    assert privacy_response.status_code == 200
    assert privacy_response.json()["show_following_public"] is False
    assert privacy_response.json()["show_followers_public"] is False

    private_profile = client.get(f"/api/v1/users/{author['id']}/author-profile", headers=viewer_headers)
    assert private_profile.status_code == 200
    assert private_profile.json()["can_view_following"] is True
    assert private_profile.json()["can_view_followers"] is True
    owner_following = client.get(f"/api/v1/users/{author['id']}/following", headers=author_headers)
    owner_followers = client.get(f"/api/v1/users/{author['id']}/followers", headers=author_headers)
    assert owner_following.status_code == 200
    assert owner_following.json()["items"] == []
    assert owner_followers.status_code == 200
    assert owner_followers.json()["items"][0]["id"] == viewer["id"]


def test_consumer_can_follow_consumer(client):
    first_headers, first = _register_and_login(client, phone="13910000029", username="consumer-a")
    _second_headers, second = _register_and_login(client, phone="13910000033", username="consumer-b")

    response = client.post(f"/api/v1/users/{second['id']}/follow", headers=first_headers)

    assert response.status_code == 200
    followers_response = client.get(f"/api/v1/users/{second['id']}/followers", headers=first_headers)
    assert followers_response.status_code == 200
    assert followers_response.json()["items"][0]["id"] == first["id"]


def test_merchant_can_follow_another_merchant(client, db_session):
    first_headers, first = _register_and_login(client, phone="13910000030", username="merchant-a")
    _second_headers, second = _register_and_login(client, phone="13910000032", username="merchant-b")
    _promote_to_merchant(db_session, first)
    _promote_to_merchant(db_session, second)

    response = client.post(f"/api/v1/users/{second['id']}/follow", headers=first_headers)

    assert response.status_code == 200
    followers_response = client.get(f"/api/v1/users/{second['id']}/followers", headers=first_headers)
    assert followers_response.status_code == 200
    assert followers_response.json()["items"][0]["id"] == first["id"]


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
    assert comments_response.status_code == 403
    assert likes_response.status_code == 403

    privacy_response = client.patch(
        "/api/v1/users/me/privacy",
        headers=author_headers,
        json={"show_comments_public": True, "show_likes_public": True},
    )
    assert privacy_response.status_code == 200
    assert privacy_response.json()["show_comments_public"] is False
    assert privacy_response.json()["show_likes_public"] is False
    assert client.get(f"/api/v1/users/{author['id']}/style-comments", headers=viewer_headers).status_code == 403
    assert client.get(f"/api/v1/users/{author['id']}/liked-styles", headers=viewer_headers).status_code == 403
    own_comments_response = client.get(f"/api/v1/users/{author['id']}/style-comments", headers=author_headers)
    own_likes_response = client.get(f"/api/v1/users/{author['id']}/liked-styles", headers=author_headers)
    assert own_comments_response.status_code == 200
    assert own_comments_response.json()["items"][0]["comment_content"] == "公开评论"
    assert own_likes_response.status_code == 200
    assert own_likes_response.json()["items"][0]["id"] == style.id

    assert client.post(f"/api/v1/users/{viewer['id']}/block", headers=author_headers).status_code == 200
    blocked_response = client.get("/api/v1/users/me/blocks", headers=author_headers)
    assert blocked_response.status_code == 200
    assert blocked_response.json()["items"][0]["id"] == viewer["id"]
