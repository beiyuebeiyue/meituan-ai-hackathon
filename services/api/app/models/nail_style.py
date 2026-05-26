from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class NailStyle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "nail_styles"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    shop_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("merchant_shops.id", ondelete="SET NULL"), nullable=True)
    verified_booking_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="SET NULL", use_alter=True, name="fk_nail_styles_verified_booking_id"),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    local_image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    original_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    enhanced_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), default="seed_xlsx", nullable=False)
    nail_type: Mapped[str] = mapped_column(String(20), default="press_on", nullable=False)
    tags_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    dominant_colors_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    style_metadata_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    popularity_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_trending: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    shop = relationship("MerchantShop", back_populates="styles")
    verified_booking = relationship("Booking", foreign_keys=[verified_booking_id])
    favorites = relationship("UserFavorite", back_populates="style", cascade="all, delete-orphan")
    likes = relationship("UserStyleLike", back_populates="style", cascade="all, delete-orphan")
    views = relationship("UserStyleView", back_populates="style", cascade="all, delete-orphan")
    comments = relationship("StyleComment", back_populates="style", cascade="all, delete-orphan")
    tryon_jobs = relationship("TryOnJob", back_populates="style", cascade="all, delete-orphan")
    daily_events = relationship("StyleEventDaily", back_populates="style", cascade="all, delete-orphan")
