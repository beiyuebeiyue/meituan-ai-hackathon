from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings


STYLE_KEYWORDS = [
    "显白",
    "通勤",
    "短甲",
    "长甲",
    "猫眼",
    "法式",
    "裸粉",
    "裸色",
    "奶白",
    "温柔",
    "约会",
    "纯色",
    "极简",
    "清透",
    "氛围感",
    "本甲",
    "海莉",
    "魔镜粉",
    "贴钻",
    "亮片",
    "手绘",
    "花朵",
    "粉色",
    "蓝色",
    "红色",
    "绿色",
    "银色",
    "白色",
    "黑色",
    "黄皮",
    "黄黑皮",
]

QUERY_EXPANSIONS = {
    "上班": ["通勤", "裸粉", "裸色", "极简"],
    "工作": ["通勤", "裸粉", "裸色", "极简"],
    "日常": ["通勤", "温柔", "极简"],
    "约会": ["约会", "温柔", "猫眼"],
    "黄黑皮": ["黄皮", "显白", "奶白"],
    "黄皮": ["显白", "奶白", "裸粉"],
    "夏天": ["清透", "蓝色", "奶白"],
    "春夏": ["清透", "粉色", "奶白"],
}


class NailRagService:
    def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        root = get_settings().nail_rag_path
        notes = _load_notes(str(root), _notes_mtime(root))
        terms = _query_terms(query)
        if not terms and not _is_general_recommendation(query):
            return []

        ranked: list[tuple[float, dict[str, Any]]] = []
        for note in notes:
            score = _score_note(note, terms)
            if score > 0:
                ranked.append((score, note))

        if not ranked and _is_general_recommendation(query):
            ranked = [(float(note["engagement"]), note) for note in notes]

        ranked.sort(key=lambda item: (item[0], item[1]["engagement"]), reverse=True)
        return [_public_note(note, score) for score, note in ranked[:limit]]


def _notes_mtime(root: Path) -> int:
    path = root / "notes.json"
    return path.stat().st_mtime_ns if path.exists() else 0


@lru_cache(maxsize=8)
def _load_notes(root: str, mtime_ns: int) -> tuple[dict[str, Any], ...]:
    del mtime_ns
    path = Path(root) / "notes.json"
    if not path.exists():
        return ()

    raw_notes = json.loads(path.read_text(encoding="utf-8"))
    notes: list[dict[str, Any]] = []
    for raw in raw_notes:
        tags = [str(tag) for tag in raw.get("tags", []) if tag]
        text = "\n".join(
            str(value)
            for value in [
                raw.get("title", ""),
                " ".join(tags),
                raw.get("caption", ""),
                raw.get("desc", ""),
                raw.get("retrieval_text", ""),
            ]
            if value
        )
        liked_count = _to_int(raw.get("liked_count"))
        collected_count = _to_int(raw.get("collected_count"))
        share_count = _to_int(raw.get("share_count"))
        notes.append(
            {
                "note_id": str(raw.get("note_id", "")),
                "title": str(raw.get("title", "")),
                "author": str(raw.get("author", "")),
                "tags": tags[:12],
                "caption": str(raw.get("caption", "")),
                "publish_time": str(raw.get("publish_time", "")),
                "liked_count": liked_count,
                "collected_count": collected_count,
                "share_count": share_count,
                "image_urls": raw.get("image_urls", [])[:3],
                "local_image_paths": raw.get("local_image_paths", [])[:3],
                "engagement": liked_count + collected_count + share_count,
                "search_text": text.lower(),
            }
        )
    return tuple(notes)


def _query_terms(query: str) -> set[str]:
    terms = set(re.findall(r"[a-zA-Z0-9]+", query.lower()))
    for keyword in STYLE_KEYWORDS:
        if keyword in query:
            terms.add(keyword)
    for trigger, expanded_terms in QUERY_EXPANSIONS.items():
        if trigger in query:
            terms.update(expanded_terms)
    return {term for term in terms if len(term) >= 2}


def _is_general_recommendation(query: str) -> bool:
    return any(word in query for word in ["推荐", "挑", "款式", "美甲", "热门"])


def _score_note(note: dict[str, Any], terms: set[str]) -> float:
    if not terms:
        return 0.0

    search_text = str(note["search_text"])
    title = str(note["title"]).lower()
    tags = [str(tag).lower() for tag in note["tags"]]
    score = 0.0
    for term in terms:
        lowered = term.lower()
        if lowered in tags:
            score += 5.0
        elif any(lowered in tag or tag in lowered for tag in tags):
            score += 3.0
        if lowered in title:
            score += 3.0
        if lowered in search_text:
            score += 1.5

    if score > 0:
        score += min(math.log1p(int(note["engagement"])), 12.0) * 0.08
    return score


def _public_note(note: dict[str, Any], score: float) -> dict[str, Any]:
    return {
        "note_id": note["note_id"],
        "title": note["title"],
        "author": note["author"],
        "tags": note["tags"],
        "caption": note["caption"],
        "publish_time": note["publish_time"],
        "liked_count": note["liked_count"],
        "collected_count": note["collected_count"],
        "share_count": note["share_count"],
        "image_urls": note["image_urls"],
        "local_image_paths": note["local_image_paths"],
        "score": round(score, 3),
    }


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
