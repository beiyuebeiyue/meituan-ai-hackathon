#!/usr/bin/env python3
import argparse
import os
from pathlib import Path

from scripts.utils import load_json, save_json


def note_ids_from_summary(summary):
    return sorted(
        {
            note_id
            for batch in summary["batch"].values()
            for raw_file in batch["files"]
            for note_id in raw_file["note_ids"]
        }
    )


def build_registry_from_summaries(assets_root: Path):
    runs = {}
    note_ids = set()
    for summary_path in sorted(assets_root.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_search_summary.json")):
        summary = load_json(summary_path)
        run_key = Path(summary["run_dir"]).name
        run_note_ids = note_ids_from_summary(summary)
        runs[run_key] = {"count": summary["count"]}
        note_ids.update(run_note_ids)
    return {
        "runs": runs,
        "unique_count": len(note_ids),
        "note_ids": sorted(note_ids),
    }


def merge_current_summary(registry_path: Path, summary_path: Path):
    summary = load_json(summary_path)
    registry = load_json(registry_path) if registry_path.exists() else {"runs": {}, "note_ids": []}
    run_key = Path(summary["run_dir"]).name
    note_ids = sorted(set(registry["note_ids"]) | set(note_ids_from_summary(summary)))
    return {
        "runs": registry["runs"] | {run_key: {"count": summary["count"]}},
        "unique_count": len(note_ids),
        "note_ids": note_ids,
    }


parser = argparse.ArgumentParser()
parser.add_argument("--rebuild", action="store_true", help="Rebuild registry from current assets/*/xhs_search_summary.json files.")
args = parser.parse_args()

registry_path = Path(os.environ["REGISTRY_PATH"])
if args.rebuild:
    registry = build_registry_from_summaries(registry_path.parent)
else:
    registry = merge_current_summary(registry_path, Path(os.environ["SUMMARY_PATH"]))

save_json(registry_path, registry)
