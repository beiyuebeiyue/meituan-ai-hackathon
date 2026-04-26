from __future__ import annotations

from sqlalchemy import Float, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ImageProcessingArtifact(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "image_processing_artifacts"
    __table_args__ = (
        UniqueConstraint(
            "image_sha256",
            "image_role",
            "pipeline_version",
            "provider_config_hash",
            name="uq_image_processing_artifact_cache",
        ),
    )

    image_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    image_role: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    pipeline_version: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    provider_config_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False, index=True)
    landmarks_json: Mapped[list[dict[str, float]]] = mapped_column(JSON, default=list, nullable=False)
    roi_boxes_json: Mapped[list[dict[str, int]]] = mapped_column(JSON, default=list, nullable=False)
    mask_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    mask_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cutout_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cutout_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
