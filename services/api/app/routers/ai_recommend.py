from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.ai import AIRecommendRequest, AIRecommendResponse
from app.services.recommendation_service import RecommendationService


router = APIRouter(prefix="/ai", tags=["ai"])
recommendation_service = RecommendationService()


@router.post("/recommend", response_model=AIRecommendResponse)
def recommend_styles(payload: AIRecommendRequest, db: Session = Depends(get_db)) -> AIRecommendResponse:
    return recommendation_service.recommend(db, payload.query_text, payload.limit)
