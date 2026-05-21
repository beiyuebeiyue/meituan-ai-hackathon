from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.config import get_settings
from app.core.db import database, init_db
from app.models.booking import Booking
from app.models.tryon_job import TryOnJob
from app.services.analytics_service import AnalyticsService


def main() -> None:
    database.configure(get_settings().database_url)
    init_db()
    service = AnalyticsService()
    counts = {"tryon": 0, "booking": 0}
    with database.session() as db:
        for job in db.query(TryOnJob).all():
            service.record_server_event(
                db,
                "tryon_started",
                user_id=job.user_id,
                style_id=job.selected_style_id,
                tryon_job_id=job.id,
                source="backfill",
                occurred_at=job.created_at,
            )
            if job.status == "succeeded":
                service.record_server_event(
                    db,
                    "tryon_completed",
                    user_id=job.user_id,
                    style_id=job.selected_style_id,
                    tryon_job_id=job.id,
                    source="backfill",
                    occurred_at=job.updated_at,
                )
            elif job.status == "failed":
                service.record_server_event(
                    db,
                    "tryon_failed",
                    user_id=job.user_id,
                    style_id=job.selected_style_id,
                    tryon_job_id=job.id,
                    source="backfill",
                    occurred_at=job.updated_at,
                )
            counts["tryon"] += 1

        for booking in db.query(Booking).all():
            service.record_server_event(
                db,
                "booking_created",
                user_id=booking.user_id,
                style_id=booking.style_id,
                booking_id=booking.id,
                shop_id=booking.shop_id,
                amount_cents=booking.amount_cents,
                source="backfill",
                occurred_at=booking.created_at,
            )
            if booking.status == "completed":
                service.record_server_event(
                    db,
                    "booking_completed",
                    user_id=booking.user_id,
                    style_id=booking.style_id,
                    booking_id=booking.id,
                    shop_id=booking.shop_id,
                    amount_cents=booking.amount_cents,
                    source="backfill",
                    occurred_at=booking.updated_at,
                )
                service.record_server_event(
                    db,
                    "revenue_recorded",
                    user_id=booking.user_id,
                    style_id=booking.style_id,
                    booking_id=booking.id,
                    shop_id=booking.shop_id,
                    amount_cents=booking.amount_cents,
                    source="backfill",
                    occurred_at=booking.updated_at,
                )
            elif booking.status == "cancelled":
                service.record_server_event(
                    db,
                    "booking_cancelled",
                    user_id=booking.user_id,
                    style_id=booking.style_id,
                    booking_id=booking.id,
                    shop_id=booking.shop_id,
                    amount_cents=booking.amount_cents,
                    source="backfill",
                    occurred_at=booking.updated_at,
                )
            counts["booking"] += 1
    print(counts)


if __name__ == "__main__":
    main()
