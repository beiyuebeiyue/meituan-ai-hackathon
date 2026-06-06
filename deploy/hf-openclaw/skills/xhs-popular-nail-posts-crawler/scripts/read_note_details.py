#!/usr/bin/env python3
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from scripts.utils import load_json, note_id, save_json, save_text

SLEEP_SECONDS = 0
SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")


def keyword_by_note_id(summary):
    keywords = {}
    for batch in summary["batch"].values():
        for raw_file in batch["files"]:
            for current_note_id in raw_file["note_ids"]:
                keywords.setdefault(current_note_id, batch["keyword"])
    return keywords


def count_value(value):
    text = str(value).strip()
    if text.endswith("万"):
        return int(float(text[:-1]) * 10000)
    return int(text)


def publish_date(value):
    return datetime.fromtimestamp(int(value) / 1000, SHANGHAI_TZ).strftime("%Y-%m-%d")


def digest_note(read_path, keyword):
    read_json = load_json(read_path)
    item = read_json["data"]["items"][0]
    note_card = item["note_card"]
    interact = note_card["interact_info"]

    return {
        "note_id": read_path.stem,
        "keyword": keyword,
        "time": note_card["time"],
        "publish_date": publish_date(note_card["time"]),
        "user_name": note_card["user"]["nickname"],
        "title": note_card["title"],
        "desc": note_card["desc"],
        "tag_list": [tag["name"] for tag in note_card["tag_list"]],
        "image_list": [image["url_default"] for image in note_card["image_list"]],
        "standard_nail_image": "",
        "liked_count": count_value(interact["liked_count"]),
        "collected_count": count_value(interact["collected_count"]),
        "share_count": count_value(interact["share_count"]),
    }


summary = load_json(Path(os.environ["SUMMARY_PATH"]))
run_root = Path(os.environ["RUN_ROOT"])
read_dir = Path(os.environ["READ_DIR"])
read_dir.mkdir(parents=True, exist_ok=True)
keywords = keyword_by_note_id(summary)

queue = []
seen = set()

for _batch_id, batch in sorted(summary["batch"].items(), key=lambda item: int(item[0])):
    for raw_file in sorted(batch["files"], key=lambda item: item["page"]):
        for item in load_json(Path(raw_file["raw_path"]))["data"]["items"]:
            if item.get("model_type") != "note":
                continue

            current_note_id = note_id(item)
            if not current_note_id or current_note_id in seen:
                continue
            seen.add(current_note_id)

            queue.append((current_note_id, item["xsec_token"]))

for index, (current_note_id, token) in enumerate(queue, start=1):
    note_url = f"https://www.xiaohongshu.com/explore/{current_note_id}"
    result = subprocess.run(
        ["xhs", "read", note_url, "--xsec-token", token, "--json"],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"xhs read failed: {current_note_id}\n{result.stderr.strip()}")

    output_path = read_dir / f"{current_note_id}.json"
    save_text(output_path, result.stdout)
    if index < len(queue) and SLEEP_SECONDS > 0:
        time.sleep(SLEEP_SECONDS)

save_json(
    run_root / "xhs_note_digest.json",
    {
        "run_dir": run_root.name,
        "count": len(queue),
        "notes": [
            digest_note(read_dir / f"{current_note_id}.json", keywords[current_note_id])
            for current_note_id, _token in queue
        ],
    },
)
