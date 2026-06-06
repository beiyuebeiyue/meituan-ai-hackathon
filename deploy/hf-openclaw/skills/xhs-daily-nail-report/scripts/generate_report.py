#!/usr/bin/env python3
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from scripts.utils import load_json, save_text

REPORT_NAME = "xhs_daily_nail_report.md"
SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")
TOP_LIMIT = 5
GALLERY_IMAGE_WIDTH = 40


def date_key(value):
    return value.strftime("%Y%m%d")


def date_label(value):
    return value.strftime("%Y-%m-%d")


def parse_date(value):
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    return None


def count_value(note, field):
    return int(note.get(field) or 0)


def hot_score(note):
    return count_value(note, "liked_count") + count_value(note, "collected_count") + count_value(note, "share_count")


def standard_nail_image(note):
    return str(note.get("standard_nail_image") or "").strip()


def read_digests(crawler_assets, target_date):
    digests = []
    for digest_path in sorted(crawler_assets.glob("[0-9]" * 8 + "/xhs_note_digest.json")):
        source_date = parse_date(digest_path.parent.name)
        if source_date is None or source_date > target_date:
            continue
        payload = load_json(digest_path)
        digests.append({"date": source_date, "notes": payload.get("notes", [])})
    return digests


def dedupe_notes(digests):
    by_id = {}
    for digest in sorted(digests, key=lambda item: item["date"]):
        source_date = date_key(digest["date"])
        for note in digest["notes"]:
            note_id = note.get("note_id")
            if note_id:
                by_id[note_id] = {**note, "_source_date": source_date}
    return list(by_id.values())


def filter_notes_by_publish_date(notes, target_date, days):
    start_date = target_date - timedelta(days=days - 1)
    missing_publish_date = 0
    rows = []
    for note in notes:
        if not standard_nail_image(note):
            continue
        publish_date = parse_date(note.get("publish_date"))
        if publish_date is None:
            missing_publish_date += 1
            continue
        if start_date <= publish_date <= target_date:
            rows.append({**note, "_publish_date": publish_date, "_hot_score": hot_score(note)})
    return sorted(rows, key=lambda note: note["_hot_score"], reverse=True), start_date, missing_publish_date


def tag_text(note):
    tags = [str(tag).strip() for tag in note.get("tag_list", []) if str(tag).strip()]
    return "、".join(tags) if tags else "-"


def note_table(notes):
    if not notes:
        return "暂无数据。\n"
    lines = [
        "| 排名 | 标签 | 图片 | 点赞 | 收藏 | 分享 |",
        "| --- | --- | --- | ---: | ---: | ---: |",
    ]
    for index, note in enumerate(notes[:TOP_LIMIT], start=1):
        image = standard_nail_image(note) or "-"
        lines.append(
            "| {index} | {tags} | `{image}` | {like} | {collect} | {share} |".format(
                index=index,
                tags=tag_text(note).replace("|", " "),
                image=image,
                like=count_value(note, "liked_count"),
                collect=count_value(note, "collected_count"),
                share=count_value(note, "share_count"),
            )
        )
    return "\n".join(lines) + "\n"


def image_gallery(notes, limit=TOP_LIMIT):
    lines = []
    for index, note in enumerate(notes[:limit], start=1):
        image = standard_nail_image(note)
        if image:
            lines.append(f'<img src="{image}" alt="款式 {index}" width="{GALLERY_IMAGE_WIDTH}" />')
    if not lines:
        return "暂无图片。\n"
    return "\n".join(lines) + "\n"


def render_report(target_date, source_dates, windows):
    lines = [
        f"# 焕甲小红书美甲日报（{date_label(target_date)}）",
    ]

    lines.extend(["", "## 近 1 天热门款式", note_table(windows["近 1 天"]["notes"])])
    lines.extend(["## 近 1 天代表图片", image_gallery(windows["近 1 天"]["notes"], TOP_LIMIT)])

    lines.extend(["## 近 7 天趋势", note_table(windows["近 7 天"]["notes"])])

    lines.extend(["## 近 30 天趋势", note_table(windows["近 30 天"]["notes"])])
    lines.append("")
    return "\n".join(lines)


skill_dir = Path(__file__).resolve().parents[1]
skills_dir = skill_dir.parent
crawler_assets = skills_dir / "xhs-popular-nail-posts-crawler" / "assets"
target_date = datetime.now(SHANGHAI_TZ).date()
report_dir = skill_dir / "assets" / date_key(target_date)

digests = read_digests(crawler_assets, target_date)
source_dates = [date_key(item["date"]) for item in digests]
all_notes = dedupe_notes(digests)

windows = {}
for label, days in [("近 1 天", 1), ("近 7 天", 7), ("近 30 天", 30)]:
    notes, start_date, missing_publish_date = filter_notes_by_publish_date(all_notes, target_date, days)
    windows[label] = {
        "start_date": start_date,
        "missing_publish_date": missing_publish_date,
        "notes": notes,
    }

report_path = report_dir / REPORT_NAME
save_text(report_path, render_report(target_date, source_dates, windows))
print(report_path)
