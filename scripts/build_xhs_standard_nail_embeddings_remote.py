#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSETS_DIR = ROOT / ".openclaw" / "skills" / "xhs-popular-nail-posts-crawler" / "assets"
DEFAULT_FEATURES_NAME = "xhs_image_features.json"
DEFAULT_SPACE_ID = "dongli/nail_embedder"
DEFAULT_API_NAME = "/build_xhs_standard_nail_embeddings"
DEFAULT_EMBEDDING_DIMENSION = 1024
MIN_EMBEDDING_DIMENSION = 64
MAX_EMBEDDING_DIMENSION = 2048
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
REQUIRED_OUTPUT_FILES = {
    "xhs_standard_nail.faiss",
    "xhs_standard_nail_metadata.jsonl",
    "xhs_standard_nail_manifest.json",
}


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def parse_embedding_dimension(value: int | str | None) -> int:
    if value is None or str(value).strip() == "":
        return DEFAULT_EMBEDDING_DIMENSION
    dimension = int(value)
    if not MIN_EMBEDDING_DIMENSION <= dimension <= MAX_EMBEDDING_DIMENSION:
        raise ValueError(
            f"Embedding dimension must be between {MIN_EMBEDDING_DIMENSION} and "
            f"{MAX_EMBEDDING_DIMENSION}, got {dimension}."
        )
    return dimension


def resolve_image_path(assets_dir: Path, image_path_value: str) -> Path | None:
    if not image_path_value:
        return None
    image_path = Path(image_path_value)
    if image_path.is_absolute():
        return image_path if image_path.exists() else None

    candidates = [assets_dir / image_path]
    if image_path.parts and image_path.parts[0] == "assets":
        candidates.insert(0, assets_dir.parent / image_path)
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def slim_features(features: Any) -> dict[str, Any]:
    if not isinstance(features, dict):
        return {}
    result: dict[str, Any] = {}
    for group in ("hand", "nail"):
        value = features.get(group)
        if isinstance(value, dict):
            result[group] = value
    return result


