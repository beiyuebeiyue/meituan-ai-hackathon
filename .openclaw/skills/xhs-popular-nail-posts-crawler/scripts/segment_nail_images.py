#!/usr/bin/env python3
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image
import torch
from ultralytics import YOLO

from scripts.utils import load_json, save_json

IMAGE_EXTENSIONS = {".webp", ".jpg", ".jpeg", ".png"}
MODEL_PATH = Path(__file__).resolve().parents[1] / "spaces" / "nail_yolo26" / "best.pt"


def image_paths(note_dir):
    return sorted(path for path in note_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS)


def all_images(images_dir):
    rows = []
    for note_dir in sorted(path for path in images_dir.iterdir() if path.is_dir()):
        if note_dir.name == "masks":
            continue
        for image_path in image_paths(note_dir):
            rows.append((note_dir, image_path))
    return rows


def chunks(rows, size):
    for index in range(0, len(rows), size):
        yield rows[index : index + size]


def save_mask(result, image_path, output_path):
    with Image.open(image_path) as image:
        size = image.size
    if result.masks is None:
        mask = np.zeros((size[1], size[0]), dtype=np.uint8)
    else:
        masks = result.masks.data.cpu().numpy()
        mask = (masks.max(axis=0) > 0.5).astype(np.uint8) * 255
        if mask.shape != (size[1], size[0]):
            mask = np.array(Image.fromarray(mask).resize(size, Image.Resampling.NEAREST))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(mask).save(output_path, format="WEBP")


def standard_nail_image(rows):
    for row in reversed(rows):
        if row["nail_count"] == 5:
            return row["image"]
    return ""


def standard_nail_image_path(run_dir, note_id, image_name):
    return f"assets/{run_dir}/images/{note_id}/{image_name}" if image_name else ""


def update_digest_standard_nail_images(run_root, standard_images):
    digest_path = run_root / "xhs_note_digest.json"
    if not digest_path.exists():
        return

    digest = load_json(digest_path)
    for note in digest["notes"]:
        note_id = note["note_id"]
        note["standard_nail_image"] = standard_nail_image_path(
            digest["run_dir"],
            note_id,
            standard_images.get(note_id, ""),
        )
    save_json(digest_path, digest)


def main():
    run_root = Path(os.environ["RUN_ROOT"])
    images_dir = Path(os.environ["IMAGES_DIR"])
    batch_size = int(os.environ.get("NAIL_SEG_BATCH_SIZE", "8"))
    device = os.environ.get("NAIL_SEG_DEVICE") or (0 if torch.cuda.is_available() else "cpu")
    model = YOLO(str(MODEL_PATH))
    note_rows = {}

    rows = all_images(images_dir)
    for batch in chunks(rows, batch_size):
        paths = [str(image_path) for _note_dir, image_path in batch]
        results = model.predict(
            source=paths,
            imgsz=640,
            conf=0.25,
            iou=0.7,
            retina_masks=True,
            batch=batch_size,
            device=device,
            verbose=False,
        )
        for (note_dir, image_path), result in zip(batch, results):
            nail_count = 0 if result.boxes is None else len(result.boxes)
            note_rows.setdefault(note_dir, []).append({"image": image_path.name, "nail_count": nail_count})
            if nail_count > 0:
                save_mask(result, image_path, note_dir / "masks" / f"{image_path.stem}_mask.webp")

    reports = []
    standard_images = {}
    for note_dir, rows_for_note in sorted(note_rows.items(), key=lambda item: item[0].name):
        has_nail = any(row["nail_count"] > 0 for row in rows_for_note)
        result = {
            "has_nail": "yes" if has_nail else "no",
            "standard_nail_image": standard_nail_image(rows_for_note),
        }
        if has_nail:
            result["images"] = rows_for_note
        save_json(note_dir / "result.json", result)
        standard_images[note_dir.name] = result["standard_nail_image"]
        reports.append({"note_id": note_dir.name, "has_nail": result["has_nail"], "image_count": len(rows_for_note)})

    update_digest_standard_nail_images(run_root, standard_images)

    print(
        json.dumps(
            {
                "images_dir": str(images_dir),
                "model_path": str(MODEL_PATH),
                "batch_size": batch_size,
                "device": str(device),
                "note_count": len(reports),
                "image_count": len(rows),
                "notes": reports,
            },
            ensure_ascii=False,
        )
    )


main()
