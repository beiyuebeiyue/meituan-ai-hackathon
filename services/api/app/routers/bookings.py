from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.merchant import BookingCreateRequest, BookingListResponse, BookingRead, BookingStatusUpdateRequest
from app.services.booking_service import BookingService
from app.services.merchant_service import require_merchant


router = APIRouter(prefix="/bookings", tags=["bookings"])
booking_service = BookingService()


@router.post("", response_model=BookingRead)
def create_booking(
    payload: BookingCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingRead:
    booking = booking_service.create(
        db,
        user,
        shop_id=payload.shop_id,
        style_id=payload.style_id,
        appointment_time=payload.appointment_time,
        contact_phone=payload.contact_phone,
        note=payload.note,
    )
    return booking_service.serialize_many([booking])[0]


@router.get("/me", response_model=BookingListResponse)
def list_my_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingListResponse:
    return BookingListResponse(items=booking_service.serialize_many(booking_service.list_for_user(db, user)))


@router.get("/merchant", response_model=BookingListResponse)
def list_merchant_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingListResponse:
    require_merchant(user)
    return BookingListResponse(items=booking_service.serialize_many(booking_service.list_for_merchant(db, user)))


@router.patch("/merchant/{booking_id}", response_model=BookingRead)
def update_merchant_booking(
    booking_id: str,
    payload: BookingStatusUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingRead:
    require_merchant(user)
    booking = booking_service.update_status(db, user, booking_id, payload.status)
    return booking_service.serialize_many([booking])[0]
