from __future__ import annotations

from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.user import User
from app.models.user_hand_photo import UserHandPhoto
from app.models.user_post import UserPost
from app.utils.files import (
    path_from_public_url,
    public_url_for_path,
    relative_to_base,
    relocate_existing_user_upload,
    resolve_local_path,
    user_upload_dir,
)


class UploadMigrationService:
    @property
    def settings(self):
        return get_settings()

    def migrate_existing_uploads(self, db: Session) -> dict[str, int]:
        migrated = {"avatars": 0, "hands": 0, "posts": 0}

        users = list(db.scalars(select(User).order_by(User.created_at.asc(), User.id.asc())).all())
        for user in users:
            if self._migrate_avatar(user):
                db.add(user)
                migrated["avatars"] += 1

        hand_photos = list(
            db.scalars(
                select(UserHandPhoto)
                .options(selectinload(UserHandPhoto.user))
                .order_by(UserHandPhoto.created_at.asc(), UserHandPhoto.id.asc())
            ).all()
        )
        for hand_photo in hand_photos:
            if hand_photo.user is None:
                continue
            if self._migrate_hand_photo(hand_photo):
                db.add(hand_photo)
                migrated["hands"] += 1

        posts = list(
            db.scalars(
                select(UserPost)
                .options(selectinload(UserPost.user))
                .order_by(UserPost.created_at.asc(), UserPost.id.asc())
            ).all()
        )
        for post in posts:
            if post.user is None:
                continue
            if self._migrate_post(post):
                db.add(post)
                migrated["posts"] += 1

        if any(migrated.values()):
            db.commit()
        return migrated

    def _migrate_avatar(self, user: User) -> bool:
        if not isinstance(user.uid, int) or user.avatar_url is None:
            return False
        if user.uid == 0 and user.avatar_url.endswith("/p0.png"):
            return False
        source_path = self._resolve_source_path(public_url=user.avatar_url)
        if source_path is None or not source_path.exists():
            return False
        target_path, _ = relocate_existing_user_upload(
            source_path,
            user_upload_dir(self.settings.upload_path, "avatars", user.uid),
            user.uid,
            timestamp=user.updated_at or user.created_at,
        )
        new_url = public_url_for_path(target_path)
        if user.avatar_url != new_url:
            user.avatar_url = new_url
            return True
        return False

    def _migrate_hand_photo(self, hand_photo: UserHandPhoto) -> bool:
        user = hand_photo.user
        assert user is not None
        if not isinstance(user.uid, int):
            return False
        source_path = self._resolve_source_path(local_path=hand_photo.image_path, public_url=hand_photo.image_url)
        if source_path is None or not source_path.exists():
            return False
        target_path, file_hash = relocate_existing_user_upload(
            source_path,
            user_upload_dir(self.settings.upload_path, "hands", user.uid),
            user.uid,
            timestamp=hand_photo.created_at,
            content_sha256=hand_photo.sha256,
        )
        new_rel = relative_to_base(target_path)
        new_url = public_url_for_path(target_path)
        changed = hand_photo.image_path != new_rel or hand_photo.image_url != new_url or hand_photo.sha256 != file_hash
        if changed:
            hand_photo.image_path = new_rel
            hand_photo.image_url = new_url
            hand_photo.sha256 = file_hash
        return changed

    def _migrate_post(self, post: UserPost) -> bool:
        user = post.user
        assert user is not None
        if not isinstance(user.uid, int):
            return False
        source_path = self._resolve_source_path(local_path=post.local_image_path, public_url=post.image_url)
        if source_path is None or not source_path.exists():
            return False
        target_path, _ = relocate_existing_user_upload(
            source_path,
            user_upload_dir(self.settings.upload_path, "posts", user.uid),
            user.uid,
            timestamp=post.created_at,
        )
        new_rel = relative_to_base(target_path)
        new_url = public_url_for_path(target_path)
        changed = post.local_image_path != new_rel or post.image_url != new_url
        if changed:
            post.local_image_path = new_rel
            post.image_url = new_url
        return changed

    @staticmethod
    def _resolve_source_path(local_path: str | None = None, public_url: str | None = None) -> Path | None:
        candidates = [resolve_local_path(local_path), path_from_public_url(public_url)]
        for candidate in candidates:
            if candidate is not None and candidate.exists():
                return candidate
        for candidate in candidates:
            if candidate is not None:
                return candidate
        return None
