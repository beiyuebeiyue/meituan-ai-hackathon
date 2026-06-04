from __future__ import annotations

import base64
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from openai import OpenAI
from PIL import Image, ImageDraw


app = FastAPI(title="焕甲 GPU Try-on Service", version="0.1.0")


@dataclass
class HandAnalysis:
    landmarks: list[dict[str, float]]
    roi_boxes: list[dict[str, int]]
    hand_box: dict[str, int]
    quality_score: float


def _read_cached_artifact(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
        return payload if isinstance(payload, dict) else {}
    except json.JSONDecodeError:
        return {}


def _write_upload(upload: UploadFile, path: Path) -> None:
    with path.open("wb") as target:
        target.write(upload.file.read())


def _b64_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def _decode_b64_file(value: str, path: Path) -> None:
    path.write_bytes(base64.b64decode(value))


def detect_hand_landmarks(image_path: Path, cached: dict[str, Any] | None = None) -> HandAnalysis:
    cached = cached or {}
    if cached.get("landmarks") and cached.get("roi_boxes"):
        roi_boxes = cached["roi_boxes"]
        return HandAnalysis(
            landmarks=cached["landmarks"],
            roi_boxes=roi_boxes,
            hand_box=_hand_box_from_rois(roi_boxes, Image.open(image_path).size),
            quality_score=float(cached.get("quality_score") or 0.9),
        )

    try:
        import mediapipe as mp
    except Exception as exc:  # pragma: no cover - deployed GPU env concern
        raise RuntimeError("MediaPipe 未安装，无法检测手部关键点") from exc

    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    array = np.array(image)
    hands = mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=1, min_detection_confidence=0.45)
    result = hands.process(array)
    hands.close()
    if not result.multi_hand_landmarks:
        raise RuntimeError("未检测到清晰手部，请换一张手部照片")

    points = result.multi_hand_landmarks[0].landmark
    landmarks = [{"x": point.x, "y": point.y} for point in points]
    fingertip_indices = [4, 8, 12, 16, 20]
    roi_boxes: list[dict[str, int]] = []
    for index in fingertip_indices:
        point = points[index]
        roi_width = max(int(width * 0.09), 28)
        roi_height = max(int(height * 0.08), 28)
        center_x = int(point.x * width)
        center_y = int(point.y * height)
        roi_boxes.append(
            {
                "x": max(center_x - roi_width // 2, 0),
                "y": max(center_y - roi_height // 2, 0),
                "width": min(roi_width, width),
                "height": min(roi_height, height),
            }
        )
    return HandAnalysis(
        landmarks=landmarks,
        roi_boxes=roi_boxes,
        hand_box=_hand_box_from_landmarks(landmarks, width, height),
        quality_score=0.9,
    )


def segment_with_sam31(image_path: Path, hand_box: dict[str, int], cached: dict[str, Any] | None = None) -> tuple[Path, Path]:
    cached = cached or {}
    work_dir = image_path.parent
    mask_path = work_dir / f"{image_path.stem}_sam31_mask.png"
    cutout_path = work_dir / f"{image_path.stem}_sam31_cutout.png"

    if cached.get("mask_b64") and cached.get("cutout_b64"):
        _decode_b64_file(str(cached["mask_b64"]), mask_path)
        _decode_b64_file(str(cached["cutout_b64"]), cutout_path)
        return mask_path, cutout_path

    sam_endpoint = os.getenv("SAM31_ENDPOINT", "").strip()
    if sam_endpoint:
        with image_path.open("rb") as image_file:
            response = httpx.post(
                sam_endpoint,
                data={"box": json.dumps(hand_box)},
                files={"image": (image_path.name, image_file, "application/octet-stream")},
                timeout=float(os.getenv("SAM31_TIMEOUT_SECONDS", "120")),
            )
        if response.status_code >= 400:
            raise RuntimeError(f"SAM3.1 服务失败: HTTP {response.status_code} {response.text[:300]}")
        payload = response.json()
        _decode_b64_file(payload["mask_b64"], mask_path)
        _decode_b64_file(payload["cutout_b64"], cutout_path)
        return mask_path, cutout_path

    if os.getenv("ALLOW_HEURISTIC_SAM_FALLBACK", "true").lower() not in {"1", "true", "yes"}:
        raise RuntimeError("SAM31_ENDPOINT 未配置")
    return _create_box_mask_cutout(image_path, hand_box, mask_path, cutout_path)


def generate_with_openai(
    user_hand_path: Path,
    style_cutout_path: Path,
    user_analysis: HandAnalysis,
    prompt: str,
    output_path: Path,
    model: str,
) -> None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY 未配置")

    mask_path = _create_nail_edit_mask(user_hand_path, user_analysis.roi_boxes)
    base_url = os.getenv("OPENAI_BASE_URL", "").strip()
    client_kwargs = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = base_url
    client = OpenAI(**client_kwargs)
    edit_prompt = (
        "Edit the first image. Preserve the hand pose, skin tone, lighting, and background from the first image. "
        "Apply only the manicure style, color, nail finish, and nail pattern from the second image to the fingernails. "
        "Keep the result photorealistic. "
        f"User preference: {prompt or '自然显白'}"
    )
    with user_hand_path.open("rb") as user_file, style_cutout_path.open("rb") as style_file, mask_path.open("rb") as mask_file:
        result = client.images.edit(
            model=model,
            image=[user_file, style_file],
            mask=mask_file,
            prompt=edit_prompt,
        )
    image_base64 = result.data[0].b64_json
    output_path.write_bytes(base64.b64decode(image_base64))


@app.post("/v1/tryon/render")
def render_tryon(
    user_hand_image: UploadFile = File(...),
    style_image: UploadFile = File(...),
    prompt: str = Form(default=""),
    job_id: str = Form(default=""),
    pipeline_version: str = Form(default="mediapipe-sam31-v1"),
    openai_image_model: str = Form(default="gpt-image-1.5"),
    cached_user_artifact: str | None = Form(default=None),
    cached_style_artifact: str | None = Form(default=None),
) -> dict[str, Any]:
    del pipeline_version
    user_cached = _read_cached_artifact(cached_user_artifact)
    style_cached = _read_cached_artifact(cached_style_artifact)
    try:
        with tempfile.TemporaryDirectory(prefix=f"tryon_{job_id or 'job'}_") as temp_dir:
            temp_path = Path(temp_dir)
            user_hand_path = temp_path / "user_hand.png"
            style_path = temp_path / "style.png"
            result_path = temp_path / "result.png"
            _write_upload(user_hand_image, user_hand_path)
            _write_upload(style_image, style_path)

            user_analysis = detect_hand_landmarks(user_hand_path, user_cached)
            style_analysis = detect_hand_landmarks(style_path, style_cached)
            style_mask_path, style_cutout_path = segment_with_sam31(style_path, style_analysis.hand_box, style_cached)
            generate_with_openai(user_hand_path, style_cutout_path, user_analysis, prompt, result_path, openai_image_model)

            return {
                "code": 0,
                "status": "succeeded",
                "result_image_b64": _b64_file(result_path),
                "artifacts": {
                    "user_hand_landmarks": user_analysis.landmarks,
                    "user_hand_roi_boxes": user_analysis.roi_boxes,
                    "user_hand_quality_score": user_analysis.quality_score,
                    "style_hand_landmarks": style_analysis.landmarks,
                    "style_hand_roi_boxes": style_analysis.roi_boxes,
                    "style_hand_quality_score": style_analysis.quality_score,
                    "style_hand_mask_b64": _b64_file(style_mask_path),
                    "style_hand_cutout_b64": _b64_file(style_cutout_path),
                },
            }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _hand_box_from_landmarks(landmarks: list[dict[str, float]], width: int, height: int) -> dict[str, int]:
    xs = [point["x"] * width for point in landmarks]
    ys = [point["y"] * height for point in landmarks]
    pad_x = width * 0.08
    pad_y = height * 0.08
    x0 = max(int(min(xs) - pad_x), 0)
    y0 = max(int(min(ys) - pad_y), 0)
    x1 = min(int(max(xs) + pad_x), width)
    y1 = min(int(max(ys) + pad_y), height)
    return {"x": x0, "y": y0, "width": max(x1 - x0, 1), "height": max(y1 - y0, 1)}


def _hand_box_from_rois(roi_boxes: list[dict[str, int]], size: tuple[int, int]) -> dict[str, int]:
    width, height = size
    x0 = max(min(box["x"] for box in roi_boxes), 0)
    y0 = max(min(box["y"] for box in roi_boxes), 0)
    x1 = min(max(box["x"] + box["width"] for box in roi_boxes), width)
    y1 = min(max(box["y"] + box["height"] for box in roi_boxes), height)
    return {"x": x0, "y": y0, "width": max(x1 - x0, 1), "height": max(y1 - y0, 1)}


def _create_box_mask_cutout(image_path: Path, box: dict[str, int], mask_path: Path, cutout_path: Path) -> tuple[Path, Path]:
    image = Image.open(image_path).convert("RGBA")
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(
        (box["x"], box["y"], box["x"] + box["width"], box["y"] + box["height"]),
        radius=max(12, min(box["width"], box["height"]) // 12),
        fill=255,
    )
    mask.save(mask_path)
    cutout = image.copy()
    cutout.putalpha(mask)
    cutout.save(cutout_path)
    return mask_path, cutout_path


def _create_nail_edit_mask(image_path: Path, roi_boxes: list[dict[str, int]]) -> Path:
    image = Image.open(image_path).convert("RGBA")
    # OpenAI image edits use transparent mask regions as editable areas.
    mask = Image.new("RGBA", image.size, (255, 255, 255, 255))
    draw = ImageDraw.Draw(mask)
    for box in roi_boxes:
        draw.ellipse(
            (box["x"], box["y"], box["x"] + box["width"], box["y"] + box["height"]),
            fill=(0, 0, 0, 0),
        )
    mask_path = image_path.parent / f"{image_path.stem}_edit_mask.png"
    mask.save(mask_path)
    return mask_path
