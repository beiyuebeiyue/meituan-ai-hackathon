from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class MerchantTrendClaim(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "merchant_trend_claims"
    __table_args__ = (UniqueConstraint("shop_id", "style_id", name="uq_merchant_trend_claim_shop_style"),)

    merchant_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchant_shops.id", ondelete="CASCADE"), nullable=False, index=True)
    style_id: Mapped[str] = mapped_column(String(36), ForeignKey("nail_styles.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("trend_nail_campaigns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    merchant = relationship("User")
    shop = relationship("MerchantShop")
    style = relationship("NailStyle")
    campaign = relationship("TrendNailCampaign", back_populates="claims")


class MerchantNotification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "merchant_notifications"

    merchant_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("trend_nail_campaigns.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(String(40), default="trend_nails", nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="", nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    merchant = relationship("User")
    campaign = relationship("TrendNailCampaign", back_populates="notifications")
