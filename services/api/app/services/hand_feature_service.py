from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import UploadFile

from app.core.config import get_settings

FINGER_SHAPE_VALUES = ("修长", "均衡", "敦实")
SKIN_UNDERTONE_VALUES = ("暖", "冷", "中性")
CONFIDENCE_VALUES = ("低", "中", "高")


class HandFeatureError(ValueError):
    pass


class HandFeatureService:
    def analyze_upload(self, upload: UploadFile) -> dict[str, str]:
        suffix = Path(upload.filename or "").suffix or ".jpg"
        with NamedTemporaryFile(suffix=suffix) as temporary:
            while chunk := upload.file.read(1024 * 1024):
                temporary.write(chunk)
            temporary.flush()
            try:
                upload.file.seek(0)
            except Exception:
                pass
            return self.analyze_path(Path(temporary.name))

    def analyze_path(self, image_path: Path) -> dict[str, str]:
        settings = get_settings()
        if not settings.longcat_api_key:
            raise HandFeatureError("小嘉暂时无法分析手图，请稍后再试")

        content = self._complete(
            api_key=settings.longcat_api_key,
            base_url=settings.longcat_base_url,
            model=settings.longcat_multimodal_model,
            image_path=image_path,
        )
        parsed = _parse_json(content)
        if parsed.get("status") == "failed":
            raise HandFeatureError(str(parsed.get("error") or "这张手图暂时无法识别"))

        features = parsed.get("features")
        hand = features.get("hand") if isinstance(features, dict) else None
        if not isinstance(hand, dict):
            raise HandFeatureError("手图特征解析失败")

        result = {
            "finger_shape": _enum_value(hand.get("finger_shape"), FINGER_SHAPE_VALUES),
            "skin_undertone": _enum_value(hand.get("skin_undertone"), SKIN_UNDERTONE_VALUES),
            "confidence": _enum_value(hand.get("confidence"), CONFIDENCE_VALUES, default="低"),
        }
        if not result["finger_shape"] or not result["skin_undertone"]:
            raise HandFeatureError("手图特征不完整")
        return result

    def _complete(self, api_key: str, base_url: str, model: str, image_path: Path) -> str:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": "你是手部视觉特征标注助手。只输出严格 JSON，不要 markdown，不要解释。",
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_image",
                            "input_image": {
                                "type": "base64",
                                "data": [base64.b64encode(image_path.read_bytes()).decode("ascii")],
                            },
                        },
                        {"type": "text", "text": _prompt()},
                    ],
                },
            ],
            "temperature": 0.1,
            "max_tokens": 500,
            "stream": False,
            "output_modalities": ["text"],
        }
        response = httpx.post(
            _chat_completions_url(base_url),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"].get("content") or ""


def _prompt() -> str:
    return (
        "请只根据图片判断用户手部特征，不要提取美甲、指甲款式、颜色或装饰。\n"
        "如果图片不是清晰手图、手部主体太小、看不清手指比例或肤色倾向，返回 failed。\n"
        "必须使用英文双引号，禁止 markdown、注释、null、unknown、多余 key。\n"
        f"finger_shape 只能选：{' | '.join(FINGER_SHAPE_VALUES)}。\n"
        f"skin_undertone 只能选：{' | '.join(SKIN_UNDERTONE_VALUES)}。\n"
        f"confidence 只能选：{' | '.join(CONFIDENCE_VALUES)}。\n"
        '成功格式：{"status":"succeeded","error":"","features":{"hand":{"finger_shape":"修长 | 均衡 | 敦实","skin_undertone":"暖 | 冷 | 中性","confidence":"低 | 中 | 高"}}}\n'
        '失败格式：{"status":"failed","error":"一句中文失败原因","features":{}}'
    )


def _chat_completions_url(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    parsed = urlparse(normalized)
    if parsed.path.endswith("/openai/v1"):
        return f"{normalized}/chat/completions"
    if parsed.path.endswith("/openai"):
        return f"{normalized}/v1/chat/completions"
    return f"{normalized}/openai/v1/chat/completions"


def _parse_json(content: str) -> dict[str, Any]:
    text = content.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
    text = text.replace("“", '"').replace("”", '"')
    return json.loads(text)


def _enum_value(value: object, choices: tuple[str, ...], default: str = "") -> str:
    text = str(value).strip() if isinstance(value, str) else ""
    return text if text in choices else default
