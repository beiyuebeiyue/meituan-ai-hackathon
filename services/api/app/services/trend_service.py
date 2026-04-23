from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trend_snapshot import TrendSnapshot
from app.providers.trend_source_adapter import MockTrendSourceAdapter, TrendSourceAdapter


class TrendService:
    def __init__(self, adapter: TrendSourceAdapter | None = None) -> None:
        self.adapter = adapter or MockTrendSourceAdapter()

    def fetch_and_store_snapshot(self, db: Session, snapshot_date: date) -> TrendSnapshot:
        existing = db.scalar(
            select(TrendSnapshot).where(
                TrendSnapshot.source_name == "mock_trend_source",
                TrendSnapshot.snapshot_date == snapshot_date,
            )
        )
        if existing is not None:
            return existing
        payload = self.adapter.fetch_snapshot(snapshot_date)
        snapshot = TrendSnapshot(
            source_name=payload.source_name,
            snapshot_date=payload.snapshot_date,
            raw_count=payload.raw_count,
            valid_count=payload.valid_count,
            payload_json=payload.payload_json,
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot

    def latest_snapshot(self, db: Session) -> TrendSnapshot | None:
        return db.scalar(select(TrendSnapshot).order_by(TrendSnapshot.snapshot_date.desc()))
