from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    uid: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    birthday: Mapped[str | None] = mapped_column(String(20), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location_city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    show_following_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_followers_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_comments_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_likes_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    browse_histories = relationship("UserBrowseHistory", back_populates="user", cascade="all, delete-orphan")
    favorites = relationship("UserFavorite", back_populates="user", cascade="all, delete-orphan")
    style_likes = relationship("UserStyleLike", back_populates="user", cascade="all, delete-orphan")
    style_views = relationship("UserStyleView", back_populates="user", cascade="all, delete-orphan")
    following_relations = relationship(
        "UserFollow",
        foreign_keys="UserFollow.follower_user_id",
        back_populates="follower",
        cascade="all, delete-orphan",
    )
    follower_relations = relationship(
        "UserFollow",
        foreign_keys="UserFollow.followed_user_id",
        back_populates="followed",
        cascade="all, delete-orphan",
    )
    blocks_initiated = relationship(
        "UserBlock",
        foreign_keys="UserBlock.blocker_user_id",
        back_populates="blocker",
        cascade="all, delete-orphan",
    )
    blocks_received = relationship(
        "UserBlock",
        foreign_keys="UserBlock.blocked_user_id",
        back_populates="blocked",
        cascade="all, delete-orphan",
    )
    sent_messages = relationship(
        "DirectMessage",
        foreign_keys="DirectMessage.sender_user_id",
        back_populates="sender",
        cascade="all, delete-orphan",
    )
    received_messages = relationship(
        "DirectMessage",
        foreign_keys="DirectMessage.recipient_user_id",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )
    posts = relationship("UserPost", back_populates="user", cascade="all, delete-orphan")
    hand_photos = relationship("UserHandPhoto", back_populates="user", cascade="all, delete-orphan")
    style_comments = relationship("StyleComment", back_populates="user", cascade="all, delete-orphan")
    tryon_jobs = relationship("TryOnJob", back_populates="user", cascade="all, delete-orphan")
