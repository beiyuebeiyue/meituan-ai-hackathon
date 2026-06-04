from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.user import User
from app.models.user_hand_photo import UserHandPhoto
from app.schemas.ai import AIChatMessage, AIChatResponse
from app.services.hand_feature_service import HandFeatureError, HandFeatureService
from app.services.user_chat_tools import (
    HAND_TOOL_NAME,
    NEEDS_HAND_IMAGE_ERROR,
    TEXT_TOOL_NAME,
    ChatTool,
    build_all_chat_tools,
    build_chat_tools,
)
from app.services.xhs_vector_recommendation_service import XhsVectorRecommendationService
from app.utils.files import resolve_local_path


class UserChatService:
    def __init__(self) -> None:
        self.hand_feature_service = HandFeatureService()
        self.xhs_vector_recommendation_service = XhsVectorRecommendationService()
        self.chat_tools_by_name = build_all_chat_tools(self.xhs_vector_recommendation_service)

    def chat(
        self,
        db: Session,
        messages: list[AIChatMessage],
        user: User | None = None,
        hand_image: UploadFile | None = None,
        saved_hand_photo_id: str | None = None,
    ) -> AIChatResponse:
        settings = get_settings()
        question = messages[-1].content.strip()
        try:
            hand_features = self._hand_features(db, user, hand_image, saved_hand_photo_id)
        except HandFeatureError as exc:
            return AIChatResponse(reply=f"这张手图我暂时没法稳定判断：{exc}。可以换一张光线更自然、手指完整露出的照片。", model="hand-feature-extractor")

        if not settings.longcat_api_key:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="小嘉大模型未配置")
        return self._longcat_reply(messages, question, hand_features)

    def _longcat_reply(self, messages: list[AIChatMessage], question: str, hand_features: dict[str, str] | None) -> AIChatResponse:
        settings = get_settings()
        available_tools = self._available_tools(hand_features)
        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=settings.longcat_api_key,
                base_url=settings.longcat_base_url,
                timeout=settings.longcat_chat_timeout_seconds,
            )
            response = client.chat.completions.create(
                model=settings.longcat_chat_model,
                messages=self._tool_chat_messages(messages, hand_features, available_tools),
                max_tokens=700,
                temperature=0.2,
            )
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="小嘉暂时不可用") from exc

        assistant_message = response.choices[0].message
        raw_reply = (assistant_message.content or "").strip()
        parsed_tool_calls = _parse_longcat_tool_call_markup(raw_reply)
        if parsed_tool_calls:
            return self._longcat_markup_tool_reply(settings.longcat_chat_model, question, hand_features, parsed_tool_calls)
        if _contains_longcat_tool_markup(raw_reply):
            return AIChatResponse(
                reply="我这次没有调用到可用的图库检索工具，所以先不展示推荐卡片。你可以再问一次，我会重新尝试检索。",
                model=settings.longcat_chat_model,
                recommendations=[],
            )
        return AIChatResponse(reply=_strip_longcat_tool_markup(raw_reply), model=settings.longcat_chat_model, recommendations=[])

    def _longcat_markup_tool_reply(
        self,
        model: str,
        question: str,
        hand_features: dict[str, str] | None,
        parsed_tool_calls: list[dict[str, Any]],
    ) -> AIChatResponse:
        tool_results = [
            self._execute_tool_call(
                name=str(tool_call.get("name") or ""),
                arguments=tool_call.get("arguments"),
                default_query=question,
                hand_features=hand_features,
            )
            for tool_call in parsed_tool_calls
        ]
        recommendations = _recommendations_from_tool_results(tool_results)
        reply = self._tool_result_reply(tool_results, bool(hand_features))
        needs_hand_image = _needs_hand_image(tool_results)
        return AIChatResponse(
            reply=reply,
            model=model,
            recommendations=_dedupe_recommendations(recommendations),
            needs_hand_image=needs_hand_image,
            hand_picker_message=reply if needs_hand_image else None,
        )

    def _execute_tool_call(
        self,
        name: str,
        arguments: Any,
        default_query: str,
        hand_features: dict[str, str] | None,
    ) -> dict[str, Any]:
        tool = self.chat_tools_by_name.get(name)
        if tool is None:
            return {"status": "failed", "tool": name, "query": default_query, "error": "未知工具", "recommendations": []}
        return tool.execute(arguments, default_query, hand_features)

    def _available_tools(self, hand_features: dict[str, str] | None) -> list[ChatTool]:
        del hand_features
        return build_chat_tools(self.xhs_vector_recommendation_service, include_hand=True)

    @staticmethod
    def _message_dicts(messages: list[AIChatMessage]) -> list[dict[str, str]]:
        result: list[dict[str, str]] = []
        for message in messages[-12:]:
            content = _strip_longcat_tool_markup(message.content) if message.role == "assistant" else message.content
            result.append({"role": message.role, "content": content})
        return result

    def _hand_features(
        self,
        db: Session,
        user: User | None,
        hand_image: UploadFile | None,
        saved_hand_photo_id: str | None,
    ) -> dict[str, str] | None:
        if hand_image is not None:
            return self.hand_feature_service.analyze_upload(hand_image)
        if not saved_hand_photo_id:
            return None
        if user is None:
            raise HandFeatureError("请先登录后再使用已保存手图")
        hand_photo = db.get(UserHandPhoto, saved_hand_photo_id)
        if hand_photo is None or hand_photo.user_id != user.id:
            raise HandFeatureError("没有找到这张已保存手图")
        image_path = resolve_local_path(hand_photo.image_path)
        if image_path is None or not image_path.exists():
            raise HandFeatureError("这张已保存手图文件不存在")
        return self.hand_feature_service.analyze_path(image_path)

    @staticmethod
    def _tool_chat_messages(messages: list[AIChatMessage], hand_features: dict[str, str] | None, tools: list[ChatTool]) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": UserChatService._tool_system_prompt(hand_features, tools)},
            *UserChatService._message_dicts(messages),
        ]

    @staticmethod
    def _tool_system_prompt(hand_features: dict[str, str] | None, tools: list[ChatTool]) -> str:
        hand_state = json.dumps(hand_features, ensure_ascii=False) if hand_features else "未上传"
        tool_docs = "\n\n".join(
            (
                "### Tool namespace: function\n\n"
                f"#### Tool name: {tool.name}\n\n"
                f"Description: {tool.description}\n\n"
                "InputSchema:\n"
                f"{json.dumps(tool.parameters(), ensure_ascii=False, indent=2)}"
            )
            for tool in tools
        )
        return (
            "你是焕甲 App 的小嘉助手，服务对象是正在寻找美甲灵感的普通用户。\n"
            "你的回答要简洁、自然、可信，不要编造平台库存或检索结果。\n\n"
            "当前用户状态：\n"
            f"- 手图状态：{hand_state}\n\n"
            "## Tools\n"
            "You have access to the following tools:\n\n"
            f"{tool_docs}\n\n"
            "工具调用格式必须严格为 XML 标签包裹 JSON 对象：\n"
            '<longcat_tool_call>{"name":"工具名","arguments":{}}</longcat_tool_call>\n'
            "多个工具调用时，每个调用都使用独立的 longcat_tool_call 标签连续输出。\n"
            "不要使用 markdown 代码块，不要使用其他工具格式。\n\n"
            "工具使用规则：\n"
            "1. 用户明确要求推荐、查找、看看、有没有、挑几款具体美甲图片时，必须调用工具。\n"
            "2. 只涉及美甲知识解释、护理建议、概念说明或普通聊天时，不调用工具，直接回答。\n"
            "3. 文搜图需求使用 search_nail_images_by_text，例如通勤、约会、显白、短甲、长甲、猫眼、法式、颜色、热门等。\n"
            "4. 用户要求按自己的手、手型、肤色、手图或图搜图推荐时，只能使用 search_nail_images_by_hand_and_text，不能使用文搜图工具替代。\n"
            "5. 如果用户没有上传手图但请求按自己的手推荐，也调用 search_nail_images_by_hand_and_text，由工具返回是否需要手图。\n"
            "6. 用户提到颜色时，把细分颜色归并为基础色系并写入 filters.colors；例如墨绿/深绿归为绿色，裸粉归为粉色和裸色，奶白归为白色。\n"
            "7. 只能调用上方列出的工具名，不要自造工具名。\n\n"
            "输出规则：\n"
            "- 如果需要推荐图片，只输出 longcat_tool_call，不要只在正文里说“我来搜索”。\n"
            "- 工具返回推荐时，只做简短说明，推荐卡片会在界面中展示。\n"
            "- 工具没有返回结果时，如实说明暂时没找到稳定匹配，并建议用户换个描述。\n"
            "- 不要提到 RAG、FAISS、embedding、JSON、数据库等内部实现。"
        )

    @staticmethod
    def _tool_result_reply(tool_results: list[dict[str, Any]], has_hand: bool) -> str:
        if _needs_hand_image(tool_results):
            return "我需要先看一张清晰手图，才能判断你的手型和肤色，再给你挑更适合的款式。"
        recommendations = []
        for result in tool_results:
            recommendations.extend(result.get("recommendations", []))
        if recommendations:
            if has_hand:
                return "我结合你的手部特征和需求挑好了几款，下面卡片里有图片和推荐理由。"
            return "我按你的需求挑好了几款美甲，下面卡片里有图片和推荐理由。"
        return "我暂时没找到稳定匹配的图片结果。可以换个更具体的描述，或者换一张清晰手图再试。"


