from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.schemas.ai import AIHotXhsRecommendationItem
from app.services.xhs_vector_recommendation_service import XhsVectorRecommendationError, XhsVectorRecommendationService


TEXT_TOOL_NAME = "search_nail_images_by_text"
HAND_TOOL_NAME = "search_nail_images_by_hand_and_text"
NEEDS_HAND_IMAGE_ERROR = "needs_hand_image"
NAIL_COLOR_CHOICES = ["绿色", "粉色", "裸色", "白色", "黑色", "红色", "蓝色", "紫色", "黄色", "金色", "银色", "棕色", "灰色", "透明", "橙色"]


class ChatTool(Protocol):
    name: str
    description: str

    def parameters(self) -> dict[str, Any]:
        ...

    def execute(self, arguments: Any, default_query: str, hand_features: dict[str, str] | None) -> dict[str, Any]:
        ...


@dataclass
class BaseNailImageTool:
    recommendation_service: XhsVectorRecommendationService
    name: str
    description: str

    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "用户想找的美甲需求，保留中文关键词。"},
                "limit": {"type": "integer", "minimum": 1, "maximum": 5, "default": 5},
                "filters": {
                    "type": "object",
                    "description": "从用户需求中抽取出的硬筛条件。不确定就传空对象。",
                    "properties": {
                        "colors": {
                            "type": "array",
                            "items": {"type": "string", "enum": NAIL_COLOR_CHOICES},
                            "description": "基础色系，可多选。例如墨绿/深绿归并为绿色，裸粉可归并为粉色和裸色。",
                        }
                    },
                    "additionalProperties": False,
                },
            },
            "required": ["query"],
            "additionalProperties": False,
        }

    def _args(self, arguments: Any, default_query: str) -> tuple[str, int, dict[str, Any]]:
        args = arguments if isinstance(arguments, dict) else {}
        filters = args.get("filters")
        return str(args.get("query") or default_query).strip(), _limit(args.get("limit")), filters if isinstance(filters, dict) else {}

    def _result(self, query: str, hand_features: dict[str, str] | None, items: list[AIHotXhsRecommendationItem]) -> dict[str, Any]:
        return {
            "status": "succeeded",
            "tool": self.name,
            "query": query,
            "hand_features": hand_features or {},
            "recommendations": [item.model_dump() for item in items],
            "recommendation_context": [_recommendation_context(item) for item in items],
        }

    def _failed(self, query: str, error: str, error_type: str = "") -> dict[str, Any]:
        return {
            "status": "failed",
            "tool": self.name,
            "query": query,
            "error": error,
            "error_type": error_type,
            "recommendations": [],
        }


class SearchNailImagesByTextTool(BaseNailImageTool):
    def __init__(self, recommendation_service: XhsVectorRecommendationService) -> None:
        super().__init__(
            recommendation_service=recommendation_service,
            name=TEXT_TOOL_NAME,
            description="根据用户文字需求检索小红书 standard nail image，例如显白、通勤、短甲、热门、猫眼、法式等；如果用户提到颜色，把基础色系写入 filters.colors。",
        )

    def execute(self, arguments: Any, default_query: str, hand_features: dict[str, str] | None) -> dict[str, Any]:
        del hand_features
        query, limit, filters = self._args(arguments, default_query)
        try:
            items = self.recommendation_service.recommend_by_text(query, limit, filters=filters)
        except XhsVectorRecommendationError as exc:
            return self._failed(query, str(exc))
        return self._result(query, None, items)


class SearchNailImagesByHandAndTextTool(BaseNailImageTool):
    def __init__(self, recommendation_service: XhsVectorRecommendationService) -> None:
        super().__init__(
            recommendation_service=recommendation_service,
            name=HAND_TOOL_NAME,
            description="用户已上传手图时，先按手部肤色倾向和手指形态粗筛，再根据文字需求检索适合她手型的美甲图片；如果用户提到颜色，把基础色系写入 filters.colors。",
        )

    def execute(self, arguments: Any, default_query: str, hand_features: dict[str, str] | None) -> dict[str, Any]:
        query, limit, filters = self._args(arguments, default_query)
        if not hand_features:
            return self._failed(query, "需要先上传清晰手图", NEEDS_HAND_IMAGE_ERROR)
        try:
            items = self.recommendation_service.recommend_by_hand_and_text(query, hand_features, limit, filters=filters)
        except XhsVectorRecommendationError as exc:
            return self._failed(query, str(exc))
        return self._result(query, hand_features, items)


def build_chat_tools(recommendation_service: XhsVectorRecommendationService, include_hand: bool) -> list[ChatTool]:
    tools: list[ChatTool] = [SearchNailImagesByTextTool(recommendation_service)]
    if include_hand:
        tools.append(SearchNailImagesByHandAndTextTool(recommendation_service))
    return tools


def build_all_chat_tools(recommendation_service: XhsVectorRecommendationService) -> dict[str, ChatTool]:
    tools: list[ChatTool] = [
        SearchNailImagesByTextTool(recommendation_service),
        SearchNailImagesByHandAndTextTool(recommendation_service),
    ]
    return {tool.name: tool for tool in tools}


def _limit(value: object) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = 5
    return min(max(parsed, 1), 5)


def _recommendation_context(item: AIHotXhsRecommendationItem) -> dict[str, Any]:
    return {
        "note_id": item.note_id,
        "title": item.title,
        "tags": item.tags,
        "liked_count": item.liked_count,
        "collected_count": item.collected_count,
        "share_count": item.share_count,
        "nail_features": item.nail_features or {},
        "existing_reason": item.reason,
    }
