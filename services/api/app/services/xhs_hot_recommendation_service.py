from __future__ import annotations

import json
import math
import random
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.schemas.ai import AIHotXhsRecommendationItem


GENERAL_RECOMMENDATION_WORDS = ("推荐", "挑", "款式", "美甲", "热门", "流行", "爆款")
FOOT_NAIL_WORDS = ("足", "脚")


class XhsHotRecommendationService:
    def should_recommend(self, query: str) -> bool:
        return any(word in query for word in GENERAL_RECOMMENDATION_WORDS)

    def recommend(self, query: str, limit: int = 5, pool_size: int = 20) -> list[AIHotXhsRecommendationItem]:
        if not self.should_recommend(query):
            return []

        root = get_settings().xhs_crawler_assets_path
        notes = _load_ranked_notes(str(root), _assets_mtime(root))
        pool = notes[:pool_size]
        if not pool:
            return []

        selected = random.sample(pool, k=min(limit, len(pool)))
        return [_public_item(note) for note in selected]


def _assets_mtime(root: Path) -> int:
    registry = root / "xhs_note_registry.json"
    if not registry.exists():
        return 0
    digest_mtimes = [path.stat().st_mtime_ns for path in root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json")]
    return max([registry.stat().st_mtime_ns, *digest_mtimes], default=0)


@lru_cache(maxsize=4)
def _load_ranked_notes(root_value: str, mtime_ns: int) -> tuple[dict[str, Any], ...]:
    del mtime_ns
    root = Path(root_value)
    registry_path = root / "xhs_note_registry.json"
    if not registry_path.exists():
        return ()

    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    registry_ids = registry.get("note_ids", registry) if isinstance(registry, dict) else registry
    note_ids = [str(item).strip() for item in registry_ids if str(item).strip()]
    digest_index = _build_digest_index(root)

    ranked: list[dict[str, Any]] = []
    for note_id in note_ids:
        note = digest_index.get(note_id)
        if not note:
            continue
        if _is_foot_nail_note(note):
            continue
        image_url = _select_image_url(root, note)
        if not image_url:
            continue
        liked_count = _to_int(note.get("liked_count"))
        collected_count = _to_int(note.get("collected_count"))
        share_count = _to_int(note.get("share_count"))
        score = _hot_score(liked_count, collected_count, share_count)
        ranked.append(
            {
                "note_id": note_id,
                "title": str(note.get("title") or "热门美甲"),
                "image_url": image_url,
                "tags": _tags(note),
                "score": score,
                "liked_count": liked_count,
                "collected_count": collected_count,
                "share_count": share_count,
            }
        )

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return tuple(ranked)


def _build_digest_index(root: Path) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for digest_path in sorted(root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json")):
        payload = json.loads(digest_path.read_text(encoding="utf-8"))
        notes = payload.get("notes", payload) if isinstance(payload, dict) else payload
        if not isinstance(notes, list):
            continue
        digest_date = digest_path.parent.name
        for note in notes:
            if not isinstance(note, dict):
                continue
            note_id = str(note.get("note_id") or note.get("id") or "").strip()
            if note_id:
                indexed_note = dict(note)
                indexed_note["_digest_date"] = digest_date
                index[note_id] = indexed_note
    return index


def _select_image_url(root: Path, note: dict[str, Any]) -> str:
    candidates = [note.get("standard_nail_image"), *(note.get("image_list") or [])]
    for value in candidates:
        if not value:
            continue
        text = str(value)
        if text.startswith(("http://", "https://", "/")):
            return text
        paths = [root / text.removeprefix("assets/")] if text.startswith("assets/") else [root / text]
        if text.startswith("assets/"):
            paths.append(root.parent / text)
        for path in paths:
            if not path.exists():
                continue
            try:
                rel = path.resolve().relative_to(root.resolve()).as_posix()
            except ValueError:
                continue
            return f"/openclaw-assets/{rel}"
    return ""


def _tags(note: dict[str, Any]) -> list[str]:
    raw_tags = note.get("tag_list") or note.get("tags") or []
    if not isinstance(raw_tags, list):
        return []
    return [str(tag).strip().lstrip("#") for tag in raw_tags if str(tag).strip()][:6]


def _is_foot_nail_note(note: dict[str, Any]) -> bool:
    text_parts = [note.get("title"), note.get("desc"), note.get("caption")]
    text_parts.extend(_tags(note))
    text = " ".join(str(part).lower() for part in text_parts if part)
    return any(word in text for word in FOOT_NAIL_WORDS)


def _hot_score(liked_count: int, collected_count: int, share_count: int) -> float:
    return math.log1p(liked_count) * 1.0 + math.log1p(collected_count) * 1.2 + math.log1p(share_count) * 1.5


def _public_item(note: dict[str, Any]) -> AIHotXhsRecommendationItem:
    return AIHotXhsRecommendationItem(
        note_id=note["note_id"],
        title=note["title"],
        image_url=note["image_url"],
        tags=note["tags"],
        reason="来自小红书热门美甲，按点赞、收藏和转发热度筛选",
        score=round(float(note["score"]), 3),
        liked_count=int(note["liked_count"]),
        collected_count=int(note["collected_count"]),
        share_count=int(note["share_count"]),
    )


def _to_int(value: object) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        text = value.strip()
        if text.endswith("万"):
            return int(float(text[:-1]) * 10000)
        if text.isdigit():
            return int(text)
    return 0