def package_standard_nail_images(assets_dir: Path, output_path: Path, limit: int | None = None) -> dict[str, int]:
    features_path = assets_dir / DEFAULT_FEATURES_NAME
    if not features_path.exists():
        raise FileNotFoundError(f"Missing features file: {features_path}")

    payload = json.loads(features_path.read_text(encoding="utf-8"))
    items = payload.get("items", [])
    if not isinstance(items, list):
        raise ValueError(f"Unsupported features format: {features_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    skipped = 0
    seen_note_ids: set[str] = set()
    metadata_lines: list[str] = []
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in items:
            if limit is not None and written >= limit:
                break
            if not isinstance(item, dict) or item.get("status") != 200:
                skipped += 1
                continue
            note_id = str(item.get("note_id") or "").strip()
            if not note_id or note_id in seen_note_ids:
                skipped += 1
                continue
            image_path = resolve_image_path(assets_dir, str(item.get("image_path") or ""))
            if image_path is None or image_path.suffix.lower() not in IMAGE_EXTENSIONS:
                skipped += 1
                continue

            package_image_path = f"images/{written:06d}_{note_id}{image_path.suffix.lower()}"
            archive.write(image_path, package_image_path)
            metadata_lines.append(
                json.dumps(
                    {
                        "row": written,
                        "note_id": note_id,
                        "run_dir": str(item.get("run_dir") or ""),
                        "image_path": str(item.get("image_path") or ""),
                        "package_image_path": package_image_path,
                        "feature_status": item.get("status"),
                        "features": slim_features(item.get("features")),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
            )
            seen_note_ids.add(note_id)
            written += 1

        archive.writestr("metadata.jsonl", "\n".join(metadata_lines) + ("\n" if metadata_lines else ""))
        archive.writestr(
            "manifest.json",
            json.dumps(
                {"source": "xhs_standard_nail_image", "features_file": DEFAULT_FEATURES_NAME, "count": written},
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            ),
        )
    return {"written": written, "skipped": skipped}


def call_gradio(
    space_id: str,
    package_path: Path,
    api_name: str,
    hf_token: str | None,
    embedding_dimension: int,
) -> tuple[str, Path]:
    try:
        from gradio_client import Client, handle_file
    except ImportError as exc:
        raise RuntimeError("gradio_client is required. Install gradio-client or gradio in this environment.") from exc

    client_kwargs = {"token": hf_token} if hf_token else {}
    client = Client(space_id, **client_kwargs)
    result = client.predict(handle_file(str(package_path)), embedding_dimension, api_name=api_name)
    status, file_value = parse_gradio_result(result)
    local_file = materialize_gradio_file(file_value)
    return status, local_file


def parse_gradio_result(result: Any) -> tuple[str, Any]:
    if isinstance(result, (list, tuple)) and len(result) >= 2:
        return str(result[0]), result[1]
    raise RuntimeError(f"Unexpected Gradio response: {result!r}")


def materialize_gradio_file(file_value: Any) -> Path:
    if isinstance(file_value, dict):
        file_value = file_value.get("path") or file_value.get("name") or file_value.get("url")
    if not file_value:
        raise RuntimeError("Gradio did not return an embedding zip file.")

    text = str(file_value)
    parsed = urlparse(text)
    if parsed.scheme in {"http", "https"}:
        target = Path(tempfile.mkdtemp(prefix="xhs-embedding-download-")) / Path(parsed.path).name
        response = httpx.get(text, follow_redirects=True, timeout=120)
        response.raise_for_status()
        target.write_bytes(response.content)
        return target

    path = Path(text).expanduser()
    if not path.exists():
        raise FileNotFoundError(f"Returned embedding file does not exist: {path}")
    return path


def safe_extract_zip(zip_path: Path, output_dir: Path, clean: bool = True) -> None:
    if clean and output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            destination = (output_dir / member.filename).resolve()
            if output_dir.resolve() not in [destination, *destination.parents]:
                raise ValueError(f"Unsafe zip entry: {member.filename}")
        archive.extractall(output_dir)


def validate_embedding_output(output_dir: Path, expected_embedding_dimension: int | None = None) -> dict[str, Any]:
    names = {path.name for path in output_dir.iterdir() if path.is_file()}
    missing = sorted(REQUIRED_OUTPUT_FILES - names)
    if missing:
        raise FileNotFoundError(f"Embedding output missing required files: {', '.join(missing)}")

    manifest = json.loads((output_dir / "xhs_standard_nail_manifest.json").read_text(encoding="utf-8"))
    metadata_text = (output_dir / "xhs_standard_nail_metadata.jsonl").read_text(encoding="utf-8")
    metadata_lines = [line for line in metadata_text.splitlines() if line.strip()]
    count = int(manifest.get("count") or 0)
    if count != len(metadata_lines):
        raise ValueError(f"Manifest count {count} does not match metadata rows {len(metadata_lines)}")
    for key in ("model", "dimension", "count"):
        if key not in manifest:
            raise ValueError(f"Manifest missing required key: {key}")
    dimension = int(manifest["dimension"])
    if expected_embedding_dimension is not None and dimension != expected_embedding_dimension:
        raise ValueError(f"Expected embedding dimension {expected_embedding_dimension}, got {dimension}.")
    return {"count": count, "model": manifest["model"], "dimension": dimension}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build XHS standard nail FAISS embeddings through a remote Gradio Space."
    )
    parser.add_argument(
        "--assets-dir",
        type=Path,
        default=DEFAULT_ASSETS_DIR,
        help=f"XHS crawler assets dir. Default: {DEFAULT_ASSETS_DIR}",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Where to extract embedding artifacts. Default: <assets-dir>/embeddings",
    )
    parser.add_argument(
        "--space-id",
        default=None,
        help=f"Gradio Space id. Default env XHS_EMBEDDING_GRADIO_SPACE_ID or {DEFAULT_SPACE_ID}",
    )
    parser.add_argument("--api-name", default=DEFAULT_API_NAME, help=f"Gradio API name. Default: {DEFAULT_API_NAME}")
    parser.add_argument(
        "--embedding-dimension",
        default=None,
        help=f"Qwen MRL embedding dimension. Default env XHS_EMBEDDING_DIMENSION or {DEFAULT_EMBEDDING_DIMENSION}",
    )
    parser.add_argument(
        "--package-path",
        type=Path,
        default=None,
        help="Optional path for the generated image package zip.",
    )
    parser.add_argument(
        "--download-path",
        type=Path,
        default=None,
        help="Optional path to copy the returned embedding zip.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Optional image limit for smoke tests.")
    parser.add_argument("--package-only", action="store_true", help="Only create the package zip; do not call Gradio.")
    parser.add_argument(
        "--keep-package",
        action="store_true",
        help="Keep the generated package zip when using the default temp path.",
    )
    parser.add_argument(
        "--no-clean",
        action="store_true",
        help="Do not remove the existing output directory before extracting.",
    )
    return parser.parse_args()


def main() -> None:
    load_env_file(ROOT / ".env")
    args = parse_args()
    assets_dir = args.assets_dir.expanduser().resolve()
    output_dir = (args.output_dir or (assets_dir / "embeddings")).expanduser().resolve()
    space_id = args.space_id or os.environ.get("XHS_EMBEDDING_GRADIO_SPACE_ID") or DEFAULT_SPACE_ID
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    embedding_dimension = parse_embedding_dimension(
        args.embedding_dimension or os.environ.get("XHS_EMBEDDING_DIMENSION")
    )

    temporary_package = args.package_path is None
    if args.package_path:
        package_path = args.package_path.expanduser().resolve()
    else:
        package_path = Path(tempfile.mkdtemp(prefix="xhs-standard-nail-")) / "xhs_standard_nail_images.zip"
    package_summary = package_standard_nail_images(assets_dir, package_path, args.limit)
    print(
        json.dumps(
            {"stage": "packaged", "package": str(package_path), **package_summary},
            ensure_ascii=False,
            indent=2,
        ),
        flush=True,
    )
    if args.package_only:
        return

    status, returned_zip = call_gradio(space_id, package_path, args.api_name, hf_token, embedding_dimension)
    print(
        json.dumps(
            {"stage": "remote_finished", "status": status, "returned_zip": str(returned_zip)},
            ensure_ascii=False,
            indent=2,
        ),
        flush=True,
    )

    if args.download_path:
        download_path = args.download_path.expanduser().resolve()
        download_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(returned_zip, download_path)
        returned_zip = download_path

    safe_extract_zip(returned_zip, output_dir, clean=not args.no_clean)
    validation = validate_embedding_output(output_dir, expected_embedding_dimension=embedding_dimension)
    print(
        json.dumps({"stage": "extracted", "output_dir": str(output_dir), **validation}, ensure_ascii=False, indent=2),
        flush=True,
    )

    if temporary_package and not args.keep_package:
        shutil.rmtree(package_path.parent, ignore_errors=True)


if __name__ == "__main__":
    main()
