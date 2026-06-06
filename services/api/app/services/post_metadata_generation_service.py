from __future__ import annotations

import base64
import json
import re
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.models.user_post import UserPost


class PostMetadataGenerationService:
    def generate(self, db: Session, image: UploadFile) -> dict[str, object]:
        settings = get_settings()
        if not settings.longcat_api_key:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="LongCat 模型未配置")

        image_bytes = image.file.read()
        try:
            image.file.seek(0)
        except Exception:
            pass
        if not image_bytes:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="图片不能为空")

        examples = self._examples(db)
        data_url = self._data_url(image, image_bytes)
        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=settings.longcat_api_key,
                base_url=settings.longcat_base_url,
                timeout=settings.longcat_chat_timeout_seconds,
            )
            response = client.chat.completions.create(
                model=settings.longcat_multimodal_model,
                messages=[
                    {"role": "system", "content": self._system_prompt(examples)},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "请读取这张美甲图片，生成发布信息。只返回 JSON。"},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ],
                max_tokens=650,
                temperature=0.45,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="LongCat 图片理解暂时不可用") from exc

        raw_text = (response.choices[0].message.content or "").strip()
        try:
            parsed = self._parse_json(raw_text)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="LongCat 返回内容不是有效 JSON") from exc
        title = str(parsed.get("title") or "").strip()[:80]
        description = str(parsed.get("description") or "").strip()[:500]
        raw_tags = parsed.get("tags")
        if raw_tags is None:
            raw_tags = parsed.get("hashtags")
        tags = self._normalize_tags(raw_tags)
        if not title or not description or not tags:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="LongCat 返回内容格式不完整")
        return {
            "title": title,
            "description": description,
            "tags": tags,
            "model": settings.longcat_multimodal_model,
        }

    @staticmethod
    def _data_url(image: UploadFile, image_bytes: bytes) -> str:
        content_type = image.content_type or "image/jpeg"
        encoded = base64.b64encode(image_bytes).decode("ascii")
        return f"data:{content_type};base64,{encoded}"

    @staticmethod
    def _normalize_tags(value: Any) -> list[str]:
        if isinstance(value, str):
            candidates = re.split(r"[,，#\s]+", value)
        elif isinstance(value, list):
            candidates = [str(item) for item in value]
        else:
            candidates = []
        result: list[str] = []
        seen: set[str] = set()
        for item in candidates:
            tag = item.strip().lstrip("#").strip()
            if not tag or tag in seen:
                continue
            seen.add(tag)
            result.append(tag[:18])
            if len(result) >= 8:
                break
        return result

    @staticmethod
    def _parse_json(value: str) -> dict[str, Any]:
        text = value.strip()
        fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL | re.IGNORECASE)
        if fence:
            text = fence.group(1).strip()
        if not text.startswith("{"):
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                text = text[start : end + 1]
        parsed = json.loads(text.replace("“", '"').replace("”", '"'))
        return parsed if isinstance(parsed, dict) else {}

    def _examples(self, db: Session) -> list[dict[str, object]]:
        examples: list[dict[str, object]] = []
        posts = db.scalars(
            select(UserPost)
            .where(UserPost.title != "")
            .order_by((UserPost.source_type == "xhs_note").desc(), UserPost.created_at.desc())
            .limit(10)
        ).all()
        for post in posts:
            examples.append(
                {
                    "title": post.title,
                    "description": post.description,
                    "hashtags": post.tags_json or [],
                }
            )
        if len(examples) >= 10:
            return examples[:10]

        styles = db.scalars(
            select(NailStyle)
            .where(NailStyle.title != "")
            .order_by((NailStyle.source_type == "xhs_note").desc(), NailStyle.popularity_score.desc())
            .limit(10 - len(examples))
        ).all()
        for style in styles:
            examples.append(
                {
                    "title": style.title,
                    "description": style.description,
                    "hashtags": style.tags_json or [],
                }
            )
        return examples[:10]

    @staticmethod
    def _system_prompt(examples: list[dict[str, object]]) -> str:
        examples_json = json.dumps(examples, ensure_ascii=False, indent=2)
        return (
            "你是焕甲 App 的美甲内容发布助手。你要读取用户上传的美甲图片，"
            "仿照平台已有小红书/美甲帖子文案风格，生成可直接发布的内容。\n\n"
            "下面是数据库里已有的 10 条左右参考样例，字段为 title、description、hashtags：\n"
            f"{examples_json}\n\n"
            "生成要求：\n"
            "1. title 要像真实美甲内容标题，短、有吸引力，不要超过 28 个中文字符。\n"
            "2. description 描述图片里的颜色、质感、风格、适合场景和上手感受，语气自然，不要编造店名、价格、地址。\n"
            "3. tags 返回 4 到 8 个标签，不要带 #，优先包含颜色、款式、场景、甲型或质感。\n"
            "4. 必须只返回 JSON 对象，不要 markdown，不要解释。\n"
            '5. JSON 格式必须是 {"title":"...","description":"...","tags":["..."]}。'
        )
