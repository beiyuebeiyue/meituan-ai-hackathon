from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.merchant_shop import MerchantShop
from app.models.nail_style import NailStyle
from app.models.user import User
from app.schemas.merchant import BookingRead
from app.services.analytics_service import AnalyticsService

VALID_BOOKING_STATUSES = {"pending", "accepted", "rejected", "completed", "cancelled"}


class BookingService:
    def __init__(self) -> None:
        self.analytics = AnalyticsService()

    def _read(self, booking: Booking) -> BookingRead:
        style = booking.style
        shop = booking.shop
        user = booking.user
        merchant = booking.merchant
        return BookingRead(
            id=booking.id,
            style_id=booking.style_id,
            style_title=style.title if style else "门店预约",
            style_image_url=style.image_url if style else "",
            shop_id=booking.shop_id,
            shop_name=shop.name if shop else "美甲门店",
            shop_city=shop.city if shop else "深圳",
            merchant_user_id=booking.merchant_user_id,
            merchant_name=merchant.username if merchant else "商家",
            user_id=booking.user_id,
            user_name=user.username if user else "用户",
            appointment_time=booking.appointment_time,
            contact_phone=booking.contact_phone,
            amount_cents=booking.amount_cents,
            status=booking.status,  # type: ignore[arg-type]
            note=booking.note,
            created_at=booking.created_at,
            updated_at=booking.updated_at,
        )

    def serialize_many(self, bookings: list[Booking]) -> list[BookingRead]:
        return [self._read(item) for item in bookings]

    def create(
        self,
        db: Session,
        user: User,
        *,
        shop_id: str,
        style_id: str | None = None,
        appointment_time: str,
        contact_phone: str,
        note: str | None = None,
    ) -> Booking:
        shop = db.get(MerchantShop, shop_id)
        if shop is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")
        style: NailStyle | None = None
        if style_id:
            style = db.get(NailStyle, style_id)
            if style is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="款式不存在")
            if style.shop_id and style.shop_id != shop.id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="款式不属于该门店")
        booking = Booking(
            user_id=user.id,
            merchant_user_id=shop.merchant_user_id,
            shop_id=shop.id,
            style_id=style.id if style else None,
            appointment_time=appointment_time.strip(),
            contact_phone=contact_phone.strip(),
            amount_cents=10_000,
            note=note.strip() if note else None,
            status="pending",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        self.analytics.record_server_event(
            db,
            "booking_created",
            user_id=user.id,
            style_id=booking.style_id,
            booking_id=booking.id,
            shop_id=booking.shop_id,
            amount_cents=booking.amount_cents,
        )
        return booking

    def list_for_user(self, db: Session, user: User) -> list[Booking]:
        return list(db.scalars(select(Booking).where(Booking.user_id == user.id).order_by(Booking.created_at.desc())))

    def list_for_merchant(self, db: Session, user: User) -> list[Booking]:
        return list(
            db.scalars(select(Booking).where(Booking.merchant_user_id == user.id).order_by(Booking.created_at.desc()))
        )

    def update_status(self, db: Session, user: User, booking_id: str, status_value: str) -> Booking:
        if status_value not in VALID_BOOKING_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="预约状态不合法")
        booking = db.get(Booking, booking_id)
        if booking is None or booking.merchant_user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="预约不存在")
        booking.status = status_value
        db.add(booking)
        db.commit()
        db.refresh(booking)
        if status_value == "completed":
            self.analytics.record_server_event(
                db,
                "booking_completed",
                user_id=booking.user_id,
                style_id=booking.style_id,
                booking_id=booking.id,
                shop_id=booking.shop_id,
                amount_cents=booking.amount_cents,
            )
            self.analytics.record_server_event(
                db,
                "revenue_recorded",
                user_id=booking.user_id,
                style_id=booking.style_id,
                booking_id=booking.id,
                shop_id=booking.shop_id,
                amount_cents=booking.amount_cents,
            )
        elif status_value == "cancelled":
            self.analytics.record_server_event(
                db,
                "booking_cancelled",
                user_id=booking.user_id,
                style_id=booking.style_id,
                booking_id=booking.id,
                shop_id=booking.shop_id,
                amount_cents=booking.amount_cents,
            )
        return booking
