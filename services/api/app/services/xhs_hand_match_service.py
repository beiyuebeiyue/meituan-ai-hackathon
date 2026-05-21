from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.schemas.ai import AIHotXhsRecommendationItem
from app.services.xhs_hot_recommendation_service import _is_foot_nail_note, _select_image_url, _tags, _to_int


class XhsHandMatchService:
    def recommend(self, query: str, hand_features: dict[str, str], limit: int = 5, pool_size: int = 50) -> list[AIHotXhsRecommendationItem]:
        root = get_settings().xhs_crawler_assets_path
        candidates = _load_hand_matched_notes(str(root), _assets_mtime(root), hand_features.get("skin_undertone", ""), hand_features.get("finger_shape", ""))
        return self.rerank_nail_candidates(query, hand_features, list(candidates[:pool_size]), limit)

    def rerank_nail_candidates(
        self,
        query: str,
        hand_features: dict[str, str],
        candidates: list[dict[str, Any]],
        limit: int = 5,
    ) -> list[AIHotXhsRecommendationItem]:
        del query, hand_features
        return [_public_item(item) for item in candidates[:limit]]


def _assets_mtime(root: Path) -> int:
    paths = [
        root / "xhs_image_features.json",
        root / "xhs_note_registry.json",
        *root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json"),
    ]
    return max((path.stat().st_mtime_ns for path in paths if path.exists()), default=0)


@lru_cache(maxsize=12)
def _load_hand_matched_notes(root_value: str, mtime_ns: int, skin_undertone: str, finger_shape: str) -> tuple[dict[str, Any], ...]:
    del mtime_ns
    if not skin_undertone or not finger_shape:
        return ()

    root = Path(root_value)
    feature_path = root / "xhs_image_features.json"
    if not feature_path.exists():
        return ()

    digest_index = _build_digest_index(root)
    registry_ids = _registry_ids(root)
    feature_payload = json.loads(feature_path.read_text(encoding="utf-8"))
    ranked: list[dict[str, Any]] = []
    for item in feature_payload.get("items", []):
        if not isinstance(item, dict) or item.get("status") != 200:
            continue
        note_id = str(item.get("note_id") or "").strip()
        if not note_id or note_id not in registry_ids:
            continue
        hand = ((item.get("features") or {}).get("hand") or {})
        if hand.get("skin_undertone") != skin_undertone or hand.get("finger_shape") != finger_shape:
            continue

        note = digest_index.get(note_id)
        if not note or _is_foot_nail_note(note):
            continue
        image_url = _select_image_url(root, note)
        if not image_url:
            continue
        liked_count = _to_int(note.get("liked_count"))
        collected_count = _to_int(note.get("collected_count"))
        share_count = _to_int(note.get("share_count"))
        ranked.append(
            {
                "note_id": note_id,
                "title": str(note.get("title") or "适合你的美甲"),
                "image_url": image_url,
                "tags": _tags(note),
                "score": _hot_score(liked_count, collected_count, share_count),
                "liked_count": liked_count,
                "collected_count": collected_count,
                "share_count": share_count,
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return tuple(ranked)


def _registry_ids(root: Path) -> set[str]:
    registry_path = root / "xhs_note_registry.json"
    if not registry_path.exists():
        return set()
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    values = payload.get("note_ids", payload) if isinstance(payload, dict) else payload
    if not isinstance(values, list):
        return set()
    return {str(item).strip() for item in values if str(item).strip()}


def _build_digest_index(root: Path) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for digest_path in sorted(root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json")):
        payload = json.loads(digest_path.read_text(encoding="utf-8"))
        notes = payload.get("notes", payload) if isinstance(payload, dict) else payload
        if not isinstance(notes, list):
            continue
        for note in notes:
            if not isinstance(note, dict):
                continue
            note_id = str(note.get("note_id") or note.get("id") or "").strip()
            if note_id:
                index[note_id] = note
    return index


def _hot_score(liked_count: int, collected_count: int, share_count: int) -> float:
    return math.log1p(liked_count) * 1.0 + math.log1p(collected_count) * 1.2 + math.log1p(share_count) * 1.5


def _public_item(note: dict[str, Any]) -> AIHotXhsRecommendationItem:
    return AIHotXhsRecommendationItem(
        note_id=note["note_id"],
        title=note["title"],
        image_url=note["image_url"],
        tags=note["tags"],
        reason="根据你的手部肤色倾向和手指形态粗筛匹配",
        score=round(float(note["score"]), 3),
        liked_count=int(note["liked_count"]),
        collected_count=int(note["collected_count"]),
        share_count=int(note["share_count"]),
    )
