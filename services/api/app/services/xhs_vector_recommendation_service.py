from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import get_settings
from app.schemas.ai import AIHotXhsRecommendationItem
from app.services.xhs_hot_recommendation_service import (
    _build_digest_index,
    _hot_score,
    _is_foot_nail_note,
    _select_image_url,
    _tags,
    _to_int,
)


HOT_INTENT_WORDS = ("热门", "爆款", "流行", "高赞", "收藏", "火")
BASIC_COLOR_ALIASES = {
    "绿色": ("绿色", "绿", "深绿", "墨绿", "橄榄绿", "牛油果绿", "豆绿"),
    "粉色": ("粉色", "粉", "裸粉", "豆沙粉", "玫粉", "樱花粉"),
    "裸色": ("裸色", "裸粉", "豆沙", "奶茶色", "肉桂色"),
    "白色": ("白色", "奶白", "米白", "乳白"),
    "黑色": ("黑色", "纯黑"),
    "红色": ("红色", "酒红", "枣红", "玫红"),
    "蓝色": ("蓝色", "深蓝", "雾霾蓝", "克莱因蓝"),
    "紫色": ("紫色", "香芋紫", "薰衣草紫"),
    "黄色": ("黄色", "鹅黄", "柠檬黄"),
    "金色": ("金色", "金属金"),
    "银色": ("银色", "金属银"),
    "棕色": ("棕色", "咖色", "巧克力色"),
    "灰色": ("灰色", "银灰"),
    "透明": ("透明", "清透", "透色"),
    "橙色": ("橙色", "橘色", "橘红"),
}


class XhsVectorRecommendationError(RuntimeError):
    pass


@dataclass(frozen=True)
class _EmbeddingBundle:
    index: Any
    metadata_by_row: dict[int, dict[str, Any]]
    manifest: dict[str, Any]
    root: Path
    digest_index: dict[str, dict[str, Any]]
    features_by_note_id: dict[str, dict[str, Any]]


