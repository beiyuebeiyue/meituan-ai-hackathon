from __future__ import annotations

from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserPost(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_posts"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    local_image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    tags_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    user = relationship("User", back_populates="posts")
