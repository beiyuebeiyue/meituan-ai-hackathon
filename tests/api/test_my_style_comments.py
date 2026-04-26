from __future__ import annotations

from app.models.nail_style import NailStyle


def test_my_style_comments_only_returns_current_user_comments(client, db_session, image_factory):
    style = NailStyle(
        title="评论归属测试",
        description="只展示自己的评论",
        image_url="http://example.com/comment-owner.png",
        local_image_path=str(image_factory("comment-owner.png")),
        source_type="seed_xlsx",
        tags_json=["法式"],
        dominant_colors_json=["#f5d0d8"],
        style_metadata_json={},
        popularity_score=10,
        is_trending=False,
    )
    db_session.add(style)
    db_session.commit()

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    user_register = client.post(
        "/api/v1/auth/register",
        json={"phone": "13920000001", "password": "pass123456", "username": "comment-user"},
    )
    user_headers = {"Authorization": f"Bearer {user_register.json()['access_token']}"}

    admin_comment = client.post(
        f"/api/v1/nails/{style.id}/comments",
        json={"content": "这是 admin 的评论"},
        headers=admin_headers,
    )
    user_comment = client.post(
        f"/api/v1/nails/{style.id}/comments",
        json={"content": "这是普通用户的评论"},
        headers=user_headers,
    )
    assert admin_comment.status_code == 200
    assert user_comment.status_code == 200

    admin_comments = client.get("/api/v1/users/me/style-comments", headers=admin_headers)
    assert admin_comments.status_code == 200
    admin_items = admin_comments.json()["items"]
    assert len(admin_items) == 1
    assert admin_items[0]["comment_content"] == "这是 admin 的评论"
    assert admin_items[0]["style_id"] == style.id
    assert admin_items[0]["style_title"] == "评论归属测试"

    user_comments = client.get("/api/v1/users/me/style-comments", headers=user_headers)
    assert user_comments.status_code == 200
    user_items = user_comments.json()["items"]
    assert len(user_items) == 1
    assert user_items[0]["comment_content"] == "这是普通用户的评论"
