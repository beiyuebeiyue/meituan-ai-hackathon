from __future__ import annotations

import mimetypes
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings


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


def guess_extension(url_or_content_type: str, default: str = ".png") -> str:
    if "/" in url_or_content_type and not url_or_content_type.startswith("."):
        extension = mimetypes.guess_extension(url_or_content_type.split(";")[0].strip())
        return extension or default
    path = Path(url_or_content_type)
    if path.suffix:
        return path.suffix.lower()
    return default


def save_upload_file(upload: UploadFile, target_dir: Path, prefix: str) -> Path:
    extension = guess_extension(upload.content_type or upload.filename or "", ".jpg")
    destination = target_dir / f"{prefix}_{uuid4().hex}{extension}"
    ensure_parent(destination)
    with destination.open("wb") as file_handle:
        shutil.copyfileobj(upload.file, file_handle)
    return destination
