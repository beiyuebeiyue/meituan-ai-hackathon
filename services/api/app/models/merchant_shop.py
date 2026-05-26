from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class MerchantShop(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "merchant_shops"
    __table_args__ = (UniqueConstraint("merchant_user_id", name="uq_merchant_shops_merchant_user_id"),)

    merchant_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str] = mapped_column(String(80), default="深圳", nullable=False, index=True)
    address: Mapped[str] = mapped_column(Text, default="", nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    merchant = relationship("User", back_populates="merchant_shops")
    posts = relationship("UserPost", back_populates="shop")
    styles = relationship("NailStyle", back_populates="shop")
    bookings = relationship("Booking", back_populates="shop")
