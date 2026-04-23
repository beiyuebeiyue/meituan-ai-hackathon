from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.ops import JobLogRead
from app.services.job_log_service import JobLogService


router = APIRouter(prefix="/jobs", tags=["jobs"])
job_log_service = JobLogService()


@router.get("/logs", response_model=list[JobLogRead])
def list_job_logs(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[JobLogRead]:
    return [JobLogRead.model_validate(item) for item in job_log_service.list_recent(db, limit=limit)]