class XhsVectorRecommendationService:
    def recommend_by_text(self, query: str, limit: int = 5, filters: dict[str, Any] | None = None) -> list[AIHotXhsRecommendationItem]:
        return self._recommend(query, limit=limit, filters=filters)

    def recommend_by_hand_and_text(
        self,
        query: str,
        hand_features: dict[str, str],
        limit: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[AIHotXhsRecommendationItem]:
        root = get_settings().xhs_crawler_assets_path
        allowed_note_ids = _load_hand_matched_note_ids(
            str(root),
            _assets_mtime(root),
            hand_features.get("skin_undertone", ""),
            hand_features.get("finger_shape", ""),
        )
        if not allowed_note_ids:
            return []
        return self._recommend(query, limit=limit, hand_features=hand_features, allowed_note_ids=allowed_note_ids, filters=filters)

    def _recommend(
        self,
        query: str,
        limit: int,
        hand_features: dict[str, str] | None = None,
        allowed_note_ids: frozenset[str] | None = None,
        filters: dict[str, Any] | None = None,
    ) -> list[AIHotXhsRecommendationItem]:
        settings = get_settings()
        root = settings.xhs_crawler_assets_path
        requested_colors = _requested_colors(query, filters)
        if requested_colors and _is_color_only_query(query):
            bundle = _load_feature_bundle(str(root), _feature_assets_mtime(root))
            allowed_note_ids = _color_filtered_note_ids(bundle, requested_colors, allowed_note_ids)
            return _recommend_by_features(bundle, query, limit, hand_features, allowed_note_ids, requested_colors)

        bundle = _load_embedding_bundle(str(root), _assets_mtime(root))
        allowed_note_ids = _color_filtered_note_ids(bundle, requested_colors, allowed_note_ids)
        dimension = int(bundle.manifest.get("dimension") or 0)
        if dimension <= 0:
            raise XhsVectorRecommendationError("embedding manifest missing dimension")

        vector = self._embed_text(query.strip() or "美甲款式推荐", dimension)
        search_k = min(int(bundle.index.ntotal), max(settings.xhs_embedding_search_top_k, limit * 20))
        if allowed_note_ids is not None:
            search_k = int(bundle.index.ntotal)
        if search_k <= 0:
            return []

        scores, rows = bundle.index.search(vector.reshape(1, -1), search_k)
        ranked: list[dict[str, Any]] = []
        hot_intent = _has_hot_intent(query)
        for score, row in zip(scores[0].tolist(), rows[0].tolist()):
            if row < 0:
                continue
            metadata = bundle.metadata_by_row.get(int(row))
            if not metadata:
                continue
            note_id = str(metadata.get("note_id") or "").strip()
            if not note_id or (allowed_note_ids is not None and note_id not in allowed_note_ids):
                continue

            note = bundle.digest_index.get(note_id)
            if not note or _is_foot_nail_note(note):
                continue
            features = bundle.features_by_note_id.get(note_id) or _features(metadata)
            nail_features = _nail_features(features)
            if requested_colors and not _nail_matches_colors(nail_features, requested_colors):
                continue
            image_url = _select_image_url(root, note)
            if not image_url:
                continue

            liked_count = _to_int(note.get("liked_count"))
            collected_count = _to_int(note.get("collected_count"))
            share_count = _to_int(note.get("share_count"))
            hot_score = _hot_score(liked_count, collected_count, share_count)
            tags = _tags(note)
            final_score = float(score)
            if hot_intent:
                final_score += min(hot_score, 30.0) * 0.01
            ranked.append(
                {
                    "note_id": note_id,
                    "title": str(note.get("title") or "推荐美甲"),
                    "image_url": image_url,
                    "tags": tags,
                    "score": final_score,
                    "liked_count": liked_count,
                    "collected_count": collected_count,
                    "share_count": share_count,
                    "reason": _reason(query, hot_intent, hand_features, tags, liked_count, collected_count, share_count, nail_features, requested_colors),
                    "nail_features": nail_features,
                }
            )

        ranked.sort(key=lambda item: item["score"], reverse=True)
        return [_public_item(item) for item in ranked[:limit]]

    def _embed_text(self, query: str, dimension: int) -> np.ndarray:
        settings = get_settings()
        try:
            from gradio_client import Client

            client = Client(
                settings.xhs_embedding_gradio_space_id,
                token=settings.hf_token or None,
                verbose=False,
                httpx_kwargs={"timeout": settings.xhs_embedding_timeout_seconds},
            )
            result = client.predict(query, dimension, api_name="/embed_text")
        except Exception as exc:
            raise XhsVectorRecommendationError("text embedding API unavailable") from exc

        if not isinstance(result, dict) or result.get("status") != "succeeded":
            error = result.get("error") if isinstance(result, dict) else "invalid embedding response"
            raise XhsVectorRecommendationError(str(error))

        vector = np.asarray(result.get("embedding"), dtype=np.float32)
        if vector.shape != (dimension,):
            raise XhsVectorRecommendationError(f"embedding dimension mismatch: expected {dimension}, got {vector.shape}")
        norm = float(np.linalg.norm(vector))
        if norm > 0:
            vector = vector / norm
        return np.ascontiguousarray(vector, dtype=np.float32)


def _assets_mtime(root: Path) -> int:
    paths = [
        root / "xhs_image_features.json",
        root / "xhs_note_registry.json",
        root / "embeddings" / "xhs_standard_nail.faiss",
        root / "embeddings" / "xhs_standard_nail_metadata.jsonl",
        root / "embeddings" / "xhs_standard_nail_manifest.json",
        *root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json"),
    ]
    return max((path.stat().st_mtime_ns for path in paths if path.exists()), default=0)


def _feature_assets_mtime(root: Path) -> int:
    paths = [
        root / "xhs_image_features.json",
        root / "xhs_note_registry.json",
        *root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json"),
    ]
    return max((path.stat().st_mtime_ns for path in paths if path.exists()), default=0)


@lru_cache(maxsize=4)
def _load_embedding_bundle(root_value: str, mtime_ns: int) -> _EmbeddingBundle:
    del mtime_ns
    root = Path(root_value)
    embeddings_dir = root / "embeddings"
    index_path = embeddings_dir / "xhs_standard_nail.faiss"
    metadata_path = embeddings_dir / "xhs_standard_nail_metadata.jsonl"
    manifest_path = embeddings_dir / "xhs_standard_nail_manifest.json"
    if not index_path.exists() or not metadata_path.exists() or not manifest_path.exists():
        raise XhsVectorRecommendationError("xhs standard nail embedding assets are missing")

    try:
        import faiss

        index = faiss.read_index(str(index_path))
    except Exception as exc:
        raise XhsVectorRecommendationError("failed to load FAISS index") from exc

    metadata_by_row: dict[int, dict[str, Any]] = {}
    for line in metadata_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        metadata_by_row[int(item["row"])] = item

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if int(manifest.get("count") or 0) != len(metadata_by_row):
        raise XhsVectorRecommendationError("embedding metadata count mismatch")
    return _EmbeddingBundle(
        index=index,
        metadata_by_row=metadata_by_row,
        manifest=manifest,
        root=root,
        digest_index=_build_digest_index(root),
        features_by_note_id=_load_feature_index(root),
    )


@lru_cache(maxsize=4)
def _load_feature_bundle(root_value: str, mtime_ns: int) -> _EmbeddingBundle:
    del mtime_ns
    root = Path(root_value)
    return _EmbeddingBundle(
        index=None,
        metadata_by_row={},
        manifest={},
        root=root,
        digest_index=_build_digest_index(root),
        features_by_note_id=_load_feature_index(root),
    )


def _load_feature_index(root: Path) -> dict[str, dict[str, Any]]:
    feature_path = root / "xhs_image_features.json"
    if not feature_path.exists():
        return {}
    try:
        payload = json.loads(feature_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    result: dict[str, dict[str, Any]] = {}
    for item in payload.get("items", []) if isinstance(payload, dict) else []:
        if not isinstance(item, dict) or item.get("status") != 200:
            continue
        note_id = str(item.get("note_id") or "").strip()
        features = item.get("features")
        if note_id and isinstance(features, dict):
            result[note_id] = features
    return result


@lru_cache(maxsize=12)
def _load_hand_matched_note_ids(root_value: str, mtime_ns: int, skin_undertone: str, finger_shape: str) -> frozenset[str]:
    del mtime_ns
    if not skin_undertone or not finger_shape:
        return frozenset()

    root = Path(root_value)
    feature_path = root / "xhs_image_features.json"
    registry_path = root / "xhs_note_registry.json"
    if not feature_path.exists() or not registry_path.exists():
        return frozenset()

    registry_payload = json.loads(registry_path.read_text(encoding="utf-8"))
    registry_values = registry_payload.get("note_ids", registry_payload) if isinstance(registry_payload, dict) else registry_payload
    registry_ids = {str(item).strip() for item in registry_values if str(item).strip()} if isinstance(registry_values, list) else set()

    matched: set[str] = set()
    feature_payload = json.loads(feature_path.read_text(encoding="utf-8"))
    for item in feature_payload.get("items", []):
        if not isinstance(item, dict) or item.get("status") != 200:
            continue
        note_id = str(item.get("note_id") or "").strip()
        if not note_id or note_id not in registry_ids:
            continue
        hand = ((item.get("features") or {}).get("hand") or {})
        if hand.get("skin_undertone") == skin_undertone and hand.get("finger_shape") == finger_shape:
            matched.add(note_id)
    return frozenset(matched)


def _has_hot_intent(query: str) -> bool:
    return any(word in query for word in HOT_INTENT_WORDS)


def _is_color_only_query(query: str) -> bool:
    text = query.strip()
    if not text:
        return False
    for aliases in BASIC_COLOR_ALIASES.values():
        for alias in sorted(aliases, key=len, reverse=True):
            text = text.replace(alias, "")
    for token in (
        "给我",
        "帮我",
        "推荐",
        "找",
        "几款",
        "一些",
        "看看",
        "有没有",
        "美甲",
        "款式",
        "的",
        "一下",
        "下",
        "温柔",
        "显白",
        "日常",
        "通勤",
        "约会",
        "短甲",
        "长甲",
        "低调",
        "高级",
    ):
        text = text.replace(token, "")
    return not text.strip()


def _recommend_by_features(
    bundle: _EmbeddingBundle,
    query: str,
    limit: int,
    hand_features: dict[str, str] | None,
    allowed_note_ids: frozenset[str] | None,
    requested_colors: frozenset[str],
) -> list[AIHotXhsRecommendationItem]:
    ranked: list[dict[str, Any]] = []
    hot_intent = _has_hot_intent(query)
    feature_items = bundle.features_by_note_id.items()
    if not bundle.features_by_note_id:
        feature_items = (
            (
                str(metadata.get("note_id") or "").strip(),
                _features(metadata),
            )
            for metadata in bundle.metadata_by_row.values()
        )

    for note_id, features in feature_items:
        if not note_id or (allowed_note_ids is not None and note_id not in allowed_note_ids):
            continue
        note = bundle.digest_index.get(note_id)
        if not note or _is_foot_nail_note(note):
            continue
        nail_features = _nail_features(features)
        if not _nail_matches_colors(nail_features, requested_colors):
            continue
        image_url = _select_image_url(bundle.root, note)
        ranked.append(_ranked_feature_item(bundle, query, note_id, note, image_url, nail_features, hot_intent, hand_features, requested_colors))
    ranked = [item for item in ranked if item["image_url"]]
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return [_public_item(item) for item in ranked[:limit]]


def _ranked_feature_item(
    bundle: _EmbeddingBundle,
    query: str,
    note_id: str,
    note: dict[str, Any],
    image_url: str | None,
    nail_features: dict[str, Any],
    hot_intent: bool,
    hand_features: dict[str, str] | None,
    requested_colors: frozenset[str],
) -> dict[str, Any]:
    liked_count = _to_int(note.get("liked_count"))
    collected_count = _to_int(note.get("collected_count"))
    share_count = _to_int(note.get("share_count"))
    hot_score = _hot_score(liked_count, collected_count, share_count)
    tags = _tags(note)
    return {
        "note_id": note_id,
        "title": str(note.get("title") or "推荐美甲"),
        "image_url": image_url or "",
        "tags": tags,
        "score": hot_score,
        "liked_count": liked_count,
        "collected_count": collected_count,
        "share_count": share_count,
        "reason": _reason(query, hot_intent, hand_features, tags, liked_count, collected_count, share_count, nail_features, requested_colors),
        "nail_features": nail_features,
    }


def _features(metadata: dict[str, Any]) -> dict[str, Any]:
    features = metadata.get("features")
    return features if isinstance(features, dict) else {}


def _nail_features(features: dict[str, Any]) -> dict[str, Any]:
    nail = features.get("nail")
    return nail if isinstance(nail, dict) else {}


def _requested_colors(query: str, filters: dict[str, Any] | None) -> frozenset[str]:
    colors: set[str] = set()
    if isinstance(filters, dict):
        values = filters.get("colors")
        if isinstance(values, list):
            colors.update(_normalize_colors(values))
    colors.update(_colors_from_text(query))
    return frozenset(colors)


def _colors_from_text(text: str) -> set[str]:
    result: set[str] = set()
    for base_color, aliases in BASIC_COLOR_ALIASES.items():
        if any(alias and alias in text for alias in aliases):
            result.add(base_color)
    return result


def _normalize_colors(values: list[Any]) -> set[str]:
    result: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        if text in BASIC_COLOR_ALIASES:
            result.add(text)
            continue
        result.update(_colors_from_text(text))
    return result


def _feature_colors(nail_features: dict[str, Any]) -> set[str]:
    raw_colors = nail_features.get("colors") or nail_features.get("main_colors") or []
    if isinstance(raw_colors, str):
        raw_values = [raw_colors]
    elif isinstance(raw_colors, list):
        raw_values = raw_colors
    else:
        raw_values = []
    return _normalize_colors(raw_values)


def _nail_matches_colors(nail_features: dict[str, Any], requested_colors: frozenset[str]) -> bool:
    if not requested_colors:
        return True
    feature_colors = _feature_colors(nail_features)
    return bool(feature_colors and feature_colors.intersection(requested_colors))


def _color_filtered_note_ids(
    bundle: _EmbeddingBundle,
    requested_colors: frozenset[str],
    allowed_note_ids: frozenset[str] | None,
) -> frozenset[str] | None:
    if not requested_colors:
        return allowed_note_ids

    matched = frozenset(
        note_id for note_id, features in bundle.features_by_note_id.items() if _nail_matches_colors(_nail_features(features), requested_colors)
    )
    if not matched:
        return allowed_note_ids
    return matched if allowed_note_ids is None else allowed_note_ids.intersection(matched)


def _reason(
    query: str,
    hot_intent: bool,
    hand_features: dict[str, str] | None,
    tags: list[str],
    liked_count: int,
    collected_count: int,
    share_count: int,
    nail_features: dict[str, Any],
    requested_colors: frozenset[str],
) -> str:
    colors = [str(item) for item in nail_features.get("colors", []) if str(item).strip()] if isinstance(nail_features.get("colors"), list) else []
    finish = [str(item) for item in nail_features.get("finish", []) if str(item).strip()] if isinstance(nail_features.get("finish"), list) else []
    shape = str(nail_features.get("shape") or "").strip()
    length = str(nail_features.get("length") or "").strip()
    parts: list[str] = []
    matched_colors = [color for color in colors if color in requested_colors]
    if matched_colors:
        parts.append(f"含{'、'.join(matched_colors[:2])}色系，贴合你的颜色需求")
    elif colors:
        parts.append(f"{'、'.join(colors[:2])}色系层次比较丰富")
    if shape or length:
        parts.append(f"{shape}{length}甲型上手更完整".strip())
    if finish:
        parts.append(f"{'、'.join(finish[:2])}质感更有层次")
    if not parts and tags:
        parts.append(f"风格标签含{'、'.join(tags[:3])}")
    if not parts:
        parts.append(f"适合“{query.strip() or '美甲推荐'}”这个需求")
    if hand_features:
        parts.append("已匹配你的肤色倾向和手指形态")
    return "；".join(parts)


def _public_item(note: dict[str, Any]) -> AIHotXhsRecommendationItem:
    return AIHotXhsRecommendationItem(
        note_id=note["note_id"],
        title=note["title"],
        image_url=note["image_url"],
        tags=note["tags"],
        reason=note["reason"],
        score=round(float(note["score"]), 4),
        liked_count=int(note["liked_count"]),
        collected_count=int(note["collected_count"]),
        share_count=int(note["share_count"]),
        nail_features=note.get("nail_features") if isinstance(note.get("nail_features"), dict) else None,
    )
