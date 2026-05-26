from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.services.xhs_hot_recommendation_service import _build_digest_index, _select_image_url, _tags, _to_int
from app.utils.files import relative_to_base


class XhsStyleMaterializationService:
    def get_or_create_style(self, db: Session, note_id: str) -> NailStyle:
        normalized_note_id = note_id.strip()
        if not normalized_note_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="note_id is required")

        existing = self._find_existing_style(db, normalized_note_id)
        if existing is not None:
            return existing

        root = get_settings().xhs_crawler_assets_path
        note = _build_digest_index(root).get(normalized_note_id)
        if note is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推荐款式不存在")

        image_url = _select_image_url(root, note)
        image_path = self._local_path_for_image_url(root, image_url)
        if image_path is None or not image_path.exists():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="该推荐款没有可用于焕甲的本地标准图")

        liked_count = _to_int(note.get("liked_count"))
        collected_count = _to_int(note.get("collected_count"))
        share_count = _to_int(note.get("share_count"))
        style = NailStyle(
            title=str(note.get("title") or "小红书推荐美甲")[:200],
            description=str(note.get("desc") or note.get("caption") or ""),
            image_url=image_url,
            local_image_path=relative_to_base(image_path),
            original_image_url=image_url,
            enhanced_image_url=image_url,
            source_type="xhs_note",
            nail_type="press_on",
            tags_json=_tags(note),
            dominant_colors_json=[],
            style_metadata_json={
                "xhs_note_id": normalized_note_id,
                "author_user_id": "xhs_external",
                "liked_count": liked_count,
                "collected_count": collected_count,
                "share_count": share_count,
            },
            popularity_score=float(liked_count + collected_count * 1.2 + share_count * 1.5),
            is_trending=True,
        )
        db.add(style)
        db.commit()
        db.refresh(style)
        return style

    def _find_existing_style(self, db: Session, note_id: str) -> NailStyle | None:
        for style in db.scalars(select(NailStyle).where(NailStyle.source_type == "xhs_note")):
            metadata = style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}
            if metadata.get("xhs_note_id") == note_id:
                return style
        return None

    def _local_path_for_image_url(self, root: Path, image_url: str) -> Path | None:
        if not image_url.startswith("/openclaw-assets/"):
            return None
        relative_path = image_url.removeprefix("/openclaw-assets/")
        return (root / relative_path).resolve()
