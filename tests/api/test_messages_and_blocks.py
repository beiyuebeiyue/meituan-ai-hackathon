from __future__ import annotations

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


def _promote_to_merchant(db_session, user_payload: dict[str, object]) -> None:
    user = db_session.get(User, user_payload["id"])
    assert user is not None
    user.role = "merchant"
    db_session.add(user)
    db_session.commit()


def test_consumer_and_merchant_can_message_without_social_limit(client, db_session):
    consumer_headers, consumer = _register_and_login(client, phone="13920000001", username="consumer_msg")
    merchant_headers, merchant = _register_and_login(client, phone="13920000002", username="merchant_msg")
    _promote_to_merchant(db_session, merchant)

    first = client.post(
        f"/api/v1/messages/conversations/{merchant['id']}",
        headers=consumer_headers,
        json={"content": "你好，我想问问这款美甲。"},
    )
    second = client.post(
        f"/api/v1/messages/conversations/{merchant['id']}",
        headers=consumer_headers,
        json={"content": "我再补充一句。"},
    )
    assert first.status_code == 200
    assert second.status_code == 200

    merchant_inbox_response = client.get("/api/v1/messages/inbox", headers=merchant_headers)
    assert merchant_inbox_response.status_code == 200
    merchant_inbox = merchant_inbox_response.json()
    assert merchant_inbox["stranger_bucket"]["unread_count"] == 2
    assert merchant_inbox["stranger_bucket"]["thread_count"] == 1
    assert merchant_inbox["badge"]["has_stranger_unread"] is True
    assert merchant_inbox["badge"]["main_unread_count"] == 0
    assert merchant_inbox["items"] == []

    read_all_response = client.post("/api/v1/messages/read-all", headers=merchant_headers)
    assert read_all_response.status_code == 200
    assert read_all_response.json()["updated"] == 2
    merchant_inbox_after_read = client.get("/api/v1/messages/inbox", headers=merchant_headers)
    assert merchant_inbox_after_read.status_code == 200
    assert merchant_inbox_after_read.json()["badge"]["main_unread_count"] == 0
    assert merchant_inbox_after_read.json()["stranger_bucket"]["unread_count"] == 0

    thread_response = client.get(f"/api/v1/messages/conversations/{consumer['id']}", headers=merchant_headers)
    assert thread_response.status_code == 200
    thread_payload = thread_response.json()
    assert thread_payload["target"]["role"] == "consumer"
    assert thread_payload["can_send"] is True
    assert all(item["read_at"] is not None for item in thread_payload["items"] if item["sender_user_id"] == consumer["id"])

    reply = client.post(
        f"/api/v1/messages/conversations/{consumer['id']}",
        headers=merchant_headers,
        json={"content": "可以，欢迎预约。"},
    )
    assert reply.status_code == 200

    consumer_inbox_response = client.get("/api/v1/messages/inbox", headers=consumer_headers)
    assert consumer_inbox_response.status_code == 200
    consumer_inbox = consumer_inbox_response.json()
    assert consumer_inbox["stranger_bucket"] is None
    assert consumer_inbox["badge"]["has_stranger_unread"] is False
    assert consumer_inbox["badge"]["main_unread_count"] == 1
    assert consumer_inbox["items"][0]["target"]["id"] == merchant["id"]
    assert consumer_inbox["items"][0]["target"]["role"] == "merchant"


