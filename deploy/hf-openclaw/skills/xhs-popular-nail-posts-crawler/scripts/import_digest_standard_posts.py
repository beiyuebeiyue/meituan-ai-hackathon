#!/usr/bin/env python3
import hashlib
import json
import shutil
import sys
from pathlib import Path
from uuid import uuid4


sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "services" / "api"))

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.db import database, init_db
from app.core.security import get_password_hash
from app.models.nail_style import NailStyle
from app.models.user import User
from app.services.post_service import PostService
from app.services.style_service import StyleService
from app.utils.files import (
    build_user_upload_filename,
    hash_file_sha256,
    public_url_for_path,
    relative_to_base,
    user_upload_dir,
)


def load_digest(run_date):
    digest_path = Path.cwd() / "assets" / run_date / "xhs_note_digest.json"
    with digest_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def next_uid(db):
    current_max = db.scalar(select(func.max(User.uid)))
    return 1 if current_max is None or current_max < 1 else int(current_max) + 1


def username_for_note(note):
    name = str(note.get("user_name") or "").strip()
    if not name:
        return f"xhs_user_{note['note_id'][:12]}"
    if len(name) <= 80:
        return name
    return f"{name[:67]}_{hashlib.sha1(name.encode('utf-8')).hexdigest()[:10]}"


def generated_phone(db, username, user_id=None):
    seed = int(hashlib.sha1(f"xhs:{username}".encode("utf-8")).hexdigest()[:12], 16) % 100_000_000
    for offset in range(10_000):
        phone = f"199{(seed + offset) % 100_000_000:08d}"
        owner = db.scalar(select(User).where(User.phone == phone))
        if owner is None or owner.id == user_id:
            return phone
    raise RuntimeError(f"无法为导入用户生成唯一手机号: {username}")


def get_or_create_user(db, username):
    user = db.scalar(select(User).where(User.username == username))
    if user is not None:
        if not user.phone:
            user.phone = generated_phone(db, username, user.id)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user, False

    user = User(
        uid=next_uid(db),
        phone=generated_phone(db, username),
        username=username,
        password_hash=get_password_hash(uuid4().hex),
        role="consumer",
        bio="小红书美甲笔记导入账号",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True


def resolve_digest_image(path):
    image_path = Path(path)
    if image_path.is_absolute():
        return image_path
    return Path.cwd() / image_path


def copy_to_user_uploads(source_path, user):
    settings = get_settings()
    file_hash = hash_file_sha256(source_path)
    target_dir = user_upload_dir(settings.upload_path, "posts", user.uid)
    target_path = target_dir / build_user_upload_filename(user.uid, file_hash, source_path.suffix.lower() or ".webp")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if not target_path.exists():
        shutil.copy2(source_path, target_path)
    return target_path


def imported_style_exists(db, note_id):
    return db.scalar(select(NailStyle).where(NailStyle.style_metadata_json["xhs_note_id"].as_string() == note_id)) is not None


def import_note_post(db, note, user):
    note_id = note["note_id"]
    if imported_style_exists(db, note_id):
        return "skipped_existing"

    standard_image = str(note.get("standard_nail_image") or "").strip()
    if not standard_image:
        return "skipped_no_standard_image"

    source_path = resolve_digest_image(standard_image)
    if not source_path.exists():
        return "skipped_missing_image"

    uploaded_path = copy_to_user_uploads(source_path, user)
    tags = [str(tag).strip() for tag in note.get("tag_list", []) if str(tag).strip()]
    post = PostService().create(
        db,
        user,
        title=str(note.get("title") or "小红书美甲笔记")[:200],
        description=str(note.get("desc") or ""),
        image_url=public_url_for_path(uploaded_path),
        local_image_path=relative_to_base(uploaded_path),
        tags=tags,
    )
    style = StyleService().create_style_from_post(db, user, post)
    style.style_metadata_json = {
        **(style.style_metadata_json or {}),
        "source": "xhs_digest_import",
        "xhs_note_id": note_id,
        "xhs_user_name": note.get("user_name") or "",
        "xhs_publish_date": note.get("publish_date") or "",
        "xhs_liked_count": note.get("liked_count") or 0,
        "xhs_collected_count": note.get("collected_count") or 0,
        "xhs_share_count": note.get("share_count") or 0,
    }
    db.add(style)
    db.commit()
    return "imported"


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m scripts.import_digest_standard_posts <YYYYmmdd>")
    run_date = sys.argv[1]

    database.configure(get_settings().database_url)
    init_db()
    digest = load_digest(run_date)
    result = {
        "date": run_date,
        "digest_count": len(digest["notes"]),
        "users_created": 0,
        "users_reused": 0,
        "posts_imported": 0,
        "skipped_existing": 0,
        "skipped_no_standard_image": 0,
        "skipped_missing_image": 0,
    }

    with database.session() as db:
        users = {}
        for note in digest["notes"]:
            username = username_for_note(note)
            if username not in users:
                users[username], created = get_or_create_user(db, username)
                result["users_created" if created else "users_reused"] += 1

            status = import_note_post(db, note, users[username])
            if status == "imported":
                result["posts_imported"] += 1
            else:
                result[status] += 1

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
