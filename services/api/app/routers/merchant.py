from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.merchant import (
    BookingListResponse,
    BookingRead,
    BookingStatusUpdateRequest,
    MerchantShopCreateRequest,
    MerchantShopListResponse,
    MerchantShopRead,
    MerchantShopUpdateRequest,
)
from app.schemas.trends import (
    MerchantTrendClaimCreateRequest,
    MerchantTrendClaimRead,
    MerchantTrendNotificationListResponse,
)
from app.services.booking_service import BookingService
from app.services.merchant_service import MerchantShopService, require_merchant
from app.services.trend_nail_service import TrendNailService


router = APIRouter(prefix="/merchant", tags=["merchant"])
shop_service = MerchantShopService()
booking_service = BookingService()
trend_nail_service = TrendNailService()


@router.get("/shops/me", response_model=MerchantShopListResponse)
def list_my_shops(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MerchantShopListResponse:
    require_merchant(user)
    return MerchantShopListResponse(items=[MerchantShopRead.model_validate(item) for item in shop_service.list_for_merchant(db, user)])


@router.post("/shops", response_model=MerchantShopRead)
def create_shop(
    payload: MerchantShopCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MerchantShopRead:
    shop = shop_service.create(
        db,
        user,
        name=payload.name,
        city=payload.city,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        contact_phone=payload.contact_phone,
        is_default=payload.is_default,
    )
    return MerchantShopRead.model_validate(shop)


@router.patch("/shops/{shop_id}", response_model=MerchantShopRead)
def update_shop(
    shop_id: str,
    payload: MerchantShopUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MerchantShopRead:
    shop = shop_service.update(db, user, shop_id, **payload.model_dump(exclude_unset=True))
    return MerchantShopRead.model_validate(shop)


@router.get("/bookings", response_model=BookingListResponse)
def list_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingListResponse:
    require_merchant(user)
    return BookingListResponse(items=booking_service.serialize_many(booking_service.list_for_merchant(db, user)))


@router.get("/trend-notifications", response_model=MerchantTrendNotificationListResponse)
def list_trend_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MerchantTrendNotificationListResponse:
    require_merchant(user)
    return MerchantTrendNotificationListResponse(items=trend_nail_service.list_merchant_notifications(db, user))


@router.post("/trend-claims", response_model=MerchantTrendClaimRead)
def create_trend_claim(
    payload: MerchantTrendClaimCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MerchantTrendClaimRead:
    require_merchant(user)
    return trend_nail_service.claim_style(db, user, style_id=payload.style_id, campaign_id=payload.campaign_id)


@router.delete("/trend-claims/{style_id}", status_code=204)
def delete_trend_claim(
    style_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    require_merchant(user)
    trend_nail_service.delete_claim(db, user, style_id=style_id)


@router.patch("/bookings/{booking_id}", response_model=BookingRead)
def update_booking(
    booking_id: str,
    payload: BookingStatusUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingRead:
    require_merchant(user)
    booking = booking_service.update_status(db, user, booking_id, payload.status)
    return booking_service.serialize_many([booking])[0]
