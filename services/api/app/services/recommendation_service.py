from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.schemas.ai import AIRecommendItem, AIRecommendResponse


KEYWORD_TAGS: dict[str, list[str]] = {
    "黄皮": ["显白", "裸粉", "奶白", "暖调"],
    "显白": ["显白", "裸粉", "奶白"],
    "温柔": ["温柔", "裸透", "通勤"],
    "裸粉": ["裸粉"],
    "法式": ["法式"],
    "通勤": ["通勤", "短甲"],
    "约会": ["约会", "猫眼"],
    "猫眼": ["猫眼"],
    "节日": ["节日", "贴钻"],
    "裸透": ["裸透"],
}


class RecommendationService:
    def recommend(self, db: Session, query_text: str, limit: int = 5) -> AIRecommendResponse:
        settings = get_settings()
        styles = list(db.scalars(select(NailStyle)))
        query_lower = query_text.lower()
        matched_tags: set[str] = set()
        for keyword, tags in KEYWORD_TAGS.items():
            if keyword.lower() in query_lower:
                matched_tags.update(tags)

        wants_hot = any(keyword in query_text for keyword in settings.hot_keywords)
        ranked: list[tuple[float, NailStyle, list[str]]] = []
        for style in styles:
            tags = set(style.tags_json or [])
            metadata = style.style_metadata_json or {}
            tags.update(metadata.get("occasion_tags", []))
            tags.update(metadata.get("color_tags", []))
            matched = sorted(matched_tags.intersection(tags))
            score = 0.0
            if wants_hot:
                score += 2.5 if style.is_trending else 0.5
            score += len(matched) * 1.7
            score += style.popularity_score * 0.05
            if score > 0:
                ranked.append((score, style, matched))

        ranked.sort(key=lambda item: (item[0], item[1].is_trending, item[1].popularity_score), reverse=True)
        selected: list[tuple[float, NailStyle, list[str]]] = ranked[:limit]
        if len(selected) < limit:
            used_ids = {style.id for _, style, _ in selected}
            fallback_candidates = sorted(
                (style for style in styles if style.id not in used_ids),
                key=lambda style: (style.is_trending, style.popularity_score, style.created_at),
                reverse=True,
            )
            for style in fallback_candidates[: limit - len(selected)]:
                selected.append((max(style.popularity_score * 0.03, 0.2), style, []))

        items = [
            AIRecommendItem(
                style_id=style.id,
                title=style.title,
                image_url=style.image_url,
                tags=style.tags_json or [],
                reason=self._build_reason(query_text, matched, style.is_trending),
                score=round(score, 2),
            )
            for score, style, matched in selected
        ]
        return AIRecommendResponse(request_id=str(uuid4()), items=items)

    @staticmethod
    def _build_reason(query_text: str, matched: list[str], is_trending: bool) -> str:
        if matched:
            return f"匹配到 {', '.join(matched)}，与“{query_text}”高度相关"
        if is_trending:
            return "当前处于热门趋势，适合作为兜底推荐"
        return "来自真实图库，按热度和上新时间补齐推荐"
