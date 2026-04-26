from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserBlock(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_blocks"
    __table_args__ = (UniqueConstraint("blocker_user_id", "blocked_user_id", name="uq_user_block_pair"),)

    blocker_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    blocker = relationship("User", foreign_keys=[blocker_user_id], back_populates="blocks_initiated")
    blocked = relationship("User", foreign_keys=[blocked_user_id], back_populates="blocks_received")
