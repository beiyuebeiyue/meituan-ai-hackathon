from __future__ import annotations

import json
import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.schemas.ops import OpsChatMessage, OpsChatResponse
from app.services.analytics_service import AnalyticsService
from app.services.ops_admin_service import OpsAdminService
from app.services.trend_nail_service import TrendNailService

TOOL_CALL_RE = re.compile(r"<ops_tool_call>\s*(.*?)\s*</ops_tool_call>", re.DOTALL)


class OpsChatService:
    def __init__(self) -> None:
        self.ops_admin = OpsAdminService()
        self.analytics = AnalyticsService()
        self.trends = TrendNailService()

    def chat(self, db: Session, messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        provider = settings.ops_ai_provider.lower()
        if provider == "openclaw":
            return self._openclaw_reply(db, messages)
        if provider == "longcat" and settings.longcat_api_key:
            return self._longcat_reply(db, messages)
        if provider == "openai" and settings.openai_api_key:
            return self._openai_reply(messages)
        return OpsChatResponse(reply=self._local_reply(db, messages[-1].content), model="local-ops-summary")

    def _openclaw_reply(self, db: Session, messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openclaw_gateway_token or "openclaw-local", base_url=self._openclaw_openai_base_url())
            content = self._chat_with_optional_tools(client, settings.openclaw_model, db, messages)
            return OpsChatResponse(reply=content.strip(), model=settings.openclaw_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="OpenClaw Gateway 暂不可用") from exc

    def _longcat_reply(self, db: Session, messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.longcat_api_key, base_url=settings.longcat_base_url)
            content = self._chat_with_optional_tools(client, settings.longcat_chat_model, db, messages)
            return OpsChatResponse(reply=content.strip(), model=settings.longcat_chat_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="运营小嘉暂不可用") from exc

    def _openai_reply(self, messages: list[OpsChatMessage]) -> OpsChatResponse:
        settings = get_settings()
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.create(
                model=settings.openai_text_model,
                instructions=self._system_prompt(),
                input=[message.model_dump() for message in messages[-6:]],
            )
            return OpsChatResponse(reply=response.output_text.strip(), model=settings.openai_text_model)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="运营小嘉暂不可用") from exc

    def _chat_with_optional_tools(self, client, model: str, db: Session, messages: list[OpsChatMessage]) -> str:
        chat_messages = self._chat_messages(messages)
        first = client.chat.completions.create(
            model=model,
            messages=chat_messages,
            max_tokens=1000,
            temperature=0.3,
        )
        content = first.choices[0].message.content or ""
        tool_calls = self._parse_tool_calls(content)
        if not tool_calls:
            return content

        tool_results = [self._execute_tool(db, call) for call in tool_calls]
        second = client.chat.completions.create(
            model=model,
            messages=[
                *chat_messages,
                {"role": "assistant", "content": content},
                {
                    "role": "user",
                    "content": (
                        "工具查询结果 JSON 如下。请只基于这些结果回答运营问题，"
                        "不要输出 XML、JSON、工具名或内部实现细节。\n"
                        f"{json.dumps(tool_results, ensure_ascii=False)}"
                    ),
                },
            ],
            max_tokens=1000,
            temperature=0.3,
        )
        return second.choices[0].message.content or ""

    def _chat_messages(self, messages: list[OpsChatMessage]) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": self._system_prompt()},
            *[message.model_dump() for message in messages[-6:]],
        ]

    @staticmethod
    def _openclaw_openai_base_url() -> str:
        base_url = get_settings().openclaw_base_url.rstrip("/")
        if base_url.endswith("/v1"):
            return base_url
        return f"{base_url}/v1"

    @staticmethod
    def _system_prompt() -> str:
        settings = get_settings()
        today = datetime.now(ZoneInfo(settings.ops_report_timezone)).date().isoformat()
        return (
            "你是焕甲运营后台的运营小嘉，你负责回答运营同学有关数据、用户、商家、日报和热门美甲相关问题。"
            f"当前日期是 {today}，时区是 {settings.ops_report_timezone}。"
            "回答要简洁、可执行。不要编造数字；凡是用户询问当前运营数据、转化、营收、热门款、Top 款式或门店，"
            "必须先调用工具查询数据，再给结论。普通产品/运营方法论问题可以直接回答。\n\n"
            "工具调用格式必须严格为一段 XML，XML 内是 JSON 对象：\n"
            '<ops_tool_call>{"name":"工具名","arguments":{}}</ops_tool_call>\n'
            "不要使用 markdown 代码块，不要输出其他工具格式。\n\n"
            "可用工具：\n"
            "1. get_ops_dashboard_summary: 查询今日运营概览和少量热门美甲。"
            '参数 {"popular_limit": 5}，popular_limit 范围 1-10。\n'
            "2. get_ops_analytics_overview: 查询转化漏斗、KPI、趋势、Top 款式和 Top 门店。"
            '参数 {"start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD"}，日期可省略表示今天。\n'
            "3. get_trend_nail_candidates: 查询可推送给商家的热门手工甲候选池。"
            '参数 {"limit": 20}，只返回手工甲，limit 范围 1-50。\n\n'
            "示例：用户问“今天营收怎么样”，你应先返回："
            '<ops_tool_call>{"name":"get_ops_analytics_overview","arguments":{}}</ops_tool_call>'
        )

    def _parse_tool_calls(self, content: str) -> list[dict[str, object]]:
        calls: list[dict[str, object]] = []
        for match in TOOL_CALL_RE.finditer(content):
            try:
                payload = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
            if isinstance(payload, dict) and isinstance(payload.get("name"), str):
                arguments = payload.get("arguments")
                calls.append({"name": payload["name"], "arguments": arguments if isinstance(arguments, dict) else {}})
        return calls

    def _execute_tool(self, db: Session, call: dict[str, object]) -> dict[str, object]:
        name = str(call.get("name") or "")
        arguments = call.get("arguments") if isinstance(call.get("arguments"), dict) else {}
        try:
            if name == "get_ops_dashboard_summary":
                return {"name": name, "status": "succeeded", "data": self._dashboard_summary(db, arguments)}
            if name == "get_ops_analytics_overview":
                return {"name": name, "status": "succeeded", "data": self._analytics_overview(db, arguments)}
            if name == "get_trend_nail_candidates":
                return {"name": name, "status": "succeeded", "data": self._trend_nail_candidates(db, arguments)}
            return {"name": name, "status": "failed", "error": "unknown_tool"}
        except Exception as exc:  # keep chat resilient; tool errors should become answerable context
            return {"name": name, "status": "failed", "error": str(exc)}

    def _dashboard_summary(self, db: Session, arguments: dict[str, object]) -> dict[str, object]:
        limit = self._bounded_limit(arguments.get("popular_limit"), default=5)
        dashboard = self.ops_admin.dashboard(db).model_dump(mode="json")
        return {
            "report_date": dashboard["report_date"],
            "timezone": dashboard["timezone"],
            "metrics": dashboard["metrics"],
            "popular_nails": self._compact_popular_nails(dashboard.get("popular_nails", [])[:limit]),
        }

    def _analytics_overview(self, db: Session, arguments: dict[str, object]) -> dict[str, object]:
        start_date = self._parse_date(arguments.get("start_date"))
        end_date = self._parse_date(arguments.get("end_date"))
        overview = self.analytics.overview(db, start_date=start_date, end_date=end_date).model_dump(mode="json")
        return {
            "start_date": overview["start_date"],
            "end_date": overview["end_date"],
            "generated_at": overview["generated_at"],
            "kpis": overview["kpis"],
            "funnel": overview["funnel"],
            "trends": overview["trends"][-14:],
            "top_styles": overview["top_styles"][:10],
            "top_shops": overview["top_shops"][:10],
        }

    def _trend_nail_candidates(self, db: Session, arguments: dict[str, object]) -> dict[str, object]:
        limit = self._bounded_limit(arguments.get("limit"), default=20, maximum=50)
        candidates = self.trends.list_candidates(db, limit=limit)
        return {
            "items": [
                {
                    "id": item.id,
                    "title": item.title,
                    "tags": item.tags,
                    "popularity_score": item.popularity_score,
                    "like_count": item.like_count,
                    "claim_count": item.claim_count,
                }
                for item in candidates
            ]
        }

    @staticmethod
    def _compact_popular_nails(items: list[dict[str, object]]) -> list[dict[str, object]]:
        compact: list[dict[str, object]] = []
        for item in items:
            compact.append(
                {
                    "note_id": item.get("note_id"),
                    "keyword": item.get("keyword"),
                    "title": item.get("title"),
                    "tags": (item.get("tag_list") or [])[:8] if isinstance(item.get("tag_list"), list) else [],
                    "liked_count": item.get("liked_count", 0),
                    "collected_count": item.get("collected_count", 0),
                    "share_count": item.get("share_count", 0),
                }
            )
        return compact

    @staticmethod
    def _bounded_limit(value: object, default: int, maximum: int = 10) -> int:
        try:
            limit = int(value)
        except (TypeError, ValueError):
            limit = default
        return max(1, min(limit, maximum))

    @staticmethod
    def _parse_date(value: object) -> date | None:
        if not isinstance(value, str) or not value:
            return None
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    def _local_reply(self, db: Session, question: str) -> str:
        dashboard = self._dashboard_summary(db, {"popular_limit": 1})
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
