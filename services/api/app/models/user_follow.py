from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserFollow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_follows"
    __table_args__ = (UniqueConstraint("follower_user_id", "followed_user_id", name="uq_user_follow_pair"),)

    follower_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    followed_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    follower = relationship("User", foreign_keys=[follower_user_id], back_populates="following_relations")
    followed = relationship("User", foreign_keys=[followed_user_id], back_populates="follower_relations")
