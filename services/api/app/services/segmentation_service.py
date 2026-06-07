from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.providers.nail_segmentation_provider import SegmentationResult
from app.providers.yolo_nail_segmentation_provider import YoloNailSegmentationProvider


class PrimarySegmentationProvider(Protocol):
    def segment(self, image_path: Path) -> SegmentationResult: ...
    def warmup(self) -> None: ...


class SegmentationService:
    def __init__(
        self,
        provider: PrimarySegmentationProvider | None = None,
    ) -> None:
        self.provider = provider or YoloNailSegmentationProvider()

    def segment(self, image_path: Path) -> SegmentationResult:
        return self.provider.segment(image_path)

    def warmup(self) -> None:
        self.provider.warmup()


@lru_cache(maxsize=1)
def get_segmentation_service() -> SegmentationService:
    return SegmentationService()
