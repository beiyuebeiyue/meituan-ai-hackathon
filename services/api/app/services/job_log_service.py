from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job_log import JobLog


class JobLogService:
    def start(self, db: Session, job_name: str, message: str = "", payload: dict[str, object] | None = None) -> JobLog:
        job = JobLog(job_name=job_name, status="running", message=message, payload_json=payload or {})
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def finish(
        self,
        db: Session,
        job: JobLog,
        status: str,
        message: str = "",
        payload: dict[str, object] | None = None,
    ) -> JobLog:
        job.status = status
        job.message = message or job.message
        if payload is not None:
            job.payload_json = payload
        job.finished_at = datetime.now(timezone.utc)
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def list_recent(self, db: Session, limit: int = 50) -> list[JobLog]:
        statement = select(JobLog).order_by(JobLog.started_at.desc()).limit(limit)
        return list(db.scalars(statement))
