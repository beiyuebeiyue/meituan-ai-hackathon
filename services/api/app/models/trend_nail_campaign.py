from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TrendNailCampaign(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trend_nail_campaigns"

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="sent", nullable=False)
    created_by: Mapped[str] = mapped_column(String(120), default="ops", nullable=False)

    styles = relationship("TrendNailCampaignStyle", back_populates="campaign", cascade="all, delete-orphan")
    notifications = relationship("MerchantNotification", back_populates="campaign", cascade="all, delete-orphan")
    claims = relationship("MerchantTrendClaim", back_populates="campaign")


class TrendNailCampaignStyle(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "trend_nail_campaign_styles"
    __table_args__ = (UniqueConstraint("campaign_id", "style_id", name="uq_trend_campaign_style"),)

    campaign_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("trend_nail_campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    style_id: Mapped[str] = mapped_column(String(36), ForeignKey("nail_styles.id", ondelete="CASCADE"), nullable=False, index=True)

    campaign = relationship("TrendNailCampaign", back_populates="styles")
    style = relationship("NailStyle")
