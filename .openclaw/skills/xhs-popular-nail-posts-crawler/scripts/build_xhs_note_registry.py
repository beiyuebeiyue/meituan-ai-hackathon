#!/usr/bin/env python3
import os
from pathlib import Path

from scripts.utils import load_json, save_json

summary = load_json(Path(os.environ["SUMMARY_PATH"]))
registry_path = Path(os.environ["REGISTRY_PATH"])
registry = load_json(registry_path) if registry_path.exists() else {"runs": {}, "note_ids": []}

run_note_ids = sorted(
    {
        note_id
        for batch in summary["batch"].values()
        for raw_file in batch["files"]
        for note_id in raw_file["note_ids"]
    }
)

registry["runs"][Path(summary["run_dir"]).name] = {
    "count": summary["count"],
}
registry["note_ids"] = sorted(set(registry["note_ids"]) | set(run_note_ids))
registry["unique_count"] = len(registry["note_ids"])

save_json(registry_path, registry)
