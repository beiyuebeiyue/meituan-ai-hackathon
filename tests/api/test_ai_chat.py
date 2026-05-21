from __future__ import annotations

import json
import sys
from types import SimpleNamespace

import numpy as np


def test_user_ai_chat_requires_longcat(client):
    response = client.post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "猫眼是什么"}]},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "小嘉大模型未配置"


def test_text_tool_embedding_failure_returns_empty_recommendations():
    from app.routers.ai_recommend import user_chat_service
    from app.services.user_chat_tools import TEXT_TOOL_NAME

    result = user_chat_service._execute_tool_call(TEXT_TOOL_NAME, {"query": "推荐一个黄黑皮显白短甲"}, "推荐一个黄黑皮显白短甲", None)

    assert result["status"] == "failed"
    assert result["recommendations"] == []


def test_hand_tool_requests_hand_image_without_hand_features():
    from app.routers.ai_recommend import user_chat_service
    from app.services.user_chat_tools import HAND_TOOL_NAME

    result = user_chat_service._execute_tool_call(HAND_TOOL_NAME, {"query": "我的手适合哪些显白美甲"}, "我的手适合哪些显白美甲", None)

    assert result["status"] == "failed"
    assert result["error_type"] == "needs_hand_image"
    assert result["recommendations"] == []


def test_user_ai_chat_returns_text_vector_recommendations(client, app_env, image_factory, monkeypatch):
    from app.routers.ai_recommend import user_chat_service
    from app.services.user_chat_tools import TEXT_TOOL_NAME

    assets_root = app_env.xhs_crawler_assets_path
    run_dir = assets_root / "20260518"
    (run_dir / "images").mkdir(parents=True, exist_ok=True)

    note_ids = ["best-match", "second-match", "low-match", "missing-image", "foot-note"]
    (assets_root / "xhs_note_registry.json").write_text(json.dumps({"note_ids": note_ids}), encoding="utf-8")
    notes = []
    for index, note_id in enumerate(note_ids):
        image_path = run_dir / "images" / note_id / f"{note_id}_01.png"
        if note_id != "missing-image":
            image_path.parent.mkdir(parents=True, exist_ok=True)
            image_path.write_bytes(image_factory(f"{note_id}.png").read_bytes())
        notes.append(
            {
                "note_id": note_id,
                "title": "夏天脚趾甲美甲" if note_id == "foot-note" else f"显白款 {note_id}",
                "standard_nail_image": f"assets/20260518/images/{note_id}/{note_id}_01.png",
                "tags": ["显白", "通勤"],
                "liked_count": 100 - index,
                "collected_count": 20,
                "share_count": index,
            }
        )
    (run_dir / "xhs_note_digest.json").write_text(json.dumps({"notes": notes}, ensure_ascii=False), encoding="utf-8")
    _write_embedding_assets(
        assets_root,
        [
            ("best-match", [1.0, 0.0]),
            ("second-match", [0.8, 0.6]),
            ("low-match", [0.0, 1.0]),
            ("missing-image", [0.99, 0.0]),
            ("foot-note", [0.98, 0.0]),
        ],
    )
    monkeypatch.setattr(
        user_chat_service.xhs_vector_recommendation_service,
        "_embed_text",
        lambda query, dimension: np.asarray([1.0, 0.0], dtype=np.float32),
    )

    result = user_chat_service._execute_tool_call(
        TEXT_TOOL_NAME,
        {"query": "帮我找几款热门显白美甲", "limit": 5},
        "帮我找几款热门显白美甲",
        None,
    )

    recommendations = result["recommendations"]
    returned_ids = [item["note_id"] for item in recommendations]
    assert returned_ids[:2] == ["best-match", "second-match"]
    assert "missing-image" not in returned_ids
    assert "foot-note" not in returned_ids
    for item in recommendations:
        assert item["image_url"].startswith("/openclaw-assets/20260518/images/")
        assert "甲型" in item["reason"]


