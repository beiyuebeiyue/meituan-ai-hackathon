from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.services.seed_service import SeedService


router = APIRouter(prefix="/admin", tags=["admin"])
seed_service = SeedService()


class SeedImportRequest(BaseModel):
    xlsx_path: str | None = None


@router.post("/seed/import")
def import_seed_data(payload: SeedImportRequest | None = None, db: Session = Depends(get_db)) -> dict[str, object]:
    settings = get_settings()
    xlsx_path = Path(payload.xlsx_path) if payload and payload.xlsx_path else settings.seed_xlsx
    return seed_service.import_seed_data(db, xlsx_path=xlsx_path)


@router.post("/seed/enrich")
def enrich_seed_metadata(db: Session = Depends(get_db)) -> dict[str, object]:
    return seed_service.enrich_style_metadata(db)


@router.post("/demo/metrics")
def generate_demo_metrics(db: Session = Depends(get_db)) -> dict[str, object]:
    return seed_service.generate_demo_metrics(db)
