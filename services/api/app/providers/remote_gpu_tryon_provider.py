from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.utils.files import public_url_for_path


@dataclass
class RemoteGpuTryOnResult:
    local_path: Path
    public_url: str
    provider_trace_id: str | None
    artifacts: dict[str, object]


class RemoteGpuTryOnProvider:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def is_configured(self) -> bool:
        return bool(self.settings.remote_gpu_tryon_url.strip())

    def render_tryon(
        self,
        *,
        job_id: str,
        hand_image_path: Path,
        style_image_path: Path,
        prompt_text: str,
        cached_user_artifact: dict[str, object] | None = None,
        cached_style_artifact: dict[str, object] | None = None,
    ) -> RemoteGpuTryOnResult:
        if not self.is_configured:
            raise RuntimeError("远程 GPU 焕甲服务未配置")

        headers: dict[str, str] = {}
        if self.settings.remote_gpu_tryon_api_key:
            headers["Authorization"] = f"Bearer {self.settings.remote_gpu_tryon_api_key}"

        data = {
            "job_id": job_id,
            "prompt": prompt_text,
            "pipeline_version": self.settings.image_pipeline_version,
            "openai_image_model": self.settings.openai_image_model,
            "cached_user_artifact": json.dumps(cached_user_artifact or {}, ensure_ascii=False),
            "cached_style_artifact": json.dumps(cached_style_artifact or {}, ensure_ascii=False),
        }
        with hand_image_path.open("rb") as hand_file, style_image_path.open("rb") as style_file:
            files = {
                "user_hand_image": (hand_image_path.name, hand_file, "application/octet-stream"),
                "style_image": (style_image_path.name, style_file, "application/octet-stream"),
            }
            with httpx.Client(timeout=self.settings.remote_gpu_tryon_timeout_seconds) as client:
                response = client.post(
                    self.settings.remote_gpu_tryon_url,
                    data=data,
                    files=files,
                    headers=headers,
                )

        if response.status_code >= 400:
            raise RuntimeError(f"远程 GPU 服务失败: HTTP {response.status_code} {response.text[:300]}")

        payload = response.json()
        if payload.get("code", 0) != 0 or payload.get("status") != "succeeded":
            message = payload.get("message") or payload.get("error") or "远程 GPU 服务返回失败"
            raise RuntimeError(str(message))

        result_image_b64 = payload.get("result_image_b64")
        if not isinstance(result_image_b64, str) or not result_image_b64:
            raise RuntimeError("远程 GPU 服务未返回结果图片")

        output_path = self.settings.tryon_result_path / f"tryon_{uuid4().hex}.png"
        output_path.write_bytes(base64.b64decode(result_image_b64))
        artifacts = payload.get("artifacts")
        return RemoteGpuTryOnResult(
            local_path=output_path,
            public_url=public_url_for_path(output_path),
            provider_trace_id=response.headers.get("x-request-id") or payload.get("trace_id"),
            artifacts=artifacts if isinstance(artifacts, dict) else {},
        )
