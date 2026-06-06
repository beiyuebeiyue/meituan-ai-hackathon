from __future__ import annotations

import sys
from types import SimpleNamespace

from app.models.user_post import UserPost


def _register_and_login(client, *, phone: str, username: str) -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={"phone": phone, "password": "pass123456", "username": username},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": phone, "password": "pass123456"},
    )
    payload = response.json()
    return {"Authorization": f"Bearer {payload['access_token']}"}


def test_generate_post_metadata_uses_longcat_with_database_examples(
    client,
    db_session,
    image_factory,
    app_env,
    monkeypatch,
):
    app_env.longcat_api_key = "test-longcat-key"
    captured: dict[str, object] = {}
    db_session.add(
        UserPost(
            user_id="seed-author",
            title="奶油裸粉猫眼太显白",
            description="细闪猫眼配裸粉底色，通勤和约会都很温柔。",
            image_url="/files/uploads/post.jpg",
            local_image_path="data/uploads/post.jpg",
            nail_type="press_on",
            tags_json=["裸粉", "猫眼", "显白"],
            source_type="xhs_note",
            source_metadata_json={},
        )
    )
    db_session.commit()

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content='{"title":"清透裸粉猫眼","description":"这张图是清透裸粉底色，猫眼光感很细腻，适合通勤和约会。","tags":["裸粉","猫眼","显白","通勤"]}'
                        )
                    )
                ]
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))
    headers = _register_and_login(client, phone="13920000001", username="poster")
    image_path = image_factory("post.jpg")

    with image_path.open("rb") as image_file:
        response = client.post(
            "/api/v1/posts/generate-metadata",
            headers=headers,
            files={"image": ("post.jpg", image_file, "image/jpeg")},
        )

    assert response.status_code == 200
    assert response.json() == {
        "title": "清透裸粉猫眼",
        "description": "这张图是清透裸粉底色，猫眼光感很细腻，适合通勤和约会。",
        "tags": ["裸粉", "猫眼", "显白", "通勤"],
        "model": app_env.longcat_multimodal_model,
    }
    system_prompt = captured["messages"][0]["content"]
    assert "奶油裸粉猫眼太显白" in system_prompt
    assert "只返回 JSON" in captured["messages"][1]["content"][0]["text"]
    assert captured["messages"][1]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
