from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserPost(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_posts"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shop_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("merchant_shops.id", ondelete="SET NULL"), nullable=True)
    verified_booking_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    local_image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    nail_type: Mapped[str] = mapped_column(String(20), default="press_on", nullable=False)
    tags_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="user_upload", nullable=False)
    source_external_id: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    source_metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)

    user = relationship("User", back_populates="posts")
    shop = relationship("MerchantShop", back_populates="posts")
    verified_booking = relationship("Booking", foreign_keys=[verified_booking_id])