def test_user_ai_chat_color_feature_filter_coarse_filters_before_vector_ranking(client, app_env, image_factory, monkeypatch):
    from app.routers.ai_recommend import user_chat_service
    from app.services.user_chat_tools import TEXT_TOOL_NAME

    assets_root = app_env.xhs_crawler_assets_path
    run_dir = assets_root / "20260518"
    note_ids = ["pink-top-vector", "green-lower-vector"]
    assets_root.mkdir(parents=True, exist_ok=True)
    (assets_root / "xhs_note_registry.json").write_text(json.dumps({"note_ids": note_ids}), encoding="utf-8")

    notes = []
    for note_id in note_ids:
        image_path = run_dir / "images" / note_id / f"{note_id}_01.png"
        image_path.parent.mkdir(parents=True, exist_ok=True)
        image_path.write_bytes(image_factory(f"{note_id}.png").read_bytes())
        notes.append(
            {
                "note_id": note_id,
                "title": f"测试款 {note_id}",
                "standard_nail_image": f"assets/20260518/images/{note_id}/{note_id}_01.png",
                "tags": ["通勤"],
                "liked_count": 10,
                "collected_count": 3,
                "share_count": 1,
            }
        )
    (run_dir / "xhs_note_digest.json").write_text(json.dumps({"notes": notes}, ensure_ascii=False), encoding="utf-8")
    (assets_root / "xhs_image_features.json").write_text(
        json.dumps(
            {
                "items": [
                    _feature_item("pink-top-vector", 200, "暖", "修长", colors=["粉色"]),
                    _feature_item("green-lower-vector", 200, "暖", "修长", colors=["绿色"]),
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    _write_embedding_assets(
        assets_root,
        [
            ("pink-top-vector", [1.0, 0.0]),
            ("green-lower-vector", [0.2, 0.98]),
        ],
    )
    monkeypatch.setattr(
        user_chat_service.xhs_vector_recommendation_service,
        "_embed_text",
        lambda query, dimension: np.asarray([1.0, 0.0], dtype=np.float32),
    )

    result = user_chat_service._execute_tool_call(
        TEXT_TOOL_NAME,
        {"query": "推荐绿色美甲", "limit": 5, "filters": {"colors": ["绿色"]}},
        "推荐绿色美甲",
        None,
    )

    assert [item["note_id"] for item in result["recommendations"]] == ["green-lower-vector"]


def test_hand_tool_without_hand_features_returns_failed_result():
    from app.routers.ai_recommend import user_chat_service
    from app.services.user_chat_tools import HAND_TOOL_NAME

    result = user_chat_service._execute_tool_call(
        HAND_TOOL_NAME,
        {"query": "适合我的显白美甲", "limit": 5},
        "适合我的显白美甲",
        None,
    )

    assert result["status"] == "failed"
    assert result["error_type"] == "needs_hand_image"
    assert result["recommendations"] == []
    assert "上传" in result["error"]


def test_longcat_unknown_textual_tool_markup_is_not_treated_as_recommendations(app_env, monkeypatch):
    from app.core.config import get_settings
    from app.schemas.ai import AIChatMessage
    from app.services.user_chat_service import UserChatService

    monkeypatch.setenv("LONGCAT_API_KEY", "test-key")
    get_settings.cache_clear()

    class FakeCompletions:
        def create(self, **kwargs):
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=(
                                "我来帮你搜索。\n"
                                '<longcat_tool_call>\n{"name":"search_nail_rag","arguments":{"query":"显白猫眼"}}\n</longcat_tool_call>'
                            ),
                        )
                    )
                ]
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))

    response = UserChatService()._longcat_reply(
        [AIChatMessage(role="user", content="帮我找几款最近热门的显白猫眼")],
        "帮我找几款最近热门的显白猫眼",
        None,
    )

    assert response.recommendations == []
    assert "<longcat_tool_call>" not in response.reply
    assert "没有调用到可用" in response.reply


