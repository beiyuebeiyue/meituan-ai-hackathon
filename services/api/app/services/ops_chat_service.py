from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.schemas.ops import OpsChatMessage, OpsChatResponse
from app.services.ops_admin_service import OpsAdminService


class OpsChatService:
    def __init__(self) -> None:
        self.ops_admin = OpsAdminService()

    def chat(self, db: Session, messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        dashboard = self.ops_admin.dashboard(db).model_dump(mode="json")
        provider = settings.ops_ai_provider.lower()
        if provider == "openclaw":
            return self._openclaw_reply(dashboard, messages)
        if provider == "longcat" and settings.longcat_api_key:
            return self._longcat_reply(dashboard, messages)
        if provider == "openai" and settings.openai_api_key:
            return self._openai_reply(dashboard, messages)
        return OpsChatResponse(reply=self._local_reply(dashboard, messages[-1].content), model="local-ops-summary")

    def _openclaw_reply(self, dashboard: dict[str, object], messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openclaw_gateway_token or "openclaw-local", base_url=self._openclaw_openai_base_url())
            response = client.chat.completions.create(
                model=settings.openclaw_model,
                messages=self._chat_messages(dashboard, messages),
                max_tokens=1000,
                temperature=0.3,
            )
            content = response.choices[0].message.content or ""
            return OpsChatResponse(reply=content.strip(), model=settings.openclaw_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="OpenClaw Gateway 暂不可用") from exc

    def _longcat_reply(self, dashboard: dict[str, object], messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.longcat_api_key, base_url=settings.longcat_base_url)
            response = client.chat.completions.create(
                model=settings.longcat_model,
                messages=self._chat_messages(dashboard, messages),
                max_tokens=1000,
                temperature=0.3,
            )
            content = response.choices[0].message.content or ""
            return OpsChatResponse(reply=content.strip(), model=settings.longcat_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="运营小嘉暂不可用") from exc

    def _openai_reply(self, dashboard: dict[str, object], messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.create(
                model=settings.openai_text_model,
                instructions=self._system_prompt(dashboard),
                input=[message.model_dump() for message in messages[-12:]],
            )
            return OpsChatResponse(reply=response.output_text.strip(), model=settings.openai_text_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="运营小嘉暂不可用") from exc

    def _chat_messages(self, dashboard: dict[str, object], messages: list[OpsChatMessage]) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": self._system_prompt(dashboard)},
            *[message.model_dump() for message in messages[-12:]],
        ]

    @staticmethod
    def _openclaw_openai_base_url() -> str:
        base_url = get_settings().openclaw_base_url.rstrip("/")
        if base_url.endswith("/v1"):
            return base_url
        return f"{base_url}/v1"

    @staticmethod
    def _system_prompt(dashboard: dict[str, object]) -> str:
        return (
            "你是焕甲运营后台的运营小嘉，你负责回答运营同学有关数据、用户、商家、日报和热门美甲相关问题。"
            "回答要简洁、可执行，必要时引用当前 dashboard 数据。"
            f"\n\n当前 dashboard JSON:\n{json.dumps(dashboard, ensure_ascii=False)}"
        )

    @staticmethod
    def _local_reply(dashboard: dict[str, object], question: str) -> str:
        metrics = dashboard["metrics"]  # type: ignore[index]
        popular_nails = dashboard["popular_nails"]  # type: ignore[index]
        summary = [
            f"当前日期是 {dashboard['report_date']}，口径为 {dashboard['timezone']}。",
            f"用户 {metrics['users']['total']}，今日新增 {metrics['users']['today']}。",
            f"商家 {metrics['merchants']['total']}，今日新增 {metrics['merchants']['today']}。",
            f"图片 {metrics['images']['total']}，今日新增 {metrics['images']['today']}。",
            f"预定单 {metrics['bookings']['total']}，完成单 {metrics['completed_bookings']['total']}，营收 {metrics['revenue']['total']} 元。",
        ]
        if popular_nails:
            top = popular_nails[0]
            summary.append(
                f"今日热门美甲第一条是《{top['title']}》，Like {top['liked_count']}，Collect {top['collected_count']}。"
            )
        summary.append(f"你刚才问的是：{question}")
        return "\n".join(summary)
