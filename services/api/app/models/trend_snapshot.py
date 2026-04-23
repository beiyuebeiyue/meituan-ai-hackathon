from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TrendSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trend_snapshots"

    source_name: Mapped[str] = mapped_column(String(100), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    raw_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    payload_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
