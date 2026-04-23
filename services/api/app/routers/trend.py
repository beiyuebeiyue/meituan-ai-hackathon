from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.services.trend_service import TrendService


router = APIRouter(prefix="/trend", tags=["trend"])
trend_service = TrendService()


@router.get("/snapshots/latest")
def get_latest_snapshot(db: Session = Depends(get_db)) -> dict[str, object] | None:
    snapshot = trend_service.latest_snapshot(db)
    if snapshot is None:
        return None
    return {
        "id": snapshot.id,
        "source_name": snapshot.source_name,
        "snapshot_date": snapshot.snapshot_date.isoformat(),
        "raw_count": snapshot.raw_count,
        "valid_count": snapshot.valid_count,
        "payload_json": snapshot.payload_json,
    }
