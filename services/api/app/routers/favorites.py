from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_favorite import UserFavorite
from app.routers.helpers import serialize_style
from app.schemas.favorites import FavoriteCreateRequest, FavoriteListResponse
from app.services.event_service import EventService
from app.schemas.events import StyleEventInput
from app.services.style_service import StyleService


router = APIRouter(prefix="/favorites", tags=["favorites"])
style_service = StyleService()
event_service = EventService()


@router.post("")
def create_favorite(
    payload: FavoriteCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    style = style_service.get_style(db, payload.style_id)
    existing = db.scalar(
        select(UserFavorite).where(
            UserFavorite.user_id == user.id,
            UserFavorite.nail_style_id == payload.style_id,
        )
    )
    if existing is None:
        db.add(UserFavorite(user_id=user.id, nail_style_id=payload.style_id))
        db.commit()
        event_service.record_style_events(
            db,
            [StyleEventInput(style_id=style.id, event_type="favorite", source="profile", count=1)],
        )
    return {"message": "收藏成功"}


@router.delete("/{style_id}")
def delete_favorite(
    style_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    favorite = db.scalar(
        select(UserFavorite).where(
            UserFavorite.user_id == user.id,
            UserFavorite.nail_style_id == style_id,
        )
    )
    if favorite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="收藏不存在")
    db.delete(favorite)
    db.commit()
    return {"message": "已取消收藏"}


@router.get("/me", response_model=FavoriteListResponse)
def list_my_favorites(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FavoriteListResponse:
    favorite_ids = style_service.get_favorite_ids(db, user.id)
    items = [style_service.get_style(db, style_id) for style_id in favorite_ids]
    return FavoriteListResponse(items=[serialize_style(style, favorite_ids) for style in items])
