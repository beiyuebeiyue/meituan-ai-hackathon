from __future__ import annotations

from app.core.db import database
from app.services.tryon_service import TryOnService


def run_tryon_job(job_id: str) -> None:
    database.configure()
    with database.session() as db:
        TryOnService().process_job(db, job_id)
