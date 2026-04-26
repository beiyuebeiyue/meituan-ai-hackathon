from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.tryon_job import TryOnJob
from app.models.user import User
from app.schemas.events import StyleEventInput
from app.services.event_service import EventService
from app.services.hand_service import get_hand_service
from app.services.image_edit_service import get_image_edit_service
from app.services.segmentation_service import get_segmentation_service
from app.services.style_service import StyleService
from app.services.user_hand_photo_service import UserHandPhotoService
from app.utils.files import relative_to_base


class TryOnService:
    def __init__(self) -> None:
        self.styles = StyleService()
        self.hand_service = get_hand_service()
        self.segmentation_service = get_segmentation_service()
        self.image_edit_service = get_image_edit_service()
        self.event_service = EventService()
        self.user_hand_photo_service = UserHandPhotoService()

    @property
    def settings(self):
        return get_settings()

    def create_job(
        self,
        db: Session,
        user: User,
        style_id: str,
        hand_image: UploadFile | None = None,
        prompt_text: str = "",
        saved_hand_photo_id: str | None = None,
    ) -> TryOnJob:
        style = self.styles.get_style(db, style_id)
        if saved_hand_photo_id:
            hand_photo = self.user_hand_photo_service.get_for_user(db, user, saved_hand_photo_id)
        elif hand_image is not None:
            hand_photo = self.user_hand_photo_service.save_uploaded(db, user, hand_image)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请上传手图或选择已保存手图")

        job = TryOnJob(
            user_id=user.id,
            source_hand_image_url=hand_photo.image_url,
            hand_image_path=hand_photo.image_path,
            selected_style_id=style.id,
            prompt_text=prompt_text,
            status="pending",
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def get_job(self, db: Session, user: User, job_id: str) -> TryOnJob:
        job = db.get(TryOnJob, job_id)
        if job is None or job.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="试戴任务不存在")
        return job

    def list_jobs(self, db: Session, user: User) -> list[TryOnJob]:
        statement = (
            select(TryOnJob)
            .options(selectinload(TryOnJob.style))
            .where(TryOnJob.user_id == user.id)
            .order_by(TryOnJob.created_at.desc())
        )
        return list(db.scalars(statement).all())

    def process_job(self, db: Session, job_id: str) -> TryOnJob:
        job = db.get(TryOnJob, job_id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="试戴任务不存在")

        style = self.styles.get_style(db, job.selected_style_id)
        hand_image_path = self.settings.base_dir / job.hand_image_path
        style_image_path = self.settings.base_dir / style.local_image_path

        try:
            job.status = "processing"
            job.error_message = None
            db.add(job)
            db.commit()

            detection = self.hand_service.detect(hand_image_path)
            segmentation = self.segmentation_service.segment(hand_image_path, detection)
            generated = self.image_edit_service.generate_tryon(
                hand_image_path=hand_image_path,
                style_image_path=style_image_path,
                prompt_text=job.prompt_text,
                roi_boxes=segmentation.roi_boxes,
                mask_path=segmentation.mask_path,
            )

            job.status = "succeeded"
            job.result_image_path = relative_to_base(generated.local_path)
            job.result_image_url = generated.public_url
            db.add(job)
            db.commit()
            db.refresh(job)

            self.event_service.record_style_events(
                db,
                [StyleEventInput(style_id=style.id, event_type="tryon", source="ask_ai", count=1)],
            )
            return job
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)
            db.add(job)
            db.commit()
            db.refresh(job)
            return job
