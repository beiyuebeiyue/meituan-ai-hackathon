from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class StyleComment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "style_comments"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nail_style_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nail_styles.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

    user = relationship("User", back_populates="style_comments")
    style = relationship("NailStyle", back_populates="comments")
