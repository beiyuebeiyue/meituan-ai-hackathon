from __future__ import annotations

import hashlib
import mimetypes
import re
import shutil
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import UploadFile

from app.core.config import get_settings


UTC_PLUS_8 = ZoneInfo("Asia/Shanghai")
USER_UPLOAD_FILENAME_RE = re.compile(r"^(?P<uid>\d+)-(?P<timestamp>\d{20})-(?P<hash>[0-9a-f]{16})(?P<ext>\.[a-z0-9]+)$")


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def relative_to_base(path: Path) -> str:
    settings = get_settings()
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(settings.base_dir))
    except ValueError:
        return str(resolved)


def public_url_for_path(path: Path) -> str:
    settings = get_settings()
    resolved = path.resolve()
    candidates = [
        (settings.upload_path, "uploads"),
        (settings.tryon_result_path, "tryon_results"),
        (settings.tryon_artifact_path, "tryon_artifacts"),
        (settings.seed_path, "seed"),
        (settings.report_path, "reports"),
        (settings.base_dir / "data", ""),
    ]
    for root, prefix in candidates:
        try:
            relative_data_path = resolved.relative_to(root.resolve())
            path_suffix = relative_data_path.as_posix()
            if prefix:
                return f"{settings.public_files_prefix}/{prefix}/{path_suffix}"
            return f"{settings.public_files_prefix}/{path_suffix}"
        except ValueError:
            continue
    return f"{settings.public_files_prefix}/{resolved.name}"


def resolve_local_path(relative_or_absolute_path: str | None) -> Path | None:
    if not relative_or_absolute_path:
        return None
    settings = get_settings()
    path = Path(relative_or_absolute_path)
    if not path.is_absolute():
        path = settings.base_dir / path
    try:
        return path.resolve()
    except FileNotFoundError:
        return path


def path_from_public_url(url: str | None) -> Path | None:
    if not url:
        return None
    settings = get_settings()
    prefix = f"{settings.public_files_prefix}/"
    if not url.startswith(prefix):
        return None
    relative = Path(url.removeprefix(prefix))
    candidates = [
        (Path("uploads"), settings.upload_path),
        (Path("tryon_results"), settings.tryon_result_path),
        (Path("tryon_artifacts"), settings.tryon_artifact_path),
        (Path("seed"), settings.seed_path),
        (Path("reports"), settings.report_path),
    ]
    for public_prefix, root in candidates:
        parts = relative.parts
        if tuple(parts[: len(public_prefix.parts)]) == public_prefix.parts:
            suffix = Path(*parts[len(public_prefix.parts) :])
            return (root / suffix).resolve()
    return (settings.base_dir / "data" / relative).resolve()


def guess_extension(url_or_content_type: str, default: str = ".png") -> str:
    if "/" in url_or_content_type and not url_or_content_type.startswith("."):
        extension = mimetypes.guess_extension(url_or_content_type.split(";")[0].strip())
        return extension or default
    path = Path(url_or_content_type)
    if path.suffix:
        return path.suffix.lower()
    return default


def hash_file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def user_upload_dir(upload_root: Path, business: str, user_uid: int) -> Path:
    return upload_root / business / str(user_uid)


def build_user_upload_filename(user_uid: int, content_sha256: str, extension: str, timestamp: datetime | None = None) -> str:
    moment = (timestamp or datetime.now(UTC_PLUS_8)).astimezone(UTC_PLUS_8)
    return f"{user_uid}-{moment.strftime('%Y%m%d%H%M%S%f')}-{content_sha256[:16]}{extension}"


def is_canonical_user_upload_filename(filename: str, user_uid: int, content_sha256: str | None = None) -> bool:
    match = USER_UPLOAD_FILENAME_RE.match(filename)
    if match is None or int(match.group("uid")) != user_uid:
        return False
    if content_sha256 is not None and match.group("hash") != content_sha256[:16]:
        return False
    return True


def save_upload_file(upload: UploadFile, target_dir: Path, prefix: str) -> Path:
    extension = guess_extension(upload.content_type or upload.filename or "", ".jpg")
    destination = target_dir / f"{prefix}_{uuid4().hex}{extension}"
    ensure_parent(destination)
    with destination.open("wb") as file_handle:
        shutil.copyfileobj(upload.file, file_handle)
    return destination


def save_user_upload_file(upload: UploadFile, target_dir: Path, user_uid: int) -> tuple[Path, str]:
    extension = guess_extension(upload.content_type or upload.filename or "", ".jpg")
    temporary_path = target_dir / f"tmp_{uuid4().hex}{extension}"
    ensure_parent(temporary_path)

    digest = hashlib.sha256()
    with temporary_path.open("wb") as file_handle:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            file_handle.write(chunk)

    try:
        upload.file.seek(0)
    except Exception:
        pass

    content_sha256 = digest.hexdigest()
    final_path = target_dir / build_user_upload_filename(user_uid, content_sha256, extension)
    ensure_parent(final_path)
    temporary_path.replace(final_path)
    return final_path, content_sha256


def relocate_existing_user_upload(
    source_path: Path,
    target_dir: Path,
    user_uid: int,
    timestamp: datetime | None = None,
    content_sha256: str | None = None,
) -> tuple[Path, str]:
    extension = guess_extension(source_path.name, ".jpg")
    file_hash = content_sha256 or hash_file_sha256(source_path)
    try:
        if source_path.resolve().parent == target_dir.resolve() and is_canonical_user_upload_filename(source_path.name, user_uid, file_hash):
            return source_path.resolve(), file_hash
    except FileNotFoundError:
        pass
    target_path = target_dir / build_user_upload_filename(user_uid, file_hash, extension, timestamp=timestamp)
    ensure_parent(target_path)

    try:
        same_path = source_path.resolve() == target_path.resolve()
    except FileNotFoundError:
        same_path = source_path == target_path
    if same_path:
        return target_path, file_hash

    if target_path.exists():
        if hash_file_sha256(target_path) != file_hash:
            raise RuntimeError(f"文件迁移发生命名冲突: {target_path}")
        source_path.unlink(missing_ok=True)
        return target_path, file_hash

    source_path.replace(target_path)
    return target_path, file_hash


def delete_local_file(relative_or_absolute_path: str | None) -> None:
    if not relative_or_absolute_path:
        return
    settings = get_settings()
    path = Path(relative_or_absolute_path)
    if not path.is_absolute():
        path = settings.base_dir / path
    try:
        resolved = path.resolve()
    except FileNotFoundError:
        return
    try:
        resolved.relative_to(settings.base_dir)
    except ValueError:
        return
    resolved.unlink(missing_ok=True)
