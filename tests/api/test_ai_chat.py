from __future__ import annotations

import json

from app.models.nail_style import NailStyle


def test_user_ai_chat_local_fallback(client, db_session, image_factory):
    style = NailStyle(
        title="裸粉通勤款",
        description="desc",
        image_url="http://example.com/style.png",
        local_image_path=str(image_factory("style.png")),
        source_type="test",
        tags_json=["裸粉", "通勤"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=20,
        is_trending=True,
    )
    db_session.add(style)
    db_session.commit()

    response = client.post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "我想找适合上班的美甲"}]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "local-user-assistant"
    assert "裸粉通勤款" in payload["reply"]


def test_user_ai_chat_uses_nail_rag_tool(client, app_env):
    app_env.nail_rag_path.mkdir(parents=True, exist_ok=True)
    (app_env.nail_rag_path / "notes.json").write_text(
        json.dumps(
            [
                {
                    "note_id": "note-1",
                    "title": "冷调猫眼显白短甲",
                    "author": "tester",
                    "publish_time": "2026-05-10",
                    "liked_count": 1200,
                    "collected_count": 300,
                    "share_count": 40,
                    "tags": ["显白", "短甲", "猫眼"],
                    "caption": "适合黄皮和短甲的冷调猫眼。",
                    "desc": "黄黑皮显白短甲款式",
                    "image_urls": [],
                    "local_image_paths": [],
                    "retrieval_text": "显白 短甲 猫眼 黄黑皮",
                }
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    response = client.post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "推荐一个黄黑皮显白短甲"}]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["model"] == "local-user-assistant"
    assert "冷调猫眼显白短甲" in payload["reply"]
