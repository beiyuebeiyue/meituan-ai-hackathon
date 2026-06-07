from __future__ import annotations

import base64
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
import time
from typing import Any
from uuid import uuid4

import httpx

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
        self._evolink_token = self.settings.evolink_api_key or self.settings.openai_api_key
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
        progress_callback: Callable[[int], None] | None = None,
    ) -> GeneratedImageResult:
        if self._evolink_token:
            return self._generate_with_evolink(hand_image_path, style_image_path, prompt_text, mask_path, progress_callback)
        if self._client is not None:
            return self._generate_with_openai(hand_image_path, style_image_path, prompt_text, mask_path)
        raise RuntimeError("OpenAI image provider is not configured")

    def _generate_with_evolink(
        self,
        hand_image_path: Path,
        style_image_path: Path,
        prompt_text: str,
        mask_path: Path | None,
        progress_callback: Callable[[int], None] | None,
    ) -> GeneratedImageResult:
        if mask_path is None or not mask_path.exists():
            raise RuntimeError("没有检测到可用的指甲 mask，请重新上传一张手部照片")

        output_path = self.settings.tryon_result_path / f"tryon_{uuid4().hex}.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        hand_image_url = public_url_for_path(hand_image_path)
        style_image_url = public_url_for_path(style_image_path)
        mask_url = public_url_for_path(mask_path)
        payload: dict[str, Any] = {
            "model": self.settings.evolink_image_model,
            "prompt": self._tryon_prompt(prompt_text),
            "image_urls": [hand_image_url, style_image_url],
            "mask_url": mask_url,
            "quality": self.settings.evolink_image_quality,
            "size": self.settings.evolink_image_size,
            "resolution": self.settings.evolink_image_resolution,
            "n": 1,
        }
        create_url = f"{self.settings.evolink_api_base_url.rstrip('/')}/v1/images/generations"
        headers = {
            "Authorization": f"Bearer {self._evolink_token}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            response = client.post(create_url, json=payload, headers=headers)
            response.raise_for_status()
            created = response.json()
            self._emit_evolink_progress(created, progress_callback)
            image_payload = self._extract_evolink_image_payload(created)
            provider_trace_id = self._extract_trace_id(created)
            if image_payload is None:
                task_id = created.get("id") or created.get("task_id")
                if isinstance(task_id, str) and task_id:
                    image_payload = self._poll_evolink_task(client, task_id, headers, progress_callback)
                    provider_trace_id = provider_trace_id or task_id
            if image_payload is None:
                raise RuntimeError(f"EvoLink 没有返回可用图片：{created}")

            self._write_evolink_image(image_payload, output_path, client)

        return GeneratedImageResult(
            local_path=output_path,
            public_url=public_url_for_path(output_path),
            provider_trace_id=provider_trace_id,
        )

    def _tryon_prompt(self, prompt_text: str) -> str:
        base_prompt = (
            "Use Image 1 as the target hand image, Image 2 as the nail design reference, and the mask as the editable nail area. "
            "Keep all unmasked parts of Image 1 unchanged, including the hand, skin, pose, lighting, background, and camera angle. "
            "Transfer only the nail design from Image 2 onto the masked nail regions of Image 1. "
            "Adapt the design naturally to each nail's shape, angle, curvature, perspective, and lighting, "
            "so it looks realistic and originally applied to the hand.\n\n"
            "Negative Prompt:\n"
            "Do not change any unmasked area. Do not alter the hand shape, finger count, skin tone, background, lighting, or camera angle. "
            "Do not copy the hand or background from Image 2. Avoid distorted nails, floating decorations, blurry details, pasted edges, "
            "and unrealistic reflections."
        )
        if not prompt_text:
            return base_prompt
        return f"{base_prompt}\n\nUser preference: {prompt_text}"

    def _poll_evolink_task(
        self,
        client: httpx.Client,
        task_id: str,
        headers: dict[str, str],
        progress_callback: Callable[[int], None] | None,
    ) -> Any | None:
        task_url = f"{self.settings.evolink_api_base_url.rstrip('/')}/v1/tasks/{task_id}"
        deadline = time.monotonic() + self.settings.evolink_poll_timeout_seconds
        while time.monotonic() < deadline:
            time.sleep(max(0.5, self.settings.evolink_poll_interval_seconds))
            response = client.get(task_url, headers=headers)
            response.raise_for_status()
            payload = response.json()
            self._emit_evolink_progress(payload, progress_callback)
            image_payload = self._extract_evolink_image_payload(payload)
            if image_payload is not None:
                return image_payload
            if payload.get("status") in {"failed", "cancelled", "canceled"}:
                raise RuntimeError(f"EvoLink 图片生成失败：{payload}")
        raise RuntimeError(f"EvoLink 图片生成超时：{task_id}")

    @staticmethod
    def _emit_evolink_progress(payload: Any, progress_callback: Callable[[int], None] | None) -> None:
        if progress_callback is None or not isinstance(payload, dict):
            return
        progress = payload.get("progress")
        if not isinstance(progress, int):
            return
        progress_callback(max(0, min(100, progress)))

    def _extract_evolink_image_payload(self, payload: Any) -> Any | None:
        if not isinstance(payload, dict):
            return None
        data = payload.get("data")
        if isinstance(data, list) and data:
            first = data[0]
            if isinstance(first, dict):
                return first.get("b64_json") or first.get("url") or first.get("image_url") or first.get("base64")
            return first
        for key in ("b64_json", "image", "image_url", "url", "result", "output", "results", "result_data"):
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value
            if isinstance(value, list) and value:
                first = value[0]
                if isinstance(first, dict):
                    return first.get("b64_json") or first.get("url") or first.get("image_url") or first.get("base64")
                return first
            if isinstance(value, dict):
                nested = self._extract_evolink_image_payload(value)
                if nested is not None:
                    return nested
        return None

    @staticmethod
    def _extract_trace_id(payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None
        for key in ("id", "task_id", "request_id"):
            value = payload.get(key)
            if isinstance(value, str) and value:
                return value
        return None

    @staticmethod
    def _write_evolink_image(image_payload: Any, output_path: Path, client: httpx.Client) -> None:
        if not isinstance(image_payload, str) or not image_payload:
            raise RuntimeError(f"EvoLink 返回的图片格式不可用：{image_payload}")
        if image_payload.startswith(("http://", "https://")):
            response = client.get(image_payload)
            response.raise_for_status()
            output_path.write_bytes(response.content)
            return
        if image_payload.startswith("data:image"):
            image_payload = image_payload.split(",", 1)[-1]
        output_path.write_bytes(base64.b64decode(image_payload))

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
