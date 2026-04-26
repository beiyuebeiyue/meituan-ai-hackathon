from __future__ import annotations

import re

from sqlalchemy import select

from app.models.user import User
from app.models.user_hand_photo import UserHandPhoto
from app.models.user_post import UserPost
from app.services.upload_migration_service import UploadMigrationService
from app.utils.files import hash_file_sha256, public_url_for_path, relative_to_base


def _login_admin(client) -> tuple[str, dict[str, object]]:
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "13886722666", "password": "admin@123456"},
    )
    payload = response.json()
    return payload["access_token"], payload["user"]


def test_avatar_and_post_uploads_use_uid_business_directories(client, image_factory):
    token, user = _login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    with image_factory("avatar-upload.png").open("rb") as avatar_file:
        avatar_response = client.put(
            "/api/v1/users/me",
            headers=headers,
            files={"avatar_file": ("avatar.png", avatar_file.read(), "image/png")},
            data={"username": "admin"},
        )
    assert avatar_response.status_code == 200
    avatar_url = avatar_response.json()["avatar_url"]
    assert re.search(rf"/files/uploads/avatars/{user['uid']}/{user['uid']}-\d{{20}}-[0-9a-f]{{16}}\.", avatar_url) is not None

    with image_factory("post-upload.png").open("rb") as post_file:
        post_response = client.post(
            "/api/v1/posts",
            headers=headers,
            files={"image": ("post.png", post_file.read(), "image/png")},
            data={"title": "测试发布", "description": "测试描述", "tags": "显白,猫眼"},
        )
    assert post_response.status_code == 200
    image_url = post_response.json()["image_url"]
    assert re.search(rf"/files/uploads/posts/{user['uid']}/{user['uid']}-\d{{20}}-[0-9a-f]{{16}}\.", image_url) is not None


def test_upload_migration_moves_existing_files_into_uid_directories(client, db_session, image_factory, app_env):
    _, user_payload = _login_admin(client)
    user = db_session.scalar(select(User).where(User.id == user_payload["id"]))
    assert user is not None

    old_avatar_path = app_env.upload_path / "avatars" / "legacy-avatar.png"
    old_avatar_path.parent.mkdir(parents=True, exist_ok=True)
    old_avatar_path.write_bytes(image_factory("legacy-avatar-source.png").read_bytes())
    user.avatar_url = public_url_for_path(old_avatar_path)

    old_hand_path = app_env.upload_path / "hands" / user.id / "legacy-hand.png"
    old_hand_path.parent.mkdir(parents=True, exist_ok=True)
    old_hand_path.write_bytes(image_factory("legacy-hand-source.png").read_bytes())
    hand_photo = UserHandPhoto(
        user_id=user.id,
        image_path=relative_to_base(old_hand_path),
        image_url=public_url_for_path(old_hand_path),
        sha256=hash_file_sha256(old_hand_path),
    )

    old_post_path = app_env.upload_path / "posts" / "legacy-post.png"
    old_post_path.parent.mkdir(parents=True, exist_ok=True)
    old_post_path.write_bytes(image_factory("legacy-post-source.png").read_bytes())
    post = UserPost(
        user_id=user.id,
        title="旧发布",
        description="旧图片路径",
        image_url=public_url_for_path(old_post_path),
        local_image_path=relative_to_base(old_post_path),
        tags_json=["显白"],
    )

    db_session.add_all([user, hand_photo, post])
    db_session.commit()

    result = UploadMigrationService().migrate_existing_uploads(db_session)
    assert result == {"avatars": 1, "hands": 1, "posts": 1}

    db_session.refresh(user)
    db_session.refresh(hand_photo)
    db_session.refresh(post)

    assert re.search(rf"/files/uploads/avatars/{user.uid}/{user.uid}-\d{{20}}-[0-9a-f]{{16}}\.", user.avatar_url or "") is not None
    assert re.search(rf"/files/uploads/hands/{user.uid}/{user.uid}-\d{{20}}-[0-9a-f]{{16}}\.", hand_photo.image_url) is not None
    assert re.search(rf"/files/uploads/posts/{user.uid}/{user.uid}-\d{{20}}-[0-9a-f]{{16}}\.", post.image_url) is not None

    assert old_avatar_path.exists() is False
    assert old_hand_path.exists() is False
    assert old_post_path.exists() is False

    rerun = UploadMigrationService().migrate_existing_uploads(db_session)
    assert rerun == {"avatars": 0, "hands": 0, "posts": 0}
