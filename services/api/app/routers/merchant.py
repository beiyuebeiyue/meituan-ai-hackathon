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
from app.services.booking_service import BookingService
from app.services.merchant_service import MerchantShopService, require_merchant


router = APIRouter(prefix="/merchant", tags=["merchant"])
shop_service = MerchantShopService()
booking_service = BookingService()


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
