#!/usr/bin/env python3
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "services" / "api"))
sys.path.insert(0, str(Path.cwd()))

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import database, init_db
from app.models.booking import Booking
from app.models.nail_style import NailStyle
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.merchant_service import MerchantShopService
from scripts.import_digest_standard_posts import generated_phone, load_digest, username_for_note


SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")
AMOUNTS = [6800, 8800, 9800, 12800, 15800, 18800, 22800, 26800, 32800]


def rng_for(*parts):
    return random.Random(":".join(str(part) for part in parts))


def booking_count(run_date, note_id):
    return rng_for(run_date, note_id, "count").choices([0, 1, 2], weights=[35, 50, 15], k=1)[0]


def amount_for_marker(marker):
    return rng_for(marker, "amount").choice(AMOUNTS)


def status_for_marker(marker):
    return "completed" if rng_for(marker, "status").random() < 0.7 else "rejected"


def local_datetime(run_date, marker):
    rng = rng_for(marker, "time")
    base_date = datetime.strptime(run_date, "%Y%m%d").replace(tzinfo=SHANGHAI_TZ)
    day = base_date - timedelta(days=rng.randint(0, 30))
    return day.replace(hour=rng.randint(9, 21), minute=rng.choice([0, 15, 30, 45]))


def imported_styles_by_note_id(db):
    rows = {}
    for style in db.scalars(select(NailStyle)):
        metadata = style.style_metadata_json if isinstance(style.style_metadata_json, dict) else {}
        note_id = metadata.get("xhs_note_id")
        if isinstance(note_id, str):
            rows[note_id] = style
    return rows


def existing_booking(db, marker):
    return db.scalar(select(Booking).where(Booking.note == marker))


def update_existing_demo_amounts(db, run_date):
    updated = 0
    for booking in db.scalars(select(Booking).where(Booking.note.like(f"xhs_demo_booking:{run_date}:%"))):
        price = amount_for_marker(booking.note)
        if booking.amount_cents != price:
            booking.amount_cents = price
            db.add(booking)
            updated += 1
    return updated


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m scripts.generate_demo_bookings <YYYYmmdd>")
    run_date = sys.argv[1]

    database.configure(get_settings().database_url)
    init_db()
    digest = load_digest(run_date)
    result = {
        "date": run_date,
        "users_seen": 0,
        "bookings_created": 0,
        "completed": 0,
        "rejected": 0,
        "bookings_updated": 0,
        "skipped_existing": 0,
        "skipped_missing_user": 0,
    }

    with database.session() as db:
        admin = AuthService().ensure_default_admin(db)
        shop = MerchantShopService().ensure_default_admin_shop(db, admin)
        styles_by_note_id = imported_styles_by_note_id(db)
        result["bookings_updated"] += update_existing_demo_amounts(db, run_date)

        for note in digest["notes"]:
            username = username_for_note(note)
            user = db.scalar(select(User).where(User.username == username))
            if user is None:
                result["skipped_missing_user"] += 1
                continue
            if not user.phone:
                user.phone = generated_phone(db, username, user.id)
                db.add(user)
                db.flush()

            result["users_seen"] += 1
            for index in range(booking_count(run_date, note["note_id"])):
                marker = f"xhs_demo_booking:{run_date}:{note['note_id']}:{index}"
                price = amount_for_marker(marker)
                existing = existing_booking(db, marker)
                if existing is not None:
                    if existing.amount_cents != price:
                        existing.amount_cents = price
                        db.add(existing)
                        result["bookings_updated"] += 1
                    result["skipped_existing"] += 1
                    continue

                status = status_for_marker(marker)
                appointment = local_datetime(run_date, marker)
                timestamp = appointment.astimezone(timezone.utc)
                booking = Booking(
                    user_id=user.id,
                    merchant_user_id=shop.merchant_user_id,
                    shop_id=shop.id,
                    style_id=getattr(styles_by_note_id.get(note["note_id"]), "id", None),
                    appointment_time=appointment.strftime("%Y-%m-%d %H:%M"),
                    contact_phone=user.phone,
                    amount_cents=price,
                    status=status,
                    note=marker,
                    created_at=timestamp,
                    updated_at=timestamp,
                )
                db.add(booking)
                result["bookings_created"] += 1
                result[status] += 1

        db.commit()

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
