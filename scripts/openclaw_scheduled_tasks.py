#!/usr/bin/env python3
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


TASK_ID = "xhs-popular-nail-posts-crawler-daily"
SKILL_NAME = "xhs-popular-nail-posts-crawler"


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


TIMEZONE = os.getenv("OPENCLAW_SCHEDULE_TIMEZONE", "Asia/Shanghai")
SCHEDULED_TIME = os.getenv("OPENCLAW_XHS_CRAWLER_DAILY_TIME", "04:00")
STATE_PATH = Path(os.getenv("OPENCLAW_SCHEDULE_STATE_PATH", "/workspace/.openclaw/logs/scheduled-tasks.json"))
LOG_PATH = Path(os.getenv("OPENCLAW_SCHEDULE_LOG_PATH", "/workspace/.openclaw/logs/scheduled-tasks.log"))
OPENCLAW_BASE_URL = os.getenv("OPENCLAW_BASE_URL", "http://127.0.0.1:18798").rstrip("/")
OPENCLAW_MODEL = os.getenv("OPENCLAW_MODEL", "openclaw/default")
HF_BUCKET_URI = os.getenv("HF_BUCKET_URI", "hf://buckets/dongli/meituan-ai-hackathon-storage")
ENABLED = env_bool("OPENCLAW_SCHEDULE_ENABLED", True)


def log(message: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(ZoneInfo(TIMEZONE)).isoformat(timespec="seconds")
    with LOG_PATH.open("a", encoding="utf-8") as file:
        file.write(f"[{timestamp}] {message}\n")


def parse_time(value: str) -> tuple[int, int]:
    try:
        hour_text, minute_text = value.split(":", 1)
        return max(0, min(23, int(hour_text))), max(0, min(59, int(minute_text)))
    except (ValueError, TypeError):
        return 4, 0


def next_run_at(now: datetime) -> datetime:
    hour, minute = parse_time(SCHEDULED_TIME)
    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def read_state() -> dict[str, object]:
    if not STATE_PATH.exists():
        return {}
    try:
        raw = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return raw if isinstance(raw, dict) else {}


def write_state(task_state: dict[str, object]) -> None:
    now = datetime.now(ZoneInfo(TIMEZONE))
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    state = {
        "enabled": ENABLED,
        "timezone": TIMEZONE,
        "scheduled_time": SCHEDULED_TIME,
        "status": "scheduled" if ENABLED else "disabled",
        "updated_at": now.isoformat(timespec="seconds"),
        "log_path": str(LOG_PATH),
        "tasks": {
            TASK_ID: {
                "id": TASK_ID,
                "skill_name": SKILL_NAME,
                **task_state,
            }
        },
    }
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def wait_for_openclaw() -> None:
    url = f"{OPENCLAW_BASE_URL}/v1/models"
    for attempt in range(90):
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status < 500:
                    return
        except urllib.error.URLError:
            pass
        time.sleep(2 if attempt < 15 else 10)
    raise RuntimeError("OpenClaw gateway is not ready")


def call_openclaw_crawler() -> str:
    prompt = (
        "请运行 xhs-popular-nail-posts-crawler skill。"
        "按 skill 默认流程采集小红书热门美甲 image 笔记，创建当天 assets/<YYYYmmdd>/ run，"
        "生成 xhs_search_summary.json、xhs_note_registry.json、xhs_note_digest.json，"
        "下载图片，执行美甲分割，分析图片特征，并尽量导入标准美甲帖子。"
        "这是每日自动任务，请避免交互式提问；如果登录态或外部依赖不可用，请说明失败原因。"
    )
    payload = {
        "model": OPENCLAW_MODEL,
        "messages": [
            {"role": "system", "content": "You are the Huanjia ops automation runner. Use available workspace skills when requested."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    request = urllib.request.Request(
        f"{OPENCLAW_BASE_URL}/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60 * 60 * 2) as response:
        data = json.loads(response.read().decode("utf-8"))
    choices = data.get("choices") or []
    message = choices[0].get("message", {}) if choices else {}
    return str(message.get("content") or "OpenClaw crawler finished")


def sync_bucket_outputs() -> None:
    if not os.getenv("HF_TOKEN"):
        log("HF_TOKEN is not set; skip scheduled task bucket sync")
        return
    targets = [
        ("/data/xhs-popular-nail-posts-crawler/assets", f"{HF_BUCKET_URI}/xhs-popular-nail-posts-crawler/assets"),
        ("/data/xhs-daily-nail-report/assets", f"{HF_BUCKET_URI}/xhs-daily-nail-report/assets"),
    ]
    for source, destination in targets:
        subprocess.run(["hf", "sync", source, destination, "--token", os.environ["HF_TOKEN"]], check=False)


def should_run_today(now: datetime, state: dict[str, object]) -> bool:
    hour, minute = parse_time(SCHEDULED_TIME)
    scheduled = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if now < scheduled:
        return False
    task_state = (state.get("tasks") or {}).get(TASK_ID, {}) if isinstance(state.get("tasks"), dict) else {}
    return task_state.get("last_run_date") != now.date().isoformat()


def run_once() -> None:
    started_at = datetime.now(ZoneInfo(TIMEZONE))
    log(f"Starting scheduled task {TASK_ID}")
    write_state(
        {
            "status": "running",
            "last_run_date": started_at.date().isoformat(),
            "last_run_at": started_at.isoformat(timespec="seconds"),
            "last_status": "running",
            "last_message": "OpenClaw crawler is running",
        }
    )
    try:
        wait_for_openclaw()
        message = call_openclaw_crawler()
        sync_bucket_outputs()
        log(f"Finished scheduled task {TASK_ID}: {message[:500]}")
        write_state(
            {
                "status": "scheduled",
                "last_run_date": started_at.date().isoformat(),
                "last_run_at": started_at.isoformat(timespec="seconds"),
                "last_status": "success",
                "last_message": message[:1000],
            }
        )
    except Exception as exc:
        log(f"Scheduled task {TASK_ID} failed: {exc}")
        write_state(
            {
                "status": "failed",
                "last_run_date": started_at.date().isoformat(),
                "last_run_at": started_at.isoformat(timespec="seconds"),
                "last_status": "failed",
                "last_message": str(exc),
            }
        )


def main() -> None:
    initial_state = read_state()
    current_task = {}
    if isinstance(initial_state.get("tasks"), dict):
        current_task = initial_state["tasks"].get(TASK_ID, {})
    write_state(current_task if isinstance(current_task, dict) else {})
    log(f"OpenClaw scheduled task runner started; enabled={ENABLED}; time={SCHEDULED_TIME}; timezone={TIMEZONE}")
    if not ENABLED:
        return
    while True:
        now = datetime.now(ZoneInfo(TIMEZONE))
        state = read_state()
        if should_run_today(now, state):
            run_once()
        sleep_seconds = 300
        next_run = next_run_at(now)
        if next_run > now:
            sleep_seconds = min(sleep_seconds, max(30, int((next_run - now).total_seconds())))
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    main()
