from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image

from app.core.config import Settings, get_settings
from app.providers.nail_segmentation_provider import NailSegmentationNoNailsError, SegmentationResult


class YoloNailSegmentationProvider:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._model: Any | None = None

    def segment(self, image_path: Path) -> SegmentationResult:
        model = self._load_model()
        image = Image.open(image_path).convert("RGB")
        original_size = image.size

        predict_kwargs: dict[str, object] = {
            "source": str(image_path),
            "imgsz": self.settings.nail_yolo_imgsz,
            "conf": self.settings.nail_yolo_confidence,
            "iou": self.settings.nail_yolo_iou,
            "retina_masks": True,
            "verbose": False,
        }
        if self.settings.nail_yolo_device.strip():
            predict_kwargs["device"] = self.settings.nail_yolo_device.strip()

        results = model.predict(**predict_kwargs)
        if not results:
            return self._empty_result(image_path, original_size)

        result = results[0]
        mask = self._mask_from_result(result, original_size)
        boxes, confidence = self._boxes_from_result(result, original_size)
        if not boxes:
            mask_box = mask.getbbox()
            if mask_box is not None:
                x1, y1, x2, y2 = mask_box
                boxes = [{"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1}]
                confidence = max(confidence, 0.5)

        if not boxes:
            raise NailSegmentationNoNailsError("没有检测到清晰的指甲，请重新上传一张手部照片")

        mask_path = image_path.parent / f"{image_path.stem}_yolo_mask.png"
        self._save_alpha_mask(mask, mask_path)
        return SegmentationResult(mask_path=mask_path, roi_boxes=boxes, confidence=confidence)

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model

        model_path = self._resolve_model_path()
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError("本地 YOLO 分割依赖未安装：缺少 ultralytics") from exc

        self._model = YOLO(str(model_path))
        return self._model

    def _resolve_model_path(self) -> Path:
        configured = self.settings.nail_yolo_model_path.strip()
        candidates: list[Path] = []
        if configured:
            candidates.append(self.settings.resolve_path(configured))

        base_dir = self.settings.base_dir
        candidates.extend(
            [
                base_dir / ".openclaw/skills/xhs-popular-nail-posts-crawler/spaces/nail_yolo26/best.pt",
                base_dir / ".openclaw/workspace/skills/xhs-popular-nail-posts-crawler/spaces/nail_yolo26/best.pt",
                base_dir / "deploy/hf-openclaw/skills/xhs-popular-nail-posts-crawler/spaces/nail_yolo26/best.pt",
            ]
        )

        for candidate in candidates:
            if candidate.exists():
                return candidate

        searched = ", ".join(str(path) for path in candidates)
        raise FileNotFoundError(f"未找到本地 YOLO 模型 best.pt，已检查：{searched}")

    @staticmethod
    def _mask_from_result(result: Any, original_size: tuple[int, int]) -> Image.Image:
        mask = Image.new("L", original_size, 0)
        if result.masks is None or result.masks.data is None:
            return mask

        import numpy as np

        masks = result.masks.data.detach().cpu().numpy()
        if masks.size == 0:
            return mask

        combined = (masks.max(axis=0) > 0.5).astype(np.uint8) * 255
        mask = Image.fromarray(combined, mode="L")
        if mask.size != original_size:
            mask = mask.resize(original_size, Image.Resampling.NEAREST)
        return mask

    @staticmethod
    def _boxes_from_result(result: Any, original_size: tuple[int, int]) -> tuple[list[dict[str, int]], float]:
        if result.boxes is None or result.boxes.xyxy is None:
            return [], 0.0

        width, height = original_size
        xyxy = result.boxes.xyxy.detach().cpu().numpy()
        conf_values = result.boxes.conf.detach().cpu().numpy() if result.boxes.conf is not None else []
        boxes: list[dict[str, int]] = []
        for row in xyxy:
            x1, y1, x2, y2 = row[:4]
            left = max(0, min(width, int(round(float(x1)))))
            top = max(0, min(height, int(round(float(y1)))))
            right = max(0, min(width, int(round(float(x2)))))
            bottom = max(0, min(height, int(round(float(y2)))))
            if right > left and bottom > top:
                boxes.append({"x": left, "y": top, "width": right - left, "height": bottom - top})

        if len(conf_values) == 0:
            confidence = 0.7 if boxes else 0.0
        else:
            confidence = float(conf_values.mean())
        return boxes, confidence

    @staticmethod
    def _empty_result(image_path: Path, original_size: tuple[int, int]) -> SegmentationResult:
        mask_path = image_path.parent / f"{image_path.stem}_yolo_mask.png"
        YoloNailSegmentationProvider._save_alpha_mask(Image.new("L", original_size, 0), mask_path)
        return SegmentationResult(mask_path=mask_path, roi_boxes=[], confidence=0.0)

    @staticmethod
    def _save_alpha_mask(mask: Image.Image, mask_path: Path) -> None:
        grayscale = mask.convert("L")
        mask_rgba = grayscale.convert("RGBA")
        mask_rgba.putalpha(grayscale)
        mask_rgba.save(mask_path, format="PNG")