def test_longcat_textual_tool_markup_executes_known_tool(app_env, image_factory, monkeypatch):
    from app.core.config import get_settings
    from app.routers.ai_recommend import user_chat_service
    from app.schemas.ai import AIChatMessage

    monkeypatch.setenv("LONGCAT_API_KEY", "test-key")
    get_settings.cache_clear()

    assets_root = app_env.xhs_crawler_assets_path
    run_dir = assets_root / "20260520"
    note_id = "green-note"
    image_path = run_dir / "images" / note_id / f"{note_id}_01.png"
    image_path.parent.mkdir(parents=True, exist_ok=True)
    image_path.write_bytes(image_factory("green-note.png").read_bytes())
    (assets_root / "xhs_note_registry.json").write_text(json.dumps({"note_ids": [note_id]}), encoding="utf-8")
    (run_dir / "xhs_note_digest.json").write_text(
        json.dumps(
            {
                "notes": [
                    {
                        "note_id": note_id,
                        "title": "绿色猫眼美甲",
                        "standard_nail_image": f"assets/20260520/images/{note_id}/{note_id}_01.png",
                        "tags": ["绿色", "猫眼"],
                    }
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (assets_root / "xhs_image_features.json").write_text(
        json.dumps({"items": [_feature_item(note_id, 200, "暖", "修长", colors=["绿色"])]}, ensure_ascii=False),
        encoding="utf-8",
    )
    _write_embedding_assets(assets_root, [(note_id, [1.0, 0.0])])
    monkeypatch.setattr(
        user_chat_service.xhs_vector_recommendation_service,
        "_embed_text",
        lambda query, dimension: np.asarray([1.0, 0.0], dtype=np.float32),
    )

    class FakeCompletions:
        def __init__(self):
            self.calls = 0

        def create(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                return SimpleNamespace(
                    choices=[
                        SimpleNamespace(
                            message=SimpleNamespace(
                                content=(
                                    '<longcat_tool_call>\n'
                                    '{"name":"search_nail_images_by_text","arguments":{"query":"绿色猫眼美甲","filters":{"colors":["绿色"]}}}\n'
                                    "</longcat_tool_call>"
                                ),
                            )
                        )
                    ]
                )
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="我按绿色猫眼帮你挑好了，下面看卡片。"))])

    fake_completions = FakeCompletions()

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=fake_completions)

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))

    response = user_chat_service._longcat_reply(
        [AIChatMessage(role="user", content="帮我找绿色猫眼美甲")],
        "帮我找绿色猫眼美甲",
        None,
    )

    assert response.reply == "我按你的需求挑好了几款美甲，下面卡片里有图片和推荐理由。"
    assert [item.note_id for item in response.recommendations] == [note_id]


def test_longcat_structured_tool_call_executes_known_tool(app_env, monkeypatch):
    from app.core.config import get_settings
    from app.schemas.ai import AIChatMessage
    from app.services.user_chat_service import UserChatService
    from app.services.user_chat_tools import TEXT_TOOL_NAME

    monkeypatch.setenv("LONGCAT_API_KEY", "test-key")
    get_settings.cache_clear()
    captured_kwargs = {}

    class FakeTool:
        name = TEXT_TOOL_NAME
        description = "根据用户文字需求检索美甲图片"

        def parameters(self):
            return {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}

        def execute(self, arguments, default_query, hand_features):
            assert arguments == {"query": "绿色美甲", "filters": {"colors": ["绿色"]}}
            assert default_query == "给我推荐绿色美甲"
            assert hand_features is None
            return {
                "status": "succeeded",
                "tool": self.name,
                "query": arguments["query"],
                "recommendations": [
                    {
                        "note_id": "green-note",
                        "title": "绿色猫眼美甲",
                        "image_url": "/openclaw-assets/green.webp",
                        "tags": ["绿色", "猫眼"],
                        "reason": "含绿色色系，贴合你的颜色需求",
                        "score": 1.0,
                        "liked_count": 10,
                        "collected_count": 5,
                        "share_count": 1,
                    }
                ],
            }

    class FakeCompletions:
        def create(self, **kwargs):
            captured_kwargs.update(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content="我来为你推荐绿色美甲。",
                            tool_calls=[
                                SimpleNamespace(
                                    function=SimpleNamespace(
                                        name=TEXT_TOOL_NAME,
                                        arguments='{"query":"绿色美甲","filters":{"colors":["绿色"]}}',
                                    )
                                )
                            ],
                        )
                    )
                ]
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))
    service = UserChatService()
    service.chat_tools_by_name = {TEXT_TOOL_NAME: FakeTool()}
    monkeypatch.setattr(service, "_available_tools", lambda hand_features: [FakeTool()])

    response = service._longcat_reply(
        [AIChatMessage(role="user", content="给我推荐绿色美甲")],
        "给我推荐绿色美甲",
        None,
    )

    assert captured_kwargs["tools"][0]["function"]["name"] == TEXT_TOOL_NAME
    assert captured_kwargs["tool_choice"] == "auto"
    assert response.reply == "我按你的需求挑好了几款美甲，下面卡片里有图片和推荐理由。"
    assert [item.note_id for item in response.recommendations] == ["green-note"]


def test_longcat_text_tool_call_for_hand_query_requests_hand_image(app_env, monkeypatch):
    from app.core.config import get_settings
    from app.schemas.ai import AIChatMessage
    from app.services.user_chat_service import UserChatService
    from app.services.user_chat_tools import TEXT_TOOL_NAME

    monkeypatch.setenv("LONGCAT_API_KEY", "test-key")
    get_settings.cache_clear()

    class FakeCompletions:
        def create(self, **kwargs):
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content="我来帮你找适合你的款式。",
                            tool_calls=[
                                SimpleNamespace(
                                    function=SimpleNamespace(
                                        name=TEXT_TOOL_NAME,
                                        arguments='{"query":"温柔裸粉美甲","filters":{"colors":["粉色","裸色"]}}',
                                    )
                                )
                            ],
                        )
                    )
                ]
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))

    response = UserChatService()._longcat_reply(
        [AIChatMessage(role="user", content="我的手适合哪些温柔裸粉美甲")],
        "我的手适合哪些温柔裸粉美甲",
        None,
    )

    assert response.needs_hand_image is True
    assert response.recommendations == []
    assert response.hand_picker_message