def test_consumer_can_send_image_message_to_merchant(client, db_session, image_factory):
    consumer_headers, consumer = _register_and_login(client, phone="13920000021", username="consumer_img")
    merchant_headers, merchant = _register_and_login(client, phone="13920000022", username="merchant_img")
    _promote_to_merchant(db_session, merchant)

    with image_factory("message-image.png").open("rb") as image_file:
        response = client.post(
            f"/api/v1/messages/conversations/{merchant['id']}/images",
            headers=consumer_headers,
            files={"image": ("message.png", image_file.read(), "image/png")},
            data={"content": ""},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["content"] == ""
    assert payload["image_url"].startswith("/files/uploads/messages/")

    thread_response = client.get(f"/api/v1/messages/conversations/{consumer['id']}", headers=merchant_headers)
    assert thread_response.status_code == 200
    thread_payload = thread_response.json()
    assert thread_payload["items"][0]["image_url"] == payload["image_url"]

    inbox_response = client.get("/api/v1/messages/inbox", headers=merchant_headers)
    assert inbox_response.status_code == 200
    assert inbox_response.json()["stranger_bucket"]["latest_message_preview"] == "[图片]"


def test_same_role_direct_messages_are_allowed(client, db_session):
    alice_headers, alice = _register_and_login(client, phone="13920000003", username="consumer_a")
    _, bob = _register_and_login(client, phone="13920000004", username="consumer_b")
    merchant_a_headers, merchant_a = _register_and_login(client, phone="13920000005", username="merchant_a")
    _, merchant_b = _register_and_login(client, phone="13920000006", username="merchant_b")
    _promote_to_merchant(db_session, merchant_a)
    _promote_to_merchant(db_session, merchant_b)

    consumer_response = client.post(
        f"/api/v1/messages/conversations/{bob['id']}",
        headers=alice_headers,
        json={"content": "普通用户之间可以聊"},
    )
    assert consumer_response.status_code == 200

    merchant_response = client.post(
        f"/api/v1/messages/conversations/{merchant_b['id']}",
        headers=merchant_a_headers,
        json={"content": "商家之间也可以聊"},
    )
    assert merchant_response.status_code == 200

    thread_response = client.get(f"/api/v1/messages/conversations/{bob['id']}", headers=alice_headers)
    assert thread_response.status_code == 200


def test_stranger_messages_endpoint_groups_unreplied_threads(client, db_session):
    consumer_headers, consumer = _register_and_login(client, phone="13920000007", username="consumer_inbox")
    merchant_headers, merchant = _register_and_login(client, phone="13920000008", username="merchant_inbox")
    _promote_to_merchant(db_session, merchant)

    incoming = client.post(
        f"/api/v1/messages/conversations/{consumer['id']}",
        headers=merchant_headers,
        json={"content": "你好，这里是商家消息。"},
    )
    assert incoming.status_code == 200

    inbox_response = client.get("/api/v1/messages/inbox", headers=consumer_headers)
    assert inbox_response.status_code == 200
    inbox_payload = inbox_response.json()
    assert inbox_payload["stranger_bucket"]["unread_count"] == 1
    assert inbox_payload["badge"]["has_stranger_unread"] is True
    assert inbox_payload["items"] == []

    stranger_response = client.get("/api/v1/messages/strangers", headers=consumer_headers)
    assert stranger_response.status_code == 200
    assert stranger_response.json()["items"][0]["target"]["id"] == merchant["id"]

    reply = client.post(
        f"/api/v1/messages/conversations/{merchant['id']}",
        headers=consumer_headers,
        json={"content": "收到"},
    )
    assert reply.status_code == 200
    inbox_after_reply = client.get("/api/v1/messages/inbox", headers=consumer_headers).json()
    assert inbox_after_reply["stranger_bucket"] is None
    assert inbox_after_reply["items"][0]["target"]["id"] == merchant["id"]


def test_blocked_user_cannot_message_or_view_blocker_posts(client, db_session, image_factory):
    author_headers, author = _register_and_login(client, phone="13920000005", username="author_block")
    viewer_headers, viewer = _register_and_login(client, phone="13920000006", username="viewer_block")
    _promote_to_merchant(db_session, author)

    with image_factory("blocked-style.png").open("rb") as image_file:
        create_response = client.post(
            "/api/v1/posts",
            headers=author_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "会被拉黑隐藏的作品", "description": "测试描述", "tags": "裸粉,通勤"},
        )
    assert create_response.status_code == 200

    block_response = client.post(f"/api/v1/users/{viewer['id']}/block", headers=author_headers)
    assert block_response.status_code == 200

    profile_response = client.get(f"/api/v1/users/{author['id']}/author-profile", headers=viewer_headers)
    assert profile_response.status_code == 200
    profile_payload = profile_response.json()
    assert profile_payload["has_blocked_viewer"] is True
    assert profile_payload["posts"] == []

    discover_response = client.get("/api/v1/nails/discover?page=1&page_size=20", headers=viewer_headers)
    assert discover_response.status_code == 200
    assert all(item["title"] != "会被拉黑隐藏的作品" for item in discover_response.json()["items"])

    message_response = client.post(
        f"/api/v1/messages/conversations/{author['id']}",
        headers=viewer_headers,
        json={"content": "还能私信吗"},
    )
    assert message_response.status_code == 403
    assert "对方已设置不再看你" in message_response.text


def test_viewer_blocking_merchant_hides_merchant_posts_from_feed_and_detail(client, db_session, image_factory):
    merchant_headers, merchant = _register_and_login(client, phone="13920000031", username="merchant_viewer_blocked")
    viewer_headers, viewer = _register_and_login(client, phone="13920000032", username="viewer_blocks_merchant")
    _promote_to_merchant(db_session, merchant)

    with image_factory("viewer-blocked-style.png").open("rb") as image_file:
        create_response = client.post(
            "/api/v1/posts",
            headers=merchant_headers,
            files={"image": ("post.png", image_file.read(), "image/png")},
            data={"title": "用户主动拉黑后隐藏的作品", "description": "测试描述", "tags": "红色,显白"},
        )
    assert create_response.status_code == 200
    profile_before_block = client.get(f"/api/v1/users/{merchant['id']}/author-profile", headers=viewer_headers)
    assert profile_before_block.status_code == 200
    style_id = next(item["id"] for item in profile_before_block.json()["posts"] if item["title"] == "用户主动拉黑后隐藏的作品")

    before_block = client.get("/api/v1/nails/discover?page=1&page_size=30", headers=viewer_headers)
    assert before_block.status_code == 200
    assert any(item["id"] == style_id for item in before_block.json()["items"])

    block_response = client.post(f"/api/v1/users/{merchant['id']}/block", headers=viewer_headers)
    assert block_response.status_code == 200

    discover_response = client.get("/api/v1/nails/discover?page=1&page_size=30", headers=viewer_headers)
    assert discover_response.status_code == 200
    assert all(item["id"] != style_id for item in discover_response.json()["items"])

    local_response = client.get("/api/v1/nails/local?city=深圳&page=1&page_size=50", headers=viewer_headers)
    assert local_response.status_code == 200
    assert all(item["id"] != style_id for item in local_response.json()["items"])

    detail_response = client.get(f"/api/v1/nails/{style_id}", headers=viewer_headers)
    assert detail_response.status_code == 404

    profile_response = client.get(f"/api/v1/users/{merchant['id']}/author-profile", headers=viewer_headers)
    assert profile_response.status_code == 200
    assert profile_response.json()["viewer_has_blocked_author"] is True
    assert profile_response.json()["posts"] == []
