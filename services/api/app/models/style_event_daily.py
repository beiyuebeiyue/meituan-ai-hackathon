from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import UUIDPrimaryKeyMixin


def created_now() -> datetime:
    return datetime.now(timezone.utc)


class StyleEventDaily(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "style_events_daily"
    __table_args__ = (UniqueConstraint("style_id", "stat_date", name="uq_style_daily"),)

    style_id: Mapped[str] = mapped_column(String(36), ForeignKey("nail_styles.id", ondelete="CASCADE"), nullable=False)
    stat_date: Mapped[date] = mapped_column(Date, nullable=False)
    impressions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clicks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    favorites: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tryons: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    publishes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ctr: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=created_now, nullable=False)

    style = relationship("NailStyle", back_populates="daily_events")
