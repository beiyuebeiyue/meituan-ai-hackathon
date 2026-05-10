#!/usr/bin/env python3
import json
import os
import urllib.request
from pathlib import Path

from scripts.utils import load_json, save_bytes, save_json

def image_urls(read_json):
    urls = []
    for item in read_json["data"]["items"]:
        for image in item["note_card"]["image_list"]:
            url = image["url_default"]
            if url and url not in urls:
                urls.append(url)
    return urls


def download(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://www.xiaohongshu.com/",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


read_dir = Path(os.environ["READ_DIR"])
images_dir = Path(os.environ["IMAGES_DIR"])
digest_path = Path(os.environ["RUN_ROOT"]) / "xhs_note_digest.json"
digest = load_json(digest_path)
digest_notes = {note["note_id"]: note for note in digest["notes"]}
image_root = f"assets/{digest['run_dir']}"
reports = []

for read_path in sorted(read_dir.glob("*.json")):
    note_id = read_path.stem
    note_dir = images_dir / note_id
    saved = []

    for index, url in enumerate(image_urls(load_json(read_path)), start=1):
        payload = download(url)
        output_path = note_dir / f"{note_id}_{index:02d}.webp"
        save_bytes(output_path, payload)
        saved.append(f"{image_root}/images/{note_id}/{output_path.name}")

    digest_notes[note_id]["image_list"] = saved
    reports.append({"note_id": note_id, "image_count": len(saved), "images": saved})

save_json(digest_path, digest)

print(
    json.dumps(
        {
            "images_dir": str(images_dir),
            "note_count": len(reports),
            "image_count": sum(report["image_count"] for report in reports),
            "notes": reports,
        },
        ensure_ascii=False,
    )
)
