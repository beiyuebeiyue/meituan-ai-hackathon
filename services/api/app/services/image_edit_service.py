from __future__ import annotations

from collections.abc import Callable
from functools import lru_cache
from pathlib import Path

from app.providers.openai_image_provider import GeneratedImageResult, OpenAIImageProvider


class ImageEditService:
    def __init__(self, provider: OpenAIImageProvider | None = None) -> None:
        self.provider = provider or OpenAIImageProvider()

    def generate_tryon(
        self,
        hand_image_path: Path,
        style_image_path: Path,
        prompt_text: str,
        roi_boxes: list[dict[str, int]],
        mask_path: Path | None = None,
        progress_callback: Callable[[int], None] | None = None,
    ) -> GeneratedImageResult:
        return self.provider.generate_tryon(
            hand_image_path,
            style_image_path,
            prompt_text,
            roi_boxes,
            mask_path,
            progress_callback=progress_callback,
        )


@lru_cache(maxsize=1)
def get_image_edit_service() -> ImageEditService:
    return ImageEditService()
