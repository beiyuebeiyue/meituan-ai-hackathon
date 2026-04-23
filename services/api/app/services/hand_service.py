from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.providers.hand_landmarker_provider import HandDetectionResult, HandLandmarkerProvider


class HandService:
    def __init__(self, provider: HandLandmarkerProvider | None = None) -> None:
        self.provider = provider or HandLandmarkerProvider()

    def detect(self, image_path: Path) -> HandDetectionResult:
        return self.provider.detect(image_path)


@lru_cache(maxsize=1)
def get_hand_service() -> HandService:
    return HandService()
