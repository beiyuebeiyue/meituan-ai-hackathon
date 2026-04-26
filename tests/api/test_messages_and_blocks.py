from __future__ import annotations


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


def test_direct_messages_require_reply_or_24h_gap_when_not_mutual_follow(client):
    alice_headers, alice = _register_and_login(client, phone="13920000001", username="alice_msg")
    bob_headers, bob = _register_and_login(client, phone="13920000002", username="bob_msg")

    first = client.post(
        f"/api/v1/messages/conversations/{bob['id']}",
        headers=alice_headers,
        json={"content": "你好，我想问问这款美甲。"},
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/v1/messages/conversations/{bob['id']}",
        headers=alice_headers,
        json={"content": "我再补充一句。"},
    )
    assert second.status_code == 429
    assert "24小时内只能发送1条消息" in second.text

    reply = client.post(
        f"/api/v1/messages/conversations/{alice['id']}",
        headers=bob_headers,
        json={"content": "可以呀，你继续说。"},
    )
    assert reply.status_code == 200

    third = client.post(
        f"/api/v1/messages/conversations/{bob['id']}",
        headers=alice_headers,
        json={"content": "那我想试试裸粉法式。"},
    )
    assert third.status_code == 200


def test_mutual_follow_can_send_unlimited_messages(client):
    alice_headers, alice = _register_and_login(client, phone="13920000003", username="alice_follow")
    bob_headers, bob = _register_and_login(client, phone="13920000004", username="bob_follow")

    assert client.post(f"/api/v1/users/{bob['id']}/follow", headers=alice_headers).status_code == 200
    assert client.post(f"/api/v1/users/{alice['id']}/follow", headers=bob_headers).status_code == 200

    first = client.post(
        f"/api/v1/messages/conversations/{bob['id']}",
        headers=alice_headers,
        json={"content": "互关之后第一条"},
    )
    second = client.post(
        f"/api/v1/messages/conversations/{bob['id']}",
        headers=alice_headers,
        json={"content": "互关之后第二条"},
    )
    assert first.status_code == 200
    assert second.status_code == 200


def test_stranger_messages_stay_in_bucket_until_viewer_replies(client):
    alice_headers, alice = _register_and_login(client, phone="13920000007", username="alice_inbox")
    bob_headers, bob = _register_and_login(client, phone="13920000008", username="bob_inbox")

    incoming = client.post(
        f"/api/v1/messages/conversations/{alice['id']}",
        headers=bob_headers,
        json={"content": "你好，我是陌生人消息。"},
    )
    assert incoming.status_code == 200

    inbox_response = client.get("/api/v1/messages/inbox", headers=alice_headers)
    assert inbox_response.status_code == 200
    inbox_payload = inbox_response.json()
    assert inbox_payload["stranger_bucket"]["thread_count"] == 1
    assert inbox_payload["stranger_bucket"]["unread_count"] == 1
    assert inbox_payload["badge"]["has_stranger_unread"] is True
    assert inbox_payload["items"] == []

    stranger_response = client.get("/api/v1/messages/strangers", headers=alice_headers)
    assert stranger_response.status_code == 200
    stranger_payload = stranger_response.json()
    assert len(stranger_payload["items"]) == 1
    assert stranger_payload["items"][0]["target"]["id"] == bob["id"]
    assert stranger_payload["items"][0]["unread_count"] == 1
    assert stranger_payload["items"][0]["is_stranger_source"] is True

    thread_response = client.get(f"/api/v1/messages/conversations/{bob['id']}", headers=alice_headers)
    assert thread_response.status_code == 200
    thread_payload = thread_response.json()
    assert all(item["read_at"] is not None for item in thread_payload["items"] if item["sender_user_id"] == bob["id"])

    read_inbox_response = client.get("/api/v1/messages/inbox", headers=alice_headers)
    assert read_inbox_response.status_code == 200
    read_inbox_payload = read_inbox_response.json()
    assert read_inbox_payload["badge"]["has_stranger_unread"] is False
    assert read_inbox_payload["stranger_bucket"]["thread_count"] == 1
    assert read_inbox_payload["stranger_bucket"]["unread_count"] == 0

    reply = client.post(
        f"/api/v1/messages/conversations/{bob['id']}",
        headers=alice_headers,
        json={"content": "我回复过你了。"},
    )
    assert reply.status_code == 200

    promoted_inbox_response = client.get("/api/v1/messages/inbox", headers=alice_headers)
    assert promoted_inbox_response.status_code == 200
    promoted_payload = promoted_inbox_response.json()
    assert promoted_payload["stranger_bucket"] is None
    assert len(promoted_payload["items"]) == 1
    assert promoted_payload["items"][0]["target"]["id"] == bob["id"]
    assert promoted_payload["items"][0]["is_stranger_source"] is False


def test_mutual_follow_messages_go_directly_to_main_inbox(client):
    alice_headers, alice = _register_and_login(client, phone="13920000009", username="alice_main")
    bob_headers, bob = _register_and_login(client, phone="13920000010", username="bob_main")

    assert client.post(f"/api/v1/users/{bob['id']}/follow", headers=alice_headers).status_code == 200
    assert client.post(f"/api/v1/users/{alice['id']}/follow", headers=bob_headers).status_code == 200

    first = client.post(
        f"/api/v1/messages/conversations/{alice['id']}",
        headers=bob_headers,
        json={"content": "互关后第一条。"},
    )
    second = client.post(
        f"/api/v1/messages/conversations/{alice['id']}",
        headers=bob_headers,
        json={"content": "互关后第二条。"},
    )
    assert first.status_code == 200
    assert second.status_code == 200

    inbox_response = client.get("/api/v1/messages/inbox", headers=alice_headers)
    assert inbox_response.status_code == 200
    inbox_payload = inbox_response.json()
    assert inbox_payload["stranger_bucket"] is None
    assert inbox_payload["badge"]["has_stranger_unread"] is False
    assert inbox_payload["badge"]["main_unread_count"] == 2
    assert len(inbox_payload["items"]) == 1
    assert inbox_payload["items"][0]["target"]["id"] == bob["id"]
    assert inbox_payload["items"][0]["unread_count"] == 2
    assert inbox_payload["items"][0]["is_mutual_follow"] is True

    stranger_response = client.get("/api/v1/messages/strangers", headers=alice_headers)
    assert stranger_response.status_code == 200
    assert stranger_response.json()["items"] == []


def test_blocked_user_cannot_message_or_view_blocker_posts(client, image_factory):
    author_headers, author = _register_and_login(client, phone="13920000005", username="author_block")
    viewer_headers, viewer = _register_and_login(client, phone="13920000006", username="viewer_block")

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
    assert "对方已将您拉黑" in message_response.text
