from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_optional_current_user
from app.models.user import User
from app.routers.helpers import serialize_style
from app.schemas.nails import NailStyleListResponse, NailStyleRead
from app.services.style_service import StyleService


router = APIRouter(prefix="/nails", tags=["nails"])
style_service = StyleService()


@router.get("/hot", response_model=NailStyleListResponse)
def list_hot(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    items, total = style_service.list_hot(db, page, page_size)
    favorite_ids = style_service.get_favorite_ids(db, user.id) if user else set()
    return NailStyleListResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=[serialize_style(style, favorite_ids) for style in items],
    )


@router.get("/latest", response_model=NailStyleListResponse)
def list_latest(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=30),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleListResponse:
    items, total = style_service.list_latest(db, page, page_size)
    favorite_ids = style_service.get_favorite_ids(db, user.id) if user else set()
    return NailStyleListResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=[serialize_style(style, favorite_ids) for style in items],
    )


@router.get("/{style_id}", response_model=NailStyleRead)
def get_style(
    style_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
) -> NailStyleRead:
    style = style_service.get_style(db, style_id)
    favorite_ids = style_service.get_favorite_ids(db, user.id) if user else set()
    return serialize_style(style, favorite_ids)
