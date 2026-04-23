from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.users import UserHandPhotoListResponse, UserHandPhotoRead, UserRead
from app.services.user_hand_photo_service import UserHandPhotoService
from app.utils.files import public_url_for_path, save_upload_file
from app.core.config import get_settings


router = APIRouter(prefix="/users", tags=["users"])
hand_photo_service = UserHandPhotoService()


@router.get("/me", response_model=UserRead)
def get_me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)


@router.get("/me/hand-photos", response_model=UserHandPhotoListResponse)
def get_my_hand_photos(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserHandPhotoListResponse:
    items = [UserHandPhotoRead.model_validate(item) for item in hand_photo_service.list_for_user(db, user)]
    return UserHandPhotoListResponse(items=items)


@router.put("/me", response_model=UserRead)
def update_me(
    username: str | None = Form(default=None),
    avatar_file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserRead:
    settings = get_settings()
    if username:
        user.username = username
    if avatar_file:
        saved_path = save_upload_file(avatar_file, settings.upload_path / "avatars", prefix="avatar")
        user.avatar_url = public_url_for_path(saved_path)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.model_validate(user)
