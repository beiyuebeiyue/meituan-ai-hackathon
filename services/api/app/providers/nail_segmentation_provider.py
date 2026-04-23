from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw

from app.providers.hand_landmarker_provider import FingertipROI, HandDetectionResult


@dataclass
class SegmentationResult:
    mask_path: Path | None
    roi_boxes: list[dict[str, int]]
    confidence: float


class NailSegmentationProvider:
    def segment(self, image_path: Path, detection: HandDetectionResult) -> SegmentationResult:
        image = Image.open(image_path).convert("RGBA")
        mask = Image.new("L", image.size, 0)
        draw = ImageDraw.Draw(mask)
        roi_boxes: list[dict[str, int]] = []
        for roi in detection.fingertip_rois:
            box = self._box_from_roi(roi)
            roi_boxes.append(box)
            draw.ellipse((box["x"], box["y"], box["x"] + box["width"], box["y"] + box["height"]), fill=255)
        mask_path = image_path.parent / f"{image_path.stem}_mask.png"
        mask.save(mask_path)
        confidence = 0.55 if detection.fingertip_rois else 0.25
        return SegmentationResult(mask_path=mask_path, roi_boxes=roi_boxes, confidence=confidence)

    @staticmethod
    def _box_from_roi(roi: FingertipROI) -> dict[str, int]:
        return {
            "x": roi.x,
            "y": roi.y,
            "width": roi.width,
            "height": roi.height,
        }
