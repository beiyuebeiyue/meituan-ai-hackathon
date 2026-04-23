from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.user import User
from app.models.user_hand_photo import UserHandPhoto
from app.utils.files import public_url_for_path, relative_to_base, save_upload_file


def _sha256_for_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class UserHandPhotoService:
    @property
    def settings(self):
        return get_settings()

    def list_for_user(self, db: Session, user: User) -> list[UserHandPhoto]:
        statement = (
            select(UserHandPhoto)
            .where(UserHandPhoto.user_id == user.id)
            .order_by(UserHandPhoto.created_at.desc())
        )
        return list(db.scalars(statement).all())

    def get_for_user(self, db: Session, user: User, hand_photo_id: str) -> UserHandPhoto:
        hand_photo = db.get(UserHandPhoto, hand_photo_id)
        if hand_photo is None or hand_photo.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="手图不存在")
        return hand_photo

    def save_uploaded(self, db: Session, user: User, upload: UploadFile) -> UserHandPhoto:
        saved_path = save_upload_file(upload, self.settings.upload_path / "hands" / user.id, prefix="hand")
        file_hash = _sha256_for_file(saved_path)
        existing = db.scalar(
            select(UserHandPhoto).where(
                UserHandPhoto.user_id == user.id,
                UserHandPhoto.sha256 == file_hash,
            )
        )
        if existing is not None:
            saved_path.unlink(missing_ok=True)
            return existing

        hand_photo = UserHandPhoto(
            user_id=user.id,
            image_path=relative_to_base(saved_path),
            image_url=public_url_for_path(saved_path),
            sha256=file_hash,
        )
        db.add(hand_photo)
        db.commit()
        db.refresh(hand_photo)
        return hand_photo
