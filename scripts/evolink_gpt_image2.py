#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any
from urllib import request
from urllib.error import HTTPError, URLError


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"
DEFAULT_TRYON_PROMPT = (
    "Use Image 1 as the target hand image, Image 2 as the nail design reference, and the mask as the editable nail area. "
    "Keep all unmasked parts of Image 1 unchanged, including the hand, skin, pose, lighting, background, and camera angle. "
    "Transfer only the nail design from Image 2 onto the masked nail regions of Image 1. "
    "Adapt the design naturally to each nail's shape, angle, curvature, perspective, and lighting, "
    "so it looks realistic and originally applied to the hand.\n\n"
    "Negative Prompt:\n"
    "Do not change any unmasked area. Do not alter the hand shape, finger count, skin tone, background, lighting, or camera angle. "
    "Do not copy the hand or background from Image 2. Avoid distorted nails, floating decorations, blurry details, pasted edges, "
    "and unrealistic reflections."
)


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def env_value(values: dict[str, str], key: str, default: str = "") -> str:
    return os.environ.get(key) or values.get(key) or default


def post_json(url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    return send_json(req)


def get_json(url: str, token: str) -> dict[str, Any]:
    req = request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    return send_json(req)


def send_json(req: request.Request) -> dict[str, Any]:
    try:
        with request.urlopen(req, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Request failed: {exc.reason}") from exc


def build_payload(args: argparse.Namespace, env: dict[str, str]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": env_value(env, "EVOLINK_IMAGE_MODEL", "gpt-image-2"),
        "size": env_value(env, "EVOLINK_IMAGE_SIZE", "1:1"),
        "resolution": env_value(env, "EVOLINK_IMAGE_RESOLUTION", "1K"),
        "quality": env_value(env, "EVOLINK_IMAGE_QUALITY", "low"),
        "n": args.count,
    }
    prompt = args.prompt or DEFAULT_TRYON_PROMPT
    if prompt:
        payload["prompt"] = prompt
    ordered_tryon_urls = [
        args.hand_image_url,
        args.style_image_url,
    ]
    if args.include_mask_as_reference:
        ordered_tryon_urls.insert(1, args.hand_mask_url)
    image_urls = [url for url in ordered_tryon_urls if url]
    image_urls.extend(url for url in args.image_url if url)
    if image_urls:
        payload["image_urls"] = image_urls
    mask_url = args.mask_url or args.hand_mask_url
    if mask_url:
        payload["mask_url"] = mask_url
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare or submit an EvoLink GPT Image 2 async image task.")
    parser.add_argument("--prompt", default="", help="Prompt for the image task. Defaults to the nail try-on prompt.")
    parser.add_argument("--hand-image-url", default="", help="Original uploaded hand image URL. Placed first in image_urls.")
    parser.add_argument("--hand-mask-url", default="", help="Generated nail mask URL. Used as mask_url.")
    parser.add_argument("--style-image-url", default="", help="Target nail style image URL. Placed second in image_urls.")
    parser.add_argument(
        "--include-mask-reference",
        action="store_true",
        dest="include_mask_as_reference",
        help="Also include the mask as the second image_urls item for manual debugging.",
    )
    parser.add_argument("--image-url", action="append", default=[], help="Reference image URL. Can be passed multiple times.")
    parser.add_argument("--mask-url", default="", help="PNG alpha mask URL for image editing.")
    parser.add_argument("--count", type=int, default=1, choices=range(1, 11), metavar="1-10")
    parser.add_argument("--submit", action="store_true", help="Actually call EvoLink. Without this, only prints the request payload.")
    parser.add_argument("--poll", action="store_true", help="Poll task status after submit.")
    parser.add_argument("--poll-interval", type=float, default=5.0)
    parser.add_argument("--poll-timeout", type=float, default=240.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    env = load_env_file(ENV_PATH)
    base_url = env_value(env, "EVOLINK_API_BASE_URL", "https://api.evolink.ai").rstrip("/")
    payload = build_payload(args, env)
    create_url = f"{base_url}/v1/images/generations"

    if not args.submit:
        print(json.dumps({"url": create_url, "payload": payload}, ensure_ascii=False, indent=2))
        return 0

    token = env_value(env, "EVOLINK_API_KEY") or env_value(env, "OPENAI_API_KEY")
    if not token:
        raise SystemExit("EVOLINK_API_KEY or OPENAI_API_KEY is required")

    created = post_json(create_url, token, payload)
    print(json.dumps(created, ensure_ascii=False, indent=2))
    task_id = created.get("id")
    if not args.poll or not isinstance(task_id, str):
        return 0

    deadline = time.monotonic() + args.poll_timeout
    task_url = f"{base_url}/v1/tasks/{task_id}"
    while time.monotonic() < deadline:
        time.sleep(args.poll_interval)
        status_payload = get_json(task_url, token)
        print(json.dumps(status_payload, ensure_ascii=False, indent=2))
        if status_payload.get("status") in {"succeeded", "failed", "cancelled"}:
            return 0
    raise SystemExit(f"Polling timed out for task {task_id}")


if __name__ == "__main__":
    sys.exit(main())