def _needs_hand_image(tool_results: list[dict[str, Any]]) -> bool:
    return any(result.get("error_type") == NEEDS_HAND_IMAGE_ERROR for result in tool_results)


def _recommendations_from_tool_results(tool_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recommendations: list[dict[str, Any]] = []
    for result in tool_results:
        recommendations.extend(result.get("recommendations", []))
    return recommendations


def _loads_json_object(value: str) -> dict[str, Any]:
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


def _contains_longcat_tool_markup(value: str) -> bool:
    return "<longcat_tool_call>" in value


def _parse_longcat_tool_call_markup(value: str) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    for match in re.finditer(r"<longcat_tool_call>(.*?)</longcat_tool_call>", value, flags=re.DOTALL):
        body = match.group(1).strip()
        if not body:
            continue
        try:
            parsed = _loads_json_object(body)
        except json.JSONDecodeError:
            continue
        if parsed and parsed.get("name"):
            name = str(parsed.get("name") or "").strip()
            arguments = parsed.get("arguments") if isinstance(parsed.get("arguments"), dict) else {}
            if name in {TEXT_TOOL_NAME, HAND_TOOL_NAME}:
                calls.append({"name": name, "arguments": arguments})
    return calls


def _strip_longcat_tool_markup(value: str) -> str:
    text = re.sub(r"<longcat_tool_call>.*?</longcat_tool_call>", "", value, flags=re.DOTALL).strip()
    return text or "我这次没有拿到稳定的回复。你可以换个说法再问我一次。"


def _dedupe_recommendations(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in items:
        note_id = str(item.get("note_id") or "")
        if not note_id or note_id in seen:
            continue
        seen.add(note_id)
        result.append(item)
    return result
