from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserStyleLike(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_style_likes"
    __table_args__ = (UniqueConstraint("user_id", "nail_style_id", name="uq_user_style_like"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nail_style_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nail_styles.id", ondelete="CASCADE"),
        nullable=False,
    )

    user = relationship("User", back_populates="style_likes")
    style = relationship("NailStyle", back_populates="likes")
