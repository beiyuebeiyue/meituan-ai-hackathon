from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.tryon import TryOnJobCreateResponse, TryOnJobRead
from app.services.tryon_service import TryOnService
from app.tasks.tryon_tasks import run_tryon_job


router = APIRouter(prefix="/tryon", tags=["tryon"])
tryon_service = TryOnService()


@router.post("/jobs", response_model=TryOnJobCreateResponse)
def create_tryon_job(
    background_tasks: BackgroundTasks,
    hand_image: UploadFile | None = File(default=None),
    style_id: str = Form(...),
    prompt_text: str = Form(default=""),
    saved_hand_photo_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TryOnJobCreateResponse:
    job = tryon_service.create_job(
        db,
        user,
        style_id,
        hand_image=hand_image,
        prompt_text=prompt_text,
        saved_hand_photo_id=saved_hand_photo_id,
    )
    background_tasks.add_task(run_tryon_job, job.id)
    return TryOnJobCreateResponse(job_id=job.id, status=job.status)


@router.get("/jobs/{job_id}", response_model=TryOnJobRead)
def get_tryon_job(
    job_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TryOnJobRead:
    job = tryon_service.get_job(db, user, job_id)
    return TryOnJobRead(
        job_id=job.id,
        status=job.status,
        result_image_url=job.result_image_url,
        source_hand_image_url=job.source_hand_image_url,
        error_message=job.error_message,
        prompt_text=job.prompt_text,
        selected_style_id=job.selected_style_id,
        created_at=job.created_at,
    )
