from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.models.user import User
from app.schemas.ai import AIChatMessage, AIChatResponse
from app.services.nail_rag_service import NailRagService


class UserChatService:
    def __init__(self) -> None:
        self.nail_rag_service = NailRagService()

    def chat(self, db: Session, messages: list[AIChatMessage], user: User | None = None) -> AIChatResponse:
        settings = get_settings()
        question = messages[-1].content
        context = self._context(db, user, question)
        if settings.longcat_api_key:
            return self._longcat_reply(context, messages)
        if settings.openai_api_key:
            return self._openai_reply(context, messages)
        return AIChatResponse(reply=self._local_reply(context, question), model="local-user-assistant")

    def _longcat_reply(self, context: dict[str, object], messages: list[AIChatMessage]) -> AIChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.longcat_api_key, base_url=settings.longcat_base_url)
            response = client.chat.completions.create(
                model=settings.longcat_model,
                messages=self._chat_messages(context, messages),
                max_tokens=900,
                temperature=0.4,
            )
            content = response.choices[0].message.content or ""
            return AIChatResponse(reply=content.strip(), model=settings.longcat_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="小嘉暂时不可用") from exc

    def _openai_reply(self, context: dict[str, object], messages: list[AIChatMessage]) -> AIChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.create(
                model=settings.openai_text_model,
                instructions=self._system_prompt(context),
                input=[message.model_dump() for message in messages[-12:]],
            )
            return AIChatResponse(reply=response.output_text.strip(), model=settings.openai_text_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="小嘉暂时不可用") from exc

    def _chat_messages(self, context: dict[str, object], messages: list[AIChatMessage]) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": self._system_prompt(context)},
            *[message.model_dump() for message in messages[-12:]],
        ]

    def _context(self, db: Session, user: User | None, question: str) -> dict[str, object]:
        styles = db.scalars(
            select(NailStyle).order_by(NailStyle.is_trending.desc(), NailStyle.popularity_score.desc(), NailStyle.created_at.desc()).limit(8)
        ).all()
        return {
            "user": {
                "username": user.username if user else None,
                "role": user.role if user else None,
                "location": user.last_login_ip_location if user else None,
            },
            "styles": [
                {
                    "id": style.id,
                    "title": style.title,
                    "tags": style.tags_json or [],
                    "is_trending": style.is_trending,
                    "popularity_score": style.popularity_score,
                }
                for style in styles
            ],
            "tools": {
                "search_nail_rag": {
                    "query": question,
                    "items": self.nail_rag_service.search(question),
                }
            },
        }

    @staticmethod
    def _system_prompt(context: dict[str, object]) -> str:
        return (
            "你是焕甲用户端的小嘉，是面向普通用户的美甲助手。"
            "你可以帮助用户选择美甲风格、解释适合什么手型和场景、引导使用 AI 焕手、提醒预约到店。"
            "回答要简洁、亲切、可执行。不要暴露运营后台信息，不要编造平台没有的数据。"
            "你可以使用工具 search_nail_rag，工具结果会放在 tools.search_nail_rag.items。"
            "推荐具体美甲款式时，优先基于工具返回的案例标题、标签、热度和图片信息；没有工具结果时再使用平台款式。"
            "不要向用户暴露工具名、RAG、JSON 等内部实现。"
            "如果用户想找具体款式，可以建议在页面下方推荐卡片里点开详情或直接 AI 试戴。"
            "如果涉及皮肤疾病、过敏或医疗判断，只做安全提醒并建议咨询专业人士。"
            f"\n\n当前可参考的用户和款式 JSON:\n{json.dumps(context, ensure_ascii=False)}"
        )

    @staticmethod
    def _local_reply(context: dict[str, object], question: str) -> str:
        tools = context.get("tools", {})
        if isinstance(tools, dict):
            rag = tools.get("search_nail_rag", {})
            items = rag.get("items", []) if isinstance(rag, dict) else []
            if isinstance(items, list) and items:
                names = "、".join(str(item.get("title")) for item in items[:3] if isinstance(item, dict))
                return f"我查了美甲案例库，和“{question}”更相关的是：{names}。可以优先选这些方向，再用 AI 焕手试戴。"

        styles = context.get("styles", [])
        if isinstance(styles, list) and styles:
            names = "、".join(str(item.get("title")) for item in styles[:3] if isinstance(item, dict))
            return f"我先按你的问题理解：{question}\n可以先看这几款：{names}。你也可以直接点推荐卡片试戴到手上。"
        return f"我先按你的问题理解：{question}\n可以告诉我你想要显白、通勤、短甲、猫眼还是约会款，我会帮你挑适合试戴的款式。"
