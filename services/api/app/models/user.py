from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(80), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    favorites = relationship("UserFavorite", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("UserPost", back_populates="user", cascade="all, delete-orphan")
    hand_photos = relationship("UserHandPhoto", back_populates="user", cascade="all, delete-orphan")
    tryon_jobs = relationship("TryOnJob", back_populates="user", cascade="all, delete-orphan")
