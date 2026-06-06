from __future__ import annotations

import threading
import time
from datetime import datetime
import os
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.db import database
from app.services.job_log_service import JobLogService
from app.services.trend_nail_service import TrendNailService


_scheduler_started = False
_scheduler_lock = threading.Lock()


def start_weekly_trend_campaign_scheduler() -> None:
    settings = get_settings()
    if not settings.auto_trend_campaign_enabled or os.getenv("PYTEST_CURRENT_TEST"):
        return

    global _scheduler_started
    with _scheduler_lock:
        if _scheduler_started:
            return
        _scheduler_started = True

    thread = threading.Thread(target=_scheduler_loop, name="weekly-trend-campaign", daemon=True)
    thread.start()


def _scheduler_loop() -> None:
    settings = get_settings()
    if settings.auto_trend_campaign_run_on_startup:
        time.sleep(max(0, settings.auto_trend_campaign_startup_delay_seconds))
        _run_once()

    while True:
        time.sleep(60 * 60)
        now = datetime.now(ZoneInfo(settings.ops_report_timezone))
        if now.hour >= settings.auto_trend_campaign_hour:
            _run_once()


def _run_once() -> None:
    job_logs = JobLogService()
    service = TrendNailService()
    with database.session() as db:
        job = job_logs.start(db, "auto_trend_campaign", message="检查本周热门款式自动推送")
        try:
            campaign = service.create_weekly_auto_campaign(db)
            payload = {"campaign_id": campaign.id, "style_count": len(campaign.styles)} if campaign else {"campaign_id": None}
            message = "本周热门款式推送已生成" if campaign else "暂无可推送的热门手工甲款式"
            job_logs.finish(db, job, status="succeeded", message=message, payload=payload)
        except Exception as exc:
            job_logs.finish(db, job, status="failed", message=str(exc), payload={})
