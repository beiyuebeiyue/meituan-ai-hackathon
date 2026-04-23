from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.events import StyleEventBatchRequest
from app.services.event_service import EventService


router = APIRouter(prefix="/events", tags=["events"])
event_service = EventService()


@router.post("/styles")
def record_style_events(payload: StyleEventBatchRequest, db: Session = Depends(get_db)) -> dict[str, int]:
    rows = event_service.record_style_events(db, payload.items)
    return {"updated": len(rows)}
