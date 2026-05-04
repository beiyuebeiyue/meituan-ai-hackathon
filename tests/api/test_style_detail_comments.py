from __future__ import annotations

from app.models.nail_style import NailStyle


def test_style_detail_supports_like_favorite_and_comments(client, db_session, image_factory):
    style = NailStyle(
        title="暮色猫眼",
        description="显白带细闪",
        image_url="http://example.com/style.png",
        local_image_path=str(image_factory("style-comment.png")),
        source_type="seed_xlsx",
        tags_json=["猫眼", "显白"],
        dominant_colors_json=["#f4c7c1"],
        style_metadata_json={},
        popularity_score=22,
        is_trending=True,
    )
    db_session.add(style)
    db_session.commit()

    auth_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )
    token = auth_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    initial_detail = client.get(f"/api/v1/nails/{style.id}", headers=headers)
    assert initial_detail.status_code == 200
    assert initial_detail.json()["like_count"] == 0
    assert initial_detail.json()["favorite_count"] == 0
    assert initial_detail.json()["comment_count"] == 0

    like_response = client.post(f"/api/v1/nails/{style.id}/likes", headers=headers)
    assert like_response.status_code == 200

    favorite_response = client.post("/api/v1/favorites", json={"style_id": style.id}, headers=headers)
    assert favorite_response.status_code == 200

    comment_response = client.post(
        f"/api/v1/nails/{style.id}/comments",
        json={"content": "这个颜色太适合春天了"},
        headers=headers,
    )
    assert comment_response.status_code == 200
    comment_id = comment_response.json()["id"]

    detail_response = client.get(f"/api/v1/nails/{style.id}", headers=headers)
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["like_count"] == 1
    assert detail_payload["favorite_count"] == 1
    assert detail_payload["comment_count"] == 1
    assert detail_payload["is_liked"] is True
    assert detail_payload["is_favorited"] is True

    liked_response = client.get("/api/v1/nails/likes/me", headers=headers)
    assert liked_response.status_code == 200
    liked_items = liked_response.json()["items"]
    assert len(liked_items) == 1
    assert liked_items[0]["id"] == style.id
    assert liked_items[0]["is_liked"] is True

    comments_response = client.get(f"/api/v1/nails/{style.id}/comments", headers=headers)
    assert comments_response.status_code == 200
    comments = comments_response.json()["items"]
    assert len(comments) == 1
    assert comments[0]["content"] == "这个颜色太适合春天了"
    assert comments[0]["author_name"] == "keke"
    assert comments[0]["is_mine"] is True

    delete_response = client.delete(f"/api/v1/nails/{style.id}/comments/{comment_id}", headers=headers)
    assert delete_response.status_code == 200

    after_delete = client.get(f"/api/v1/nails/{style.id}", headers=headers)
    assert after_delete.status_code == 200
    assert after_delete.json()["like_count"] == 1
    assert after_delete.json()["comment_count"] == 0


def test_style_comments_expose_author_and_merchant_badges_to_regular_users(client, db_session, image_factory):
    merchant_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456", "requested_role": "merchant"},
    )
    assert merchant_response.status_code == 200
    merchant_payload = merchant_response.json()
    merchant_headers = {"Authorization": f"Bearer {merchant_payload['access_token']}"}
    merchant_id = merchant_payload["user"]["id"]

    user_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722665", "password": "admin@123456", "requested_role": "consumer"},
    )
    assert user_response.status_code == 200
    user_headers = {"Authorization": f"Bearer {user_response.json()['access_token']}"}

    style = NailStyle(
        title="红棕法式",
        description="显白耐看",
        image_url="http://example.com/merchant-comment-style.png",
        local_image_path=str(image_factory("merchant-comment-style.png")),
        source_type="user_post",
        tags_json=["法式", "显白"],
        dominant_colors_json=["#a6372e"],
        style_metadata_json={"author_user_id": merchant_id},
        popularity_score=16,
        is_trending=False,
    )
    db_session.add(style)
    db_session.commit()

    merchant_comment = client.post(
        f"/api/v1/nails/{style.id}/comments",
        json={"content": "这款是我们店里的热门款。"},
        headers=merchant_headers,
    )
    assert merchant_comment.status_code == 200
    assert merchant_comment.json()["author_is_shop"] is True
    assert merchant_comment.json()["is_style_author"] is True

    user_comment = client.post(
        f"/api/v1/nails/{style.id}/comments",
        json={"content": "普通用户也能看到作者标识。"},
        headers=user_headers,
    )
    assert user_comment.status_code == 200
    assert user_comment.json()["author_is_shop"] is False
    assert user_comment.json()["is_style_author"] is False

    comments_response = client.get(f"/api/v1/nails/{style.id}/comments", headers=user_headers)
    assert comments_response.status_code == 200
    comments = comments_response.json()["items"]
    merchant_comments = [item for item in comments if item["content"] == "这款是我们店里的热门款。"]
    assert len(merchant_comments) == 1
    assert merchant_comments[0]["author_is_shop"] is True
    assert merchant_comments[0]["is_style_author"] is True


def test_following_feed_supports_followed_author_and_blocks_self_follow(client, db_session, image_factory):
    style = NailStyle(
        title="奶咖法式",
        description="通勤耐看",
        image_url="http://example.com/follow-style.png",
        local_image_path=str(image_factory("follow-style.png")),
        source_type="seed_xlsx",
        tags_json=["法式", "奶咖"],
        dominant_colors_json=["#d8b7a0"],
        style_metadata_json={},
        popularity_score=18,
        is_trending=False,
    )
    db_session.add(style)
    db_session.commit()

    register_response = client.post(
        "/api/v1/auth/register",
        json={"phone": "13900000001", "password": "pass123456", "username": "tester"},
    )
    assert register_response.status_code == 200
    user_token = register_response.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    admin_response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )
    admin_payload = admin_response.json()
    admin_token = admin_payload["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    admin_id = admin_payload["user"]["id"]

    self_follow_response = client.post(f"/api/v1/users/{admin_id}/follow", headers=admin_headers)
    assert self_follow_response.status_code == 400

    follow_response = client.post(f"/api/v1/users/{admin_id}/follow", headers=user_headers)
    assert follow_response.status_code == 200

    following_feed = client.get("/api/v1/nails/following?page=1&page_size=20", headers=user_headers)
    assert following_feed.status_code == 200
    following_items = following_feed.json()["items"]
    assert len(following_items) >= 1
    assert following_items[0]["author_name"] == "keke"

    admin_following_feed = client.get("/api/v1/nails/following?page=1&page_size=20", headers=admin_headers)
    assert admin_following_feed.status_code == 200
    assert admin_following_feed.json()["items"] == []
