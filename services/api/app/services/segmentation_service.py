from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.providers.hand_landmarker_provider import HandDetectionResult
from app.providers.nail_segmentation_provider import NailSegmentationProvider, SegmentationResult


class SegmentationService:
    def __init__(self, provider: NailSegmentationProvider | None = None) -> None:
        self.provider = provider or NailSegmentationProvider()

    def segment(self, image_path: Path, detection: HandDetectionResult) -> SegmentationResult:
        return self.provider.segment(image_path, detection)


@lru_cache(maxsize=1)
def get_segmentation_service() -> SegmentationService:
    return SegmentationService()
