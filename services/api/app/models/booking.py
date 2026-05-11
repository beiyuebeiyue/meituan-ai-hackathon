from __future__ import annotations

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Booking(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bookings"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    merchant_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchant_shops.id", ondelete="CASCADE"), nullable=False, index=True)
    style_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("nail_styles.id", ondelete="SET NULL"), nullable=True, index=True)
    appointment_time: Mapped[str] = mapped_column(String(80), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(40), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, default=10_000, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="bookings")
    merchant = relationship("User", foreign_keys=[merchant_user_id], back_populates="merchant_bookings")
    shop = relationship("MerchantShop", back_populates="bookings")
    style = relationship("NailStyle", foreign_keys=[style_id])
