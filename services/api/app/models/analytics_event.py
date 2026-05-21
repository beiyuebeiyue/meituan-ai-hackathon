from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.mixins import UUIDPrimaryKeyMixin, utcnow
from app.core.db import Base


class AnalyticsEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "analytics_events"
    __table_args__ = (UniqueConstraint("event_id", name="uq_analytics_events_event_id"),)

    event_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    event_name: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    anonymous_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    style_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("nail_styles.id", ondelete="SET NULL"), nullable=True, index=True)
    tryon_job_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("tryon_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    booking_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True)
    shop_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("merchant_shops.id", ondelete="SET NULL"), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    screen: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    amount_cents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    properties_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class AnalyticsIdentityLink(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "analytics_identity_links"
    __table_args__ = (UniqueConstraint("anonymous_id", "user_id", name="uq_analytics_identity_link"),)

    anonymous_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
