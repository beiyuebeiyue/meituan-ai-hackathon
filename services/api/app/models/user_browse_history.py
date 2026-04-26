from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserBrowseHistory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_browse_histories"
    __table_args__ = (UniqueConstraint("user_id", "nail_style_id", name="uq_user_browse_history_style"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nail_style_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nail_styles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user = relationship("User", back_populates="browse_histories")
    style = relationship("NailStyle")
