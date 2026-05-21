from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_optional_current_user
from app.models.user import User
from app.schemas.events import AnalyticsEventBatchRequest, AnalyticsEventBatchResponse, StyleEventBatchRequest
from app.services.analytics_service import AnalyticsService
from app.services.event_service import EventService


router = APIRouter(prefix="/events", tags=["events"])
event_service = EventService()
analytics_service = AnalyticsService()


@router.post("/styles")
def record_style_events(payload: StyleEventBatchRequest, db: Session = Depends(get_db)) -> dict[str, int]:
    rows = event_service.record_style_events(db, payload.items)
    return {"updated": len(rows)}


@router.post("/analytics", response_model=AnalyticsEventBatchResponse)
def record_analytics_events(
    payload: AnalyticsEventBatchRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> AnalyticsEventBatchResponse:
    inserted, skipped = analytics_service.record_client_events(db, payload.items, user=user)
    return AnalyticsEventBatchResponse(inserted=inserted, skipped=skipped)
