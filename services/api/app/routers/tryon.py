from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.tryon import TryOnHistoryItemRead, TryOnHistoryListResponse, TryOnJobCreateResponse, TryOnJobRead
from app.services.tryon_service import TryOnService
from app.tasks.tryon_tasks import run_tryon_job
from app.utils.files import delete_local_file, ensure_local_file, hash_file_sha256


router = APIRouter(prefix="/tryon", tags=["tryon"])
tryon_service = TryOnService()


@router.post("/jobs", response_model=TryOnJobCreateResponse)
def create_tryon_job(
    background_tasks: BackgroundTasks,
    hand_image: UploadFile | None = File(default=None),
    style_id: str = Form(...),
    prompt_text: str = Form(default=""),
    saved_hand_photo_id: str | None = Form(default=None),
    prepare_only: bool = Form(default=True),
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
    if prepare_only:
        job.status = "awaiting_confirmation"
        job.stage = "mask_ready"
        db.add(job)
        db.commit()
        db.refresh(job)
    else:
        background_tasks.add_task(run_tryon_job, job.id)
    return TryOnJobCreateResponse(
        job_id=job.id,
        status=job.status,
        stage=job.stage,
        source_hand_image_url=job.source_hand_image_url,
        mask_url=_mask_url_for_job(db, job),
    )


@router.post("/jobs/{job_id}/submit", response_model=TryOnJobCreateResponse)
def submit_tryon_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TryOnJobCreateResponse:
    job = tryon_service.get_job(db, user, job_id)
    if job.status not in {"awaiting_confirmation", "pending", "failed"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前试戴任务不可重复提交")
    job.status = "pending"
    job.stage = "pending"
    job.error_message = None
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_tryon_job, job.id)
    return TryOnJobCreateResponse(
        job_id=job.id,
        status=job.status,
        stage=job.stage,
        source_hand_image_url=job.source_hand_image_url,
        mask_url=_mask_url_for_job(db, job),
    )


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
        stage=job.stage,
        result_image_url=job.result_image_url,
        source_hand_image_url=job.source_hand_image_url,
        mask_url=_mask_url_for_job(db, job),
        error_message=job.error_message,
        prompt_text=job.prompt_text,
        selected_style_id=job.selected_style_id,
        created_at=job.created_at,
    )


@router.get("/jobs", response_model=TryOnHistoryListResponse)
def list_my_tryon_jobs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TryOnHistoryListResponse:
    items = [
        TryOnHistoryItemRead(
            job_id=item.id,
            status=item.status,
            stage=item.stage,
            result_image_url=item.result_image_url,
            source_hand_image_url=item.source_hand_image_url,
            prompt_text=item.prompt_text,
            selected_style_id=item.selected_style_id,
            style_title=item.style.title,
            style_image_url=item.style.image_url,
            created_at=item.created_at,
        )
        for item in tryon_service.list_jobs(db, user)
    ]
    return TryOnHistoryListResponse(items=items)


@router.delete("/jobs/{job_id}")
def delete_tryon_job(
    job_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    job = tryon_service.get_job(db, user, job_id)
    if job.status == "processing":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="处理中任务暂不可删除")
    delete_local_file(job.result_image_path)
    db.delete(job)
    db.commit()
    return {"message": "已删除 AI 换甲记录"}


def _mask_url_for_job(db: Session, job) -> str | None:
    hand_image_path = ensure_local_file(job.hand_image_path, job.source_hand_image_url, cache_prefix="hand")
    if hand_image_path is None or not hand_image_path.exists():
        return None
    artifact = tryon_service.artifact_service.get_existing_for_hash(db, hash_file_sha256(hand_image_path), "user_hand")
    if artifact is None or artifact.status != "succeeded":
        return None
    return artifact.mask_url
