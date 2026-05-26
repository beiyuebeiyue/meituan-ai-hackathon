import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user, get_optional_current_user
from app.models.user import User
from app.schemas.ai import AIChatRequest, AIChatResponse, AIRecommendRequest, AIRecommendResponse, XhsRecommendationStyleResponse
from app.services.recommendation_service import RecommendationService
from app.services.user_chat_service import UserChatService
from app.services.xhs_style_materialization_service import XhsStyleMaterializationService


router = APIRouter(prefix="/ai", tags=["ai"])
recommendation_service = RecommendationService()
user_chat_service = UserChatService()
xhs_style_materialization_service = XhsStyleMaterializationService()


@router.post("/recommend", response_model=AIRecommendResponse)
def recommend_styles(payload: AIRecommendRequest, db: Session = Depends(get_db)) -> AIRecommendResponse:
    return recommendation_service.recommend(db, payload.query_text, payload.limit)


@router.post("/xhs-recommendations/{note_id}/style", response_model=XhsRecommendationStyleResponse)
def materialize_xhs_recommendation_style(
    note_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> XhsRecommendationStyleResponse:
    style = xhs_style_materialization_service.get_or_create_style(db, note_id)
    return XhsRecommendationStyleResponse(style_id=style.id)


@router.post("/chat", response_model=AIChatResponse)
async def chat_with_user_ai(
    request: Request,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
    messages: str | None = Form(default=None),
    hand_image: UploadFile | None = File(default=None),
    saved_hand_photo_id: str | None = Form(default=None),
) -> AIChatResponse:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        if not messages:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="messages is required")
        try:
            parsed = AIChatRequest(messages=json.loads(messages))
        except (json.JSONDecodeError, ValidationError) as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid messages") from exc
        return user_chat_service.chat(
            db,
            parsed.messages,
            current_user,
            hand_image=hand_image,
            saved_hand_photo_id=saved_hand_photo_id,
        )

    payload = AIChatRequest.model_validate(await request.json())
    return user_chat_service.chat(db, payload.messages, current_user)
