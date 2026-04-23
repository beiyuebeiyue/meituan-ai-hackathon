from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass
class TrendSnapshotPayload:
    source_name: str
    snapshot_date: date
    raw_count: int
    valid_count: int
    payload_json: dict[str, object]


class TrendSourceAdapter:
    def fetch_snapshot(self, snapshot_date: date) -> TrendSnapshotPayload:
        raise NotImplementedError


class MockTrendSourceAdapter(TrendSourceAdapter):
    def fetch_snapshot(self, snapshot_date: date) -> TrendSnapshotPayload:
        payload = {
            "top_tags": [
                {"tag": "裸粉", "count": 23},
                {"tag": "法式", "count": 18},
                {"tag": "猫眼", "count": 12},
            ],
            "summary": "Mock 外部趋势显示裸粉与法式持续升温。",
        }
        return TrendSnapshotPayload(
            source_name="mock_trend_source",
            snapshot_date=snapshot_date,
            raw_count=60,
            valid_count=53,
            payload_json=payload,
        )