def test_longcat_legacy_arg_markup_is_ignored(app_env, image_factory, monkeypatch):
    from app.core.config import get_settings
    from app.schemas.ai import AIChatMessage
    from app.services.user_chat_service import UserChatService

    monkeypatch.setenv("LONGCAT_API_KEY", "test-key")
    get_settings.cache_clear()

    class FakeCompletions:
        def create(self, **kwargs):
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=(
                                "<longcat_tool_call>search_nail_images_by_text\n"
                                "<longcat_arg_key>query</longcat_arg_key>\n"
                                "<longcat_arg_value>绿色美甲</longcat_arg_value>\n"
                                "</longcat_tool_call>"
                            )
                        )
                    )
                ]
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))

    response = UserChatService()._longcat_reply(
        [AIChatMessage(role="user", content="给我推荐绿色美甲")],
        "给我推荐绿色美甲",
        None,
    )

    assert response.recommendations == []
    assert "没有调用到可用" in response.reply


def test_longcat_tool_prompt_uses_structured_tool_calls(app_env):
    from app.services.user_chat_service import UserChatService
    from app.services.user_chat_tools import SearchNailImagesByTextTool
    from app.services.xhs_vector_recommendation_service import XhsVectorRecommendationService

    prompt = UserChatService._tool_system_prompt(
        None,
        [SearchNailImagesByTextTool(XhsVectorRecommendationService())],
    )

    assert "function tool call" in prompt
    assert "<longcat_tool_call>" not in prompt
    assert "<longcat_arg_key>" not in prompt
    assert "<longcat_arg_value>" not in prompt


def test_longcat_no_tool_call_returns_plain_reply_without_recommendations(app_env, monkeypatch):
    from app.core.config import get_settings
    from app.schemas.ai import AIChatMessage
    from app.services.user_chat_service import UserChatService

    monkeypatch.setenv("LONGCAT_API_KEY", "test-key")
    get_settings.cache_clear()

    class FakeCompletions:
        def create(self, **kwargs):
            assert "## Tools" in kwargs["messages"][0]["content"]
            assert kwargs["tool_choice"] == "auto"
            assert kwargs["tools"][0]["type"] == "function"
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="可以，我先了解一下你的偏好。"))])

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=FakeOpenAI))

    response = UserChatService()._longcat_reply(
        [AIChatMessage(role="user", content="帮我找绿色美甲")],
        "帮我找绿色美甲",
        None,
    )

    assert response.recommendations == []
    assert response.reply == "可以，我先了解一下你的偏好。"


