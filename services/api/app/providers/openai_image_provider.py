from __future__ import annotations

import base64
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings
from app.utils.files import public_url_for_path


@dataclass
class GeneratedImageResult:
    local_path: Path
    public_url: str
    provider_trace_id: str | None


class OpenAIImageProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None
        if self.settings.openai_api_key:
            try:
                from openai import OpenAI

                kwargs = {"api_key": self.settings.openai_api_key}
                if self.settings.openai_base_url:
                    kwargs["base_url"] = self.settings.openai_base_url
                self._client = OpenAI(**kwargs)
            except Exception:
                self._client = None

    def generate_tryon(
        self,
        hand_image_path: Path,
        style_image_path: Path,
        prompt_text: str,
        roi_boxes: list[dict[str, int]],
        mask_path: Path | None = None,
    ) -> GeneratedImageResult:
        if self._client is not None:
            return self._generate_with_openai(hand_image_path, style_image_path, prompt_text, mask_path)
        raise RuntimeError("OpenAI image provider is not configured")

    def _generate_with_openai(
        self,
        hand_image_path: Path,
        style_image_path: Path,
        prompt_text: str,
        mask_path: Path | None,
    ) -> GeneratedImageResult:
        output_path = self.settings.tryon_result_path / f"tryon_{uuid4().hex}.png"
        prompt = (
            "Keep the hand pose and skin tone from the first image. "
            "Apply the manicure finish, colors, and pattern from the reference nail style image "
            "onto the fingernails only. Preserve realism and mobile-photo lighting. "
            f"Extra preference: {prompt_text or '自然通勤风格'}"
        )
        with hand_image_path.open("rb") as hand_file, style_image_path.open("rb") as style_file:
            image_arg = [hand_file, style_file]
            if mask_path is not None and mask_path.exists():
                with mask_path.open("rb") as mask_file:
                    result = self._client.images.edit(  # type: ignore[union-attr]
                        model=self.settings.openai_image_model,
                        image=image_arg,
                        mask=mask_file,
                        prompt=prompt,
                    )
            else:
                result = self._client.images.edit(  # type: ignore[union-attr]
                    model=self.settings.openai_image_model,
                    image=image_arg,
                    prompt=prompt,
                )
        image_base64 = result.data[0].b64_json
        output_path.write_bytes(base64.b64decode(image_base64))
        return GeneratedImageResult(
            local_path=output_path,
            public_url=public_url_for_path(output_path),
            provider_trace_id=getattr(result, "_request_id", None),
        )
