from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.image_processing_artifact import ImageProcessingArtifact
from app.providers.hand_landmarker_provider import HandDetectionResult
from app.providers.nail_segmentation_provider import SegmentationResult
from app.utils.files import hash_file_sha256, public_url_for_path, relative_to_base, resolve_local_path


class ImageProcessingArtifactService:
    @property
    def settings(self):
        return get_settings()

    def provider_config_hash(self) -> str:
        if self.settings.image_provider_config_hash:
            return self.settings.image_provider_config_hash
        raw = "|".join(
            [
                self.settings.image_pipeline_version,
                self.settings.remote_gpu_tryon_url,
                self.settings.openai_image_model,
                "yolo",
                "nail_yolo26",
                str(self.settings.nail_yolo_imgsz),
                str(self.settings.nail_yolo_confidence),
            ]
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get_or_create(self, db: Session, image_path: Path, image_role: str) -> ImageProcessingArtifact:
        image_sha256 = hash_file_sha256(image_path)
        existing = self.get_existing_for_hash(db, image_sha256, image_role)
        if existing is not None:
            return existing

        artifact = ImageProcessingArtifact(
            image_sha256=image_sha256,
            image_role=image_role,
            pipeline_version=self.settings.image_pipeline_version,
            provider_config_hash=self.provider_config_hash(),
            status="pending",
        )
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact

    def get_existing_for_hash(self, db: Session, image_sha256: str, image_role: str) -> ImageProcessingArtifact | None:
        statement = select(ImageProcessingArtifact).where(
            ImageProcessingArtifact.image_sha256 == image_sha256,
            ImageProcessingArtifact.image_role == image_role,
            ImageProcessingArtifact.pipeline_version == self.settings.image_pipeline_version,
            ImageProcessingArtifact.provider_config_hash == self.provider_config_hash(),
        )
        return db.scalar(statement)

    def mark_processing(self, db: Session, artifact: ImageProcessingArtifact) -> None:
        if artifact.status == "succeeded":
            return
        artifact.status = "processing"
        artifact.error_message = None
        db.add(artifact)
        db.commit()

    def mark_failed(self, db: Session, artifact: ImageProcessingArtifact, error_message: str) -> None:
        artifact.status = "failed"
        artifact.error_message = error_message
        db.add(artifact)
        db.commit()

    def mark_succeeded_from_local(
        self,
        db: Session,
        artifact: ImageProcessingArtifact,
        image_path: Path,
        detection: HandDetectionResult,
        segmentation: SegmentationResult,
        create_cutout: bool = False,
    ) -> ImageProcessingArtifact:
        artifact.status = "succeeded"
        artifact.error_message = None
        artifact.landmarks_json = [{"x": point.x, "y": point.y} for point in detection.landmarks]
        artifact.roi_boxes_json = segmentation.roi_boxes
        artifact.quality_score = segmentation.confidence
        if segmentation.mask_path is not None:
            alpha_mask_path = self._create_alpha_mask_from_mask(segmentation.mask_path, artifact)
            artifact.mask_path = relative_to_base(alpha_mask_path)
            artifact.mask_url = public_url_for_path(alpha_mask_path)
            if create_cutout:
                cutout_path = self._create_cutout_from_mask(image_path, segmentation.mask_path, artifact, "cutout")
                artifact.cutout_path = relative_to_base(cutout_path)
                artifact.cutout_url = public_url_for_path(cutout_path)
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact

    def mark_succeeded_from_remote(
        self,
        db: Session,
        artifact: ImageProcessingArtifact,
        artifacts_payload: dict[str, object],
        prefix: str,
    ) -> ImageProcessingArtifact:
        landmarks = artifacts_payload.get(f"{prefix}_landmarks")
        roi_boxes = artifacts_payload.get(f"{prefix}_roi_boxes")
        quality_score = artifacts_payload.get(f"{prefix}_quality_score")
        mask_b64 = artifacts_payload.get(f"{prefix}_mask_b64")
        cutout_b64 = artifacts_payload.get(f"{prefix}_cutout_b64")

        artifact.status = "succeeded"
        artifact.error_message = None
        if isinstance(landmarks, list):
            artifact.landmarks_json = landmarks
        if isinstance(roi_boxes, list):
            artifact.roi_boxes_json = roi_boxes
        if isinstance(quality_score, (int, float)):
            artifact.quality_score = float(quality_score)
        if isinstance(mask_b64, str) and mask_b64:
            mask_path = self._save_b64_artifact(artifact, mask_b64, "mask")
            artifact.mask_path = relative_to_base(mask_path)
            artifact.mask_url = public_url_for_path(mask_path)
        if isinstance(cutout_b64, str) and cutout_b64:
            cutout_path = self._save_b64_artifact(artifact, cutout_b64, "cutout")
            artifact.cutout_path = relative_to_base(cutout_path)
            artifact.cutout_url = public_url_for_path(cutout_path)
        db.add(artifact)
        db.commit()
        db.refresh(artifact)
        return artifact

    def to_remote_payload(self, artifact: ImageProcessingArtifact) -> dict[str, object] | None:
        if artifact.status != "succeeded":
            return None
        payload: dict[str, object] = {
            "image_sha256": artifact.image_sha256,
            "image_role": artifact.image_role,
            "pipeline_version": artifact.pipeline_version,
            "landmarks": artifact.landmarks_json,
            "roi_boxes": artifact.roi_boxes_json,
            "quality_score": artifact.quality_score,
        }
        mask_path = resolve_local_path(artifact.mask_path)
        cutout_path = resolve_local_path(artifact.cutout_path)
        if mask_path is not None and mask_path.exists():
            payload["mask_b64"] = base64.b64encode(mask_path.read_bytes()).decode("ascii")
        if cutout_path is not None and cutout_path.exists():
            payload["cutout_b64"] = base64.b64encode(cutout_path.read_bytes()).decode("ascii")
        return payload

    def local_path(self, path_value: str | None) -> Path | None:
        path = resolve_local_path(path_value)
        if path is not None and path.exists():
            return path
        return None

    def _artifact_dir(self, artifact: ImageProcessingArtifact) -> Path:
        return self.settings.tryon_artifact_path / artifact.image_role

    def _save_b64_artifact(self, artifact: ImageProcessingArtifact, image_b64: str, suffix: str) -> Path:
        target = self._artifact_dir(artifact) / f"{artifact.image_sha256[:16]}-{artifact.id}-{suffix}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(base64.b64decode(image_b64))
        return target

    def _create_cutout_from_mask(
        self,
        image_path: Path,
        mask_path: Path,
        artifact: ImageProcessingArtifact,
        suffix: str,
    ) -> Path:
        image = Image.open(image_path).convert("RGBA")
        mask = Image.open(mask_path).convert("L").resize(image.size)
        image.putalpha(mask)
        target = self._artifact_dir(artifact) / f"{artifact.image_sha256[:16]}-{artifact.id}-{suffix}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target)
        return target

    def _create_alpha_mask_from_mask(self, mask_path: Path, artifact: ImageProcessingArtifact) -> Path:
        mask = Image.open(mask_path).convert("L")
        mask_rgba = mask.convert("RGBA")
        mask_rgba.putalpha(mask)
        target = self._artifact_dir(artifact) / f"{artifact.image_sha256[:16]}-{artifact.id}-mask-alpha.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        mask_rgba.save(target, format="PNG")
        return target
