from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.services.xhs_hot_recommendation_service import _assets_mtime, _load_ranked_notes


class XhsStyleMaterializationService:
    def ensure_top_styles(self, db: Session, limit: int = 200) -> int:
        settings = get_settings()
        root = settings.xhs_crawler_assets_path
        notes = _load_ranked_notes(str(root), _assets_mtime(root))[:limit]
        if not notes:
            return 0

        existing_note_ids = {
            str(metadata.get("xhs_note_id"))
            for metadata in (
                style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}
                for style in db.scalars(select(NailStyle).where(NailStyle.source_type == "xhs_note"))
            )
            if metadata.get("xhs_note_id")
        }

        created = 0
        for note in notes:
            note_id = str(note.get("note_id") or "").strip()
            image_url = str(note.get("image_url") or "").strip()
            if not note_id or not image_url or note_id in existing_note_ids:
                continue

            liked_count = int(note.get("liked_count") or 0)
            collected_count = int(note.get("collected_count") or 0)
            share_count = int(note.get("share_count") or 0)
            style = NailStyle(
                title=str(note.get("title") or "热门美甲"),
                description="来自小红书热门美甲数据",
                image_url=image_url,
                local_image_path=image_url,
                original_image_url=image_url,
                enhanced_image_url=image_url,
                source_type="xhs_note",
                nail_type="handmade",
                tags_json=list(note.get("tags") or []),
                dominant_colors_json=[],
                style_metadata_json={
                    "xhs_note_id": note_id,
                    "liked_count": liked_count,
                    "collected_count": collected_count,
                    "share_count": share_count,
                },
                popularity_score=float(note.get("score") or 0.0),
                is_trending=True,
            )
            db.add(style)
            existing_note_ids.add(note_id)
            created += 1

        if created:
            db.commit()
        return created

    def get_or_create_style(self, db: Session, note_id: str) -> NailStyle:
        normalized_note_id = note_id.strip()
        if not normalized_note_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="note_id is required")

        existing = self._find_existing_style(db, normalized_note_id)
        if existing is not None:
            return existing

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="推荐款式尚未导入，请先运行 XHS 导入脚本")

    def _find_existing_style(self, db: Session, note_id: str) -> NailStyle | None:
        for style in db.scalars(select(NailStyle).where(NailStyle.source_type == "xhs_note")):
            metadata = style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}
            if metadata.get("xhs_note_id") == note_id:
                return style
        return None
