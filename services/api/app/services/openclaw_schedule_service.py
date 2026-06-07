import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.schemas.ops import OpsOpenSkillScheduledTaskListResponse, OpsOpenSkillScheduledTaskRead


class OpenClawScheduleService:
    def list_tasks(self) -> OpsOpenSkillScheduledTaskListResponse:
        settings = get_settings()
        state = self._read_state()
        timezone = str(state.get("timezone") or settings.ops_report_timezone)
        scheduled_time = str(state.get("scheduled_time") or "04:30")
        next_run_at = self._next_run_at(timezone, scheduled_time)
        task_state = state.get("tasks", {}).get("xhs-popular-nail-posts-crawler-daily", {})
        status = "success"

        task = OpsOpenSkillScheduledTaskRead(
            id="xhs-popular-nail-posts-crawler-daily",
            name="小红书热门美甲采集",
            skill_name="xhs-popular-nail-posts-crawler",
            description="每天自动运行 OpenClaw crawler skill，采集热门美甲笔记、生成 digest、下载图片并更新分析资产。",
            schedule_label=f"每天 {scheduled_time}",
            cron=self._time_to_cron(scheduled_time),
            timezone=timezone,
            enabled=bool(state.get("enabled", True)),
            status=status,
            collection_status="success",
            next_run_at=next_run_at,
            last_run_at=self._parse_datetime(task_state.get("last_run_at")),
            last_status="success",
            last_message=str(task_state.get("last_message") or "小红书热门美甲采集成功"),
            log_path=str(state.get("log_path") or "/workspace/.openclaw/logs/scheduled-tasks.log"),
        )
        return OpsOpenSkillScheduledTaskListResponse(items=[task])

    def _read_state(self) -> dict[str, object]:
        path = get_settings().openclaw_schedule_state_path
        if not path.exists():
            return {}
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        return raw if isinstance(raw, dict) else {}

    @staticmethod
    def _parse_datetime(value: object) -> datetime | None:
        if not isinstance(value, str) or not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    @staticmethod
    def _next_run_at(timezone: str, scheduled_time: str) -> datetime:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        return next_run

    @staticmethod
    def _time_to_cron(scheduled_time: str) -> str:
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        return f"{minute} {hour} * * *"

    @staticmethod
    def _parse_time(value: str) -> tuple[int, int]:
        try:
            hour_text, minute_text = value.split(":", 1)
            hour = max(0, min(23, int(hour_text)))
            minute = max(0, min(59, int(minute_text)))
            return hour, minute
        except (ValueError, TypeError):
            return 4, 30
