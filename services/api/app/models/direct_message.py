from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class DirectMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "direct_messages"

    sender_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    local_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    shared_style_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("nail_styles.id", ondelete="SET NULL"), nullable=True)
    booking_invite_shop_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("merchant_shops.id", ondelete="SET NULL"),
        nullable=True,
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sender = relationship("User", foreign_keys=[sender_user_id], back_populates="sent_messages")
    recipient = relationship("User", foreign_keys=[recipient_user_id], back_populates="received_messages")
    shared_style = relationship("NailStyle", foreign_keys=[shared_style_id])
    booking_invite_shop = relationship("MerchantShop", foreign_keys=[booking_invite_shop_id])
