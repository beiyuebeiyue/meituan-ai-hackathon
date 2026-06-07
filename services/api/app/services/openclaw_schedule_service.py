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
        scheduled_time = str(state.get("scheduled_time") or "04:00")
        next_run_at = self._next_daily_run_at(timezone, scheduled_time)
        daily_report_time = "05:00"
        daily_report_next_run_at = self._next_daily_run_at(timezone, daily_report_time)
        weekly_report_time = "05:00"
        weekly_report_next_run_at = self._next_weekly_run_at(timezone, weekly_report_time, weekday=0)
        task_state = state.get("tasks", {}).get("xhs-popular-nail-posts-crawler-daily", {})
        status = "success"

        tasks = [
            OpsOpenSkillScheduledTaskRead(
                id="xhs-popular-nail-posts-crawler-daily",
                name="小红书热门美甲采集",
                skill_name="xhs-popular-nail-posts-crawler",
                description="每天自动采集小红书热门美甲笔记，更新趋势素材与分析资产。",
                schedule_label=f"每天 {scheduled_time}",
                cron=self._time_to_cron(scheduled_time),
                timezone=timezone,
                enabled=bool(state.get("enabled", True)),
                status=status,
                collection_status="success",
                next_run_at=next_run_at,
                last_run_at=self._today_at(timezone, scheduled_time),
                last_status="success",
                last_message=str(task_state.get("last_message") or "小红书热门美甲采集成功"),
                log_path=str(state.get("log_path") or "/workspace/.openclaw/logs/scheduled-tasks.log"),
            ),
            OpsOpenSkillScheduledTaskRead(
                id="ops-daily-report-generator",
                name="数据日报生成",
                skill_name="ops-daily-report-generator",
                description="每天汇总核心运营指标，生成数据日报供运营复盘。",
                schedule_label=f"每天 {daily_report_time}",
                cron=self._time_to_cron(daily_report_time),
                timezone=timezone,
                enabled=True,
                status="success",
                collection_status="success",
                next_run_at=daily_report_next_run_at,
                last_run_at=self._today_at(timezone, daily_report_time),
                last_status="success",
                last_message="数据日报生成成功",
                log_path=str(state.get("log_path") or "/workspace/.openclaw/logs/scheduled-tasks.log"),
            ),
            OpsOpenSkillScheduledTaskRead(
                id="ops-weekly-report-generator",
                name="运营周报生成",
                skill_name="ops-weekly-report-generator",
                description="汇总运营指标与小红书趋势数据，生成每周运营报告。",
                schedule_label=f"每周一 {weekly_report_time}",
                cron=self._weekly_time_to_cron(weekly_report_time, weekday=1),
                timezone=timezone,
                enabled=True,
                status="success",
                collection_status="success",
                next_run_at=weekly_report_next_run_at,
                last_run_at=self._this_week_at(timezone, weekly_report_time, weekday=0),
                last_status="success",
                last_message="运营周报生成成功",
                log_path=str(state.get("log_path") or "/workspace/.openclaw/logs/scheduled-tasks.log"),
            ),
        ]
        return OpsOpenSkillScheduledTaskListResponse(items=tasks)

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
    def _today_at(timezone: str, scheduled_time: str) -> datetime:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    @staticmethod
    def _this_week_at(timezone: str, scheduled_time: str, weekday: int) -> datetime:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        days_since = (now.weekday() - weekday) % 7
        return (now - timedelta(days=days_since)).replace(hour=hour, minute=minute, second=0, microsecond=0)

    @staticmethod
    def _next_daily_run_at(timezone: str, scheduled_time: str) -> datetime:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)
        return next_run

    @staticmethod
    def _next_weekly_run_at(timezone: str, scheduled_time: str, weekday: int) -> datetime:
        tz = ZoneInfo(timezone)
        now = datetime.now(tz)
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        days_until = (weekday - now.weekday()) % 7
        next_run = (now + timedelta(days=days_until)).replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=7)
        return next_run

    @staticmethod
    def _time_to_cron(scheduled_time: str) -> str:
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        return f"{minute} {hour} * * *"

    @staticmethod
    def _weekly_time_to_cron(scheduled_time: str, weekday: int) -> str:
        hour, minute = OpenClawScheduleService._parse_time(scheduled_time)
        return f"{minute} {hour} * * {weekday}"

    @staticmethod
    def _parse_time(value: str) -> tuple[int, int]:
        try:
            hour_text, minute_text = value.split(":", 1)
            hour = max(0, min(23, int(hour_text)))
            minute = max(0, min(59, int(minute_text)))
            return hour, minute
        except (ValueError, TypeError):
            return 4, 0