def test_user_ai_chat_multipart_hand_match_uses_strict_hand_features(client, app_env, image_factory, monkeypatch):
    from app.routers.ai_recommend import user_chat_service
    from app.services.user_chat_tools import HAND_TOOL_NAME

    assets_root = app_env.xhs_crawler_assets_path
    run_dir = assets_root / "20260520"
    (run_dir / "images").mkdir(parents=True, exist_ok=True)
    note_ids = ["match-hot", "match-cold-score", "wrong-undertone", "wrong-finger", "failed-feature", "foot-note", "not-registry"]
    (assets_root / "xhs_note_registry.json").write_text(
        json.dumps({"note_ids": [item for item in note_ids if item != "not-registry"]}),
        encoding="utf-8",
    )

    notes = []
    for index, note_id in enumerate(note_ids):
        image_path = run_dir / "images" / note_id / f"{note_id}_01.png"
        image_path.parent.mkdir(parents=True, exist_ok=True)
        image_path.write_bytes(image_factory(f"{note_id}.png").read_bytes())
        notes.append(
            {
                "note_id": note_id,
                "title": "脚趾甲款" if note_id == "foot-note" else f"手部款 {note_id}",
                "standard_nail_image": f"assets/20260520/images/{note_id}/{note_id}_01.png",
                "tags": ["显白"],
                "liked_count": 1000 - index,
                "collected_count": 100,
                "share_count": 10,
            }
        )
    (run_dir / "xhs_note_digest.json").write_text(json.dumps({"notes": notes}, ensure_ascii=False), encoding="utf-8")
    _write_embedding_assets(
        assets_root,
        [
            ("match-hot", [1.0, 0.0]),
            ("match-cold-score", [0.8, 0.6]),
            ("wrong-undertone", [0.99, 0.0]),
            ("wrong-finger", [0.98, 0.0]),
            ("failed-feature", [0.97, 0.0]),
            ("foot-note", [0.96, 0.0]),
            ("not-registry", [0.95, 0.0]),
        ],
    )
    (assets_root / "xhs_image_features.json").write_text(
        json.dumps(
            {
                "items": [
                    _feature_item("match-hot", 200, "暖", "修长"),
                    _feature_item("match-cold-score", 200, "暖", "修长"),
                    _feature_item("wrong-undertone", 200, "冷", "修长"),
                    _feature_item("wrong-finger", 200, "暖", "均衡"),
                    _feature_item("failed-feature", 422, "暖", "修长"),
                    _feature_item("foot-note", 200, "暖", "修长"),
                    _feature_item("not-registry", 200, "暖", "修长"),
                ]
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(
        user_chat_service.xhs_vector_recommendation_service,
        "_embed_text",
        lambda query, dimension: np.asarray([1.0, 0.0], dtype=np.float32),
    )

    result = user_chat_service._execute_tool_call(
        HAND_TOOL_NAME,
        {"query": "我的手适合哪些显白美甲", "limit": 5},
        "我的手适合哪些显白美甲",
        {"skin_undertone": "暖", "finger_shape": "修长", "confidence": "高"},
    )

    returned_ids = [item["note_id"] for item in result["recommendations"]]
    assert returned_ids == ["match-hot", "match-cold-score"]


def test_user_ai_chat_multipart_hand_feature_failed_returns_empty_recommendations(client, image_factory, monkeypatch):
    from app.routers.ai_recommend import user_chat_service
    from app.services.hand_feature_service import HandFeatureError

    monkeypatch.setattr(user_chat_service.hand_feature_service, "analyze_upload", lambda upload: (_ for _ in ()).throw(HandFeatureError("看不清手指")))

    image_path = image_factory("bad-hand.png")
    response = client.post(
        "/api/v1/ai/chat",
        data={"messages": json.dumps([{"role": "user", "content": "我的手适合哪些美甲"}], ensure_ascii=False)},
        files={"hand_image": ("hand.png", image_path.read_bytes(), "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommendations"] == []
    assert "换一张" in payload["reply"]


def _feature_item(note_id: str, status: int, undertone: str, finger_shape: str, colors: list[str] | None = None) -> dict:
    return {
        "note_id": note_id,
        "run_dir": "20260520",
        "image_path": f"assets/20260520/images/{note_id}/{note_id}_01.png",
        "status": status,
        "features": {
            "hand": {"skin_undertone": undertone, "finger_shape": finger_shape, "confidence": "高"},
            "nail": {"shape": "椭圆", "length": "中", "colors": colors or ["粉色"], "finish": [], "confidence": "中"},
        },
    }


def _write_embedding_assets(assets_root, rows: list[tuple[str, list[float]]]) -> None:
    from app.services import xhs_vector_recommendation_service as vector_service

    import faiss

    embeddings_dir = assets_root / "embeddings"
    embeddings_dir.mkdir(parents=True, exist_ok=True)
    vectors = np.asarray([vector for _, vector in rows], dtype=np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = vectors / np.maximum(norms, 1e-12)
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)
    faiss.write_index(index, str(embeddings_dir / "xhs_standard_nail.faiss"))
    (embeddings_dir / "xhs_standard_nail_manifest.json").write_text(
        json.dumps(
            {
                "count": len(rows),
                "dimension": vectors.shape[1],
                "model": "test-model",
                "metric": "cosine",
                "source": "standard_nail_image",
            }
        ),
        encoding="utf-8",
    )
    (embeddings_dir / "xhs_standard_nail_metadata.jsonl").write_text(
        "\n".join(
            json.dumps(
                {
                    "row": index,
                    "note_id": note_id,
                    "run_dir": "20260520",
                    "image_path": f"assets/20260520/images/{note_id}/{note_id}_01.png",
                    "features": {
                        "hand": {"skin_undertone": "暖", "finger_shape": "修长", "confidence": "高"},
                        "nail": {"shape": "椭圆", "length": "中", "colors": ["粉色"], "finish": []},
                    },
                },
                ensure_ascii=False,
            )
            for index, (note_id, _) in enumerate(rows)
        )
        + "\n",
        encoding="utf-8",
    )
    vector_service._load_embedding_bundle.cache_clear()
    vector_service._load_hand_matched_note_ids.cache_clear()
