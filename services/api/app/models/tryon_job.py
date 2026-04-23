from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TryOnJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tryon_jobs"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source_hand_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hand_image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    selected_style_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nail_styles.id", ondelete="CASCADE"),
        nullable=False,
    )
    prompt_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    result_image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    result_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", back_populates="tryon_jobs")
    style = relationship("NailStyle", back_populates="tryon_jobs")
