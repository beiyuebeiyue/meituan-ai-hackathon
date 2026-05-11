from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_optional_current_user
from app.models.user import User
from app.schemas.ai import AIChatRequest, AIChatResponse, AIRecommendRequest, AIRecommendResponse
from app.services.recommendation_service import RecommendationService
from app.services.user_chat_service import UserChatService


router = APIRouter(prefix="/ai", tags=["ai"])
recommendation_service = RecommendationService()
user_chat_service = UserChatService()


@router.post("/recommend", response_model=AIRecommendResponse)
def recommend_styles(payload: AIRecommendRequest, db: Session = Depends(get_db)) -> AIRecommendResponse:
    return recommendation_service.recommend(db, payload.query_text, payload.limit)


@router.post("/chat", response_model=AIChatResponse)
def chat_with_user_ai(
    payload: AIChatRequest,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> AIChatResponse:
    return user_chat_service.chat(db, payload.messages, current_user)
