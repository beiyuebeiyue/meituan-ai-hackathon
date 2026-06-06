#!/usr/bin/env python3
import argparse
import os
import re
from pathlib import Path

from scripts.utils import load_json, note_id, save_json

PAGE_RE = re.compile(r"^popular_p(\d+)\.json$")


def page_number(path):
    return int(PAGE_RE.match(path.name).group(1))


parser = argparse.ArgumentParser()
parser.add_argument("--batch-id", required=True, help="batch id")
parser.add_argument("--keyword", required=True, help="keyword")
args = parser.parse_args()

run_root = Path(os.environ["RUN_ROOT"])
summary_path = Path(os.environ["SUMMARY_PATH"])
batch_dir = Path(os.environ["SEARCH_DIR"]) / args.batch_id
run_dir = f"assets/{run_root.name}"

summary = (
    load_json(summary_path)
    if summary_path.exists()
    else {"run_dir": run_dir, "sort": "popular", "type": "image", "count": 0, "batch": {}}
)

files = []
for raw_path in sorted(batch_dir.glob("popular_p*.json"), key=page_number):
    ids = []
    for item in load_json(raw_path)["data"]["items"]:
        current_note_id = note_id(item)
        if item.get("model_type") == "note" and current_note_id:
            ids.append(current_note_id)

    files.append(
        {
            "page": page_number(raw_path),
            "raw_path": f"{run_dir}/search/{args.batch_id}/{raw_path.name}",
            "count": len(ids),
            "note_ids": ids,
        }
    )

summary["batch"][args.batch_id] = {
    "keyword": args.keyword,
    "count": sum(raw_file["count"] for raw_file in files),
    "files": files,
}
summary["count"] = sum(batch["count"] for batch in summary["batch"].values())

save_json(summary_path, summary)
