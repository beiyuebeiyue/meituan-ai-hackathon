from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.models.style_event_daily import StyleEventDaily
from app.schemas.events import StyleEventInput


EVENT_FIELD_MAP = {
    "impression": "impressions",
    "click": "clicks",
    "favorite": "favorites",
    "tryon": "tryons",
    "publish": "publishes",
}

VALID_SOURCES = {"browse_hot", "browse_latest", "ask_ai", "post_feed", "profile"}
EVENT_WEIGHTS = {"impression": 0.1, "click": 0.7, "favorite": 1.5, "tryon": 2.0, "publish": 1.2}


class EventService:
    def record_style_events(self, db: Session, items: list[StyleEventInput]) -> list[StyleEventDaily]:
        settings = get_settings()
        stat_date = datetime.now(ZoneInfo(settings.ops_report_timezone)).date()
        updated: list[StyleEventDaily] = []
        for item in items:
            if item.event_type not in EVENT_FIELD_MAP:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的事件类型")
            if item.source not in VALID_SOURCES:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的来源")

            style = db.get(NailStyle, item.style_id)
            if style is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="款式不存在")

            daily = db.scalar(
                select(StyleEventDaily).where(
                    StyleEventDaily.style_id == item.style_id,
                    StyleEventDaily.stat_date == stat_date,
                )
            )
            if daily is None:
                daily = StyleEventDaily(style_id=item.style_id, stat_date=stat_date)
                db.add(daily)
                db.flush()

            field_name = EVENT_FIELD_MAP[item.event_type]
            setattr(daily, field_name, getattr(daily, field_name) + item.count)
            daily.ctr = daily.clicks / daily.impressions if daily.impressions else 0.0

            style.popularity_score += EVENT_WEIGHTS[item.event_type] * item.count
            if style.popularity_score >= 18:
                style.is_trending = True
            db.add(style)
            db.add(daily)
            updated.append(daily)

        db.commit()
        for row in updated:
            db.refresh(row)
        return updated
