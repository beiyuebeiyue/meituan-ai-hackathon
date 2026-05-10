from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class OpsCouponGrant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ops_coupon_grants"

    target_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    coupon_name: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_by: Mapped[str] = mapped_column(String(80), default="admin", nullable=False)
