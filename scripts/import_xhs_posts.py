#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from uuid import uuid4


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.db import database, init_db  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.models.nail_style import NailStyle  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.user_post import UserPost  # noqa: E402
from app.services.post_service import PostService  # noqa: E402
from app.services.style_service import StyleService  # noqa: E402
from app.utils.files import build_user_upload_filename, hash_file_sha256, public_url_for_path, relative_to_base, user_upload_dir  # noqa: E402


SOURCE_USER_TYPE = "xhs_user"
SOURCE_NOTE_TYPE = "xhs_note"


def load_registry_note_ids(root: Path) -> list[str]:
    registry_path = root / "xhs_note_registry.json"
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    raw_ids = payload.get("note_ids", payload) if isinstance(payload, dict) else payload
    return [str(item).strip() for item in raw_ids if str(item).strip()]


def build_digest_index(root: Path) -> dict[str, dict[str, object]]:
    index: dict[str, dict[str, object]] = {}
    for digest_path in sorted(root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json")):
        payload = json.loads(digest_path.read_text(encoding="utf-8"))
        notes = payload.get("notes", payload) if isinstance(payload, dict) else payload
        if not isinstance(notes, list):
            continue
        run_dir = digest_path.parent.name
        for note in notes:
            if not isinstance(note, dict):
                continue
            note_id = str(note.get("note_id") or note.get("id") or "").strip()
            if note_id:
                index[note_id] = {**note, "_run_dir": run_dir}
    return index


def source_path_for_note(root: Path, note: dict[str, object]) -> Path | None:
    image_list = note.get("image_list") if isinstance(note.get("image_list"), list) else []
    candidates = [note.get("standard_nail_image"), *image_list]
    for value in candidates:
        if not value:
            continue
        text_value = str(value).strip()
        if text_value.startswith(("http://", "https://")):
            continue
        if text_value.startswith("/openclaw-assets/"):
            path_candidates = [root / text_value.removeprefix("/openclaw-assets/")]
        elif text_value.startswith("assets/"):
            path_candidates = [root / text_value.removeprefix("assets/"), root.parent / text_value]
        else:
            path_candidates = [root / text_value]
        for path in path_candidates:
            if path.exists():
                return path.resolve()
    return None


def source_external_id_for_username(username: str) -> str:
    return hashlib.sha1(username.encode("utf-8")).hexdigest()


def normalized_username(note: dict[str, object], note_id: str) -> str:
    raw_name = str(note.get("user_name") or "").strip()
    if not raw_name:
        raw_name = f"小红书用户_{note_id[:8]}"
    return raw_name[:80]


def unique_import_username(db: Session, base_username: str) -> str:
    candidate = base_username[:80]
    existing = db.scalar(select(User).where(User.username == candidate))
    if existing is None or existing.source_type == SOURCE_USER_TYPE:
        return candidate

    suffix = "_xhs"
    candidate = f"{base_username[: 80 - len(suffix)]}{suffix}"
    index = 2
    while db.scalar(select(User).where(User.username == candidate)) is not None:
        suffix = f"_xhs_{index}"
        candidate = f"{base_username[: 80 - len(suffix)]}{suffix}"
        index += 1
    return candidate


def next_uid(db: Session) -> int:
    current_max = db.scalar(select(func.max(User.uid)))
    return 1 if current_max is None or int(current_max) < 1 else int(current_max) + 1


def get_or_create_xhs_user(db: Session, username: str) -> tuple[User, bool]:
    source_external_id = source_external_id_for_username(username)
    existing = db.scalar(
        select(User).where(User.source_type == SOURCE_USER_TYPE, User.source_external_id == source_external_id)
    )
    if existing is not None:
        return existing, False

    import_username = unique_import_username(db, username)
    user = User(
        uid=next_uid(db),
        phone=None,
        password_hash=get_password_hash(uuid4().hex),
        username=import_username,
        role="consumer",
        bio="小红书美甲笔记导入账号",
        source_type=SOURCE_USER_TYPE,
        source_external_id=source_external_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True


def copy_to_user_uploads(source_path: Path, user: User) -> Path:
    settings = get_settings()
    file_hash = hash_file_sha256(source_path)
    target_dir = user_upload_dir(settings.upload_path, "posts", user.uid)
    target_path = target_dir / build_user_upload_filename(user.uid, file_hash, source_path.suffix.lower() or ".webp")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if not target_path.exists():
        shutil.copy2(source_path, target_path)
    return target_path


def existing_style_for_note(db: Session, note_id: str) -> NailStyle | None:
    for style in db.scalars(select(NailStyle).where(NailStyle.source_type == SOURCE_NOTE_TYPE)):
        metadata = style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}
        if metadata.get("xhs_note_id") == note_id:
            return style
    return None


def note_metadata(note: dict[str, object], note_id: str, username: str) -> dict[str, object]:
    return {
        "xhs_note_id": note_id,
        "xhs_user_name": username,
        "xhs_publish_date": note.get("publish_date") or "",
        "xhs_time": note.get("time") or None,
        "xhs_liked_count": int(note.get("liked_count") or 0),
        "xhs_collected_count": int(note.get("collected_count") or 0),
        "xhs_share_count": int(note.get("share_count") or 0),
        "xhs_run_dir": note.get("_run_dir") or "",
    }


def popularity_score(metadata: dict[str, object]) -> float:
    liked = int(metadata.get("xhs_liked_count") or 0)
    collected = int(metadata.get("xhs_collected_count") or 0)
    shared = int(metadata.get("xhs_share_count") or 0)
    return float(liked + collected * 1.2 + shared * 1.5)


def import_note(db: Session, root: Path, note_id: str, note: dict[str, object]) -> str:
    existing_post = db.scalar(select(UserPost).where(UserPost.source_type == SOURCE_NOTE_TYPE, UserPost.source_external_id == note_id))
    if existing_post is not None:
        return "skipped_existing"

    image_path = source_path_for_note(root, note)
    if image_path is None:
        return "skipped_missing_image"

    username = normalized_username(note, note_id)
    user, _ = get_or_create_xhs_user(db, username)
    uploaded_path = copy_to_user_uploads(image_path, user)
    raw_tags = note.get("tag_list") if isinstance(note.get("tag_list"), list) else []
    tags = [str(tag).strip().lstrip("#") for tag in raw_tags if str(tag).strip()]
    metadata = note_metadata(note, note_id, username)
    post = PostService().create(
        db,
        user,
        title=str(note.get("title") or "小红书美甲笔记")[:200],
        description=str(note.get("desc") or note.get("caption") or ""),
        image_url=public_url_for_path(uploaded_path),
        local_image_path=relative_to_base(uploaded_path),
        tags=tags,
        nail_type="press_on",
        source_type=SOURCE_NOTE_TYPE,
        source_external_id=note_id,
        source_metadata=metadata,
    )

    existing_style = existing_style_for_note(db, note_id)
    if existing_style is None:
        style = StyleService().create_style_from_post(db, user, post)
    else:
        style = existing_style
        style.title = post.title
        style.description = post.description
        style.image_url = post.image_url
        style.local_image_path = post.local_image_path
        style.tags_json = tags
        style.source_type = SOURCE_NOTE_TYPE
        style.nail_type = "press_on"
        style.shop_id = None
        style.verified_booking_id = None

    style.style_metadata_json = {
        **(style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}),
        **metadata,
        "author_user_id": user.id,
        "from_post_id": post.id,
    }
    style.popularity_score = popularity_score(metadata)
    style.is_trending = True
    db.add(style)
    db.commit()
    return "imported"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import crawled XHS notes as Huanjia users, posts, and nail styles.")
    parser.add_argument("--assets-dir", default=None, help="Crawler assets directory. Defaults to XHS_CRAWLER_ASSETS_DIR.")
    parser.add_argument("--limit", type=int, default=None, help="Import at most N registry notes.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = get_settings()
    root = Path(args.assets_dir).resolve() if args.assets_dir else settings.xhs_crawler_assets_path

    database.configure(settings.database_url)
    init_db()

    note_ids = load_registry_note_ids(root)
    if args.limit is not None:
        note_ids = note_ids[: args.limit]
    digest_index = build_digest_index(root)
    result = {
        "registry_count": len(note_ids),
        "imported": 0,
        "skipped_existing": 0,
        "skipped_missing_digest": 0,
        "skipped_missing_image": 0,
    }

    with database.session() as db:
        for note_id in note_ids:
            note = digest_index.get(note_id)
            if note is None:
                result["skipped_missing_digest"] += 1
                continue
            status = import_note(db, root, note_id, note)
            result[status] += 1

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
