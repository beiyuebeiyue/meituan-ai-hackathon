#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SKILL_ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = SKILL_ROOT / "assets"
REGISTRY_PATH = ASSETS_DIR / "xhs_note_registry.json"
OUTPUT_PATH = ASSETS_DIR / "xhs_image_features.json"
MAX_TOKENS = 1200
DEFAULT_WORKERS = 4
MAX_ATTEMPTS = 2
STATUS_SUCCEEDED = 200
STATUS_MISSING_IMAGE = 404
STATUS_MODEL_FAILED = 422
STATUS_INCOMPLETE_CORE = 422
STATUS_FAILED = 500
REQUIRED_HAND_FEATURE_KEYS = ("finger_shape", "skin_undertone", "confidence")
REQUIRED_NAIL_FEATURE_KEYS = ("shape", "length", "colors", "finish", "confidence")
SHAPE_VALUES = ("杏仁", "方形", "方圆", "椭圆", "棺材", "芭蕾", "圆形", "尖形", "鸭嘴", "混合")
LENGTH_VALUES = ("短", "中", "长")
COLOR_VALUES = ("透明", "裸色", "粉色", "红色", "橙色", "黄色", "金色", "银色", "白色", "灰色", "黑色", "棕色", "绿色", "蓝色", "紫色")
FINISH_VALUES = ("亮面", "猫眼", "果冻", "磨砂", "闪粉", "镜面")
FINGER_SHAPE_VALUES = ("修长", "均衡", "敦实")
SKIN_UNDERTONE_VALUES = ("暖", "冷", "中性")
CONFIDENCE_VALUES = ("低", "中", "高")
VALUE_SETS = {
    "shape": set(SHAPE_VALUES),
    "length": set(LENGTH_VALUES),
    "colors": set(COLOR_VALUES),
    "finish": set(FINISH_VALUES),
    "finger_shape": set(FINGER_SHAPE_VALUES),
    "skin_undertone": set(SKIN_UNDERTONE_VALUES),
    "confidence": set(CONFIDENCE_VALUES),
}

if str(SKILL_ROOT) not in sys.path:
    sys.path.insert(0, str(SKILL_ROOT))

from scripts.utils import load_json, note_id, save_json  # noqa: E402


@dataclass(frozen=True)
class DigestEntry:
    note: dict[str, Any]
    run_dir: str


def find_repo_root(start: Path) -> Path:
    for path in [start, *start.parents]:
        if (path / ".env").exists() or (path / ".git").exists():
            return path
    return start


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


def load_config() -> tuple[str, str, str]:
    repo_root = find_repo_root(SKILL_ROOT)
    load_env_file(repo_root / ".env")
    api_key = os.environ.get("LONGCAT_API_KEY", "").strip()
    base_url = os.environ.get("LONGCAT_BASE_URL", "").strip()
    model = os.environ.get("LONGCAT_MULTIMODAL_MODEL", "").strip()
    missing = [key for key, value in {
        "LONGCAT_API_KEY": api_key,
        "LONGCAT_BASE_URL": base_url,
        "LONGCAT_MULTIMODAL_MODEL": model,
    }.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required LongCat env vars: {', '.join(missing)}")
    return api_key, base_url, model


def registry_note_ids(path: Path = REGISTRY_PATH) -> list[str]:
    registry = load_json(path)
    if isinstance(registry, dict):
        ids = registry.get("note_ids", [])
    elif isinstance(registry, list):
        ids = registry
    else:
        raise ValueError(f"Unsupported registry format: {path}")
    return list(dict.fromkeys(item_id for raw_id in ids if (item_id := str(raw_id).strip())))


def digest_notes(payload: Any) -> list[dict[str, Any]]:
    notes = payload.get("notes", []) if isinstance(payload, dict) else payload
    return [note for note in notes if isinstance(note, dict)]


def resolve_asset_path(path_value: str | None) -> Path | None:
    if not path_value:
        return None
    path = Path(str(path_value))
    return path if path.is_absolute() else SKILL_ROOT / path


def path_score(note: dict[str, Any], run_dir: str) -> tuple[int, int, str]:
    standard = resolve_asset_path(str(note.get("standard_nail_image") or ""))
    has_standard = int(bool(standard and standard.exists()))
    return has_standard, run_dir


def build_digest_index() -> dict[str, DigestEntry]:
    index: dict[str, DigestEntry] = {}
    for digest_path in sorted(ASSETS_DIR.glob("[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]/xhs_note_digest.json")):
        run_dir = digest_path.parent.name
        for note in digest_notes(load_json(digest_path)):
            item_id = note_id(note)
            if not item_id:
                continue
            item_id = str(item_id)
            current = index.get(item_id)
            if current is None or path_score(note, run_dir) > path_score(current.note, current.run_dir):
                index[item_id] = DigestEntry(note=note, run_dir=run_dir)
    return index


def select_image_path(note: dict[str, Any]) -> Path | None:
    standard = resolve_asset_path(str(note.get("standard_nail_image") or ""))
    if standard and standard.exists():
        return standard
    return None


def relative_asset_path(path: Path | None) -> str:
    if path is None:
        return ""
    try:
        return path.resolve().relative_to(SKILL_ROOT.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def base64_image_for_model(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def longcat_chat_completions_url(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    parsed = urlparse(normalized)
    if parsed.path.endswith("/openai/v1"):
        return f"{normalized}/chat/completions"
    if parsed.path.endswith("/openai"):
        return f"{normalized}/v1/chat/completions"
    return f"{normalized}/openai/v1/chat/completions"


def choices(values: tuple[str, ...]) -> str:
    return " | ".join(values)


def longcat_completion(
    api_key: str,
    base_url: str,
    model: str,
    image_path: Path,
    prompt: str,
    max_tokens: int = MAX_TOKENS,
) -> str:
    import httpx

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "你是专业美甲视觉标注助手。输出必须是严格 JSON，不要 markdown，不要自然语言解释。",
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_image",
                        "input_image": {
                            "type": "base64",
                            "data": [base64_image_for_model(image_path)],
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            },
        ],
        "temperature": 0.1,
        "max_tokens": max_tokens,
        "stream": False,
        "output_modalities": ["text"],
    }
    response = httpx.post(
        longcat_chat_completions_url(base_url),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )
    response.raise_for_status()
    response_payload = response.json()
    return response_payload["choices"][0]["message"].get("content") or ""


def image_feature_prompt(retry: bool = False) -> str:
    prompt = f"""请根据图片提取美甲检索 features。只返回一个严格合法的 JSON 对象，不要 markdown，不要解释。

判定步骤：
1. 先判断图片是否是“已完成、可参考的美甲款式图”。
2. 如果只是裸甲、未做款式的手图、求推荐手图、手部护理图、工具/产品图、文字截图、看不清指甲/甲片、主体不是美甲、或构图导致无法判断款式，返回 failed。
3. 只有能看出具体美甲款式时，返回 succeeded 并提取 features。

JSON 规则：
- 必须使用英文双引号。
- 禁止输出中文引号、markdown、注释、null、unknown、<unk>、_comment、多余 key。
- 所有枚举值必须从 choices 中选择；不确定时选最接近项，并把 confidence 设为 低。
- 所有判断只能来自图片，不要依赖标题、描述或标签。

失败输出格式：
{{"status":"failed","error":"一句中文失败原因","features":{{}}}}

成功输出格式：
{{"status":"succeeded","error":"","features":{{"hand":{{"finger_shape":"{choices(FINGER_SHAPE_VALUES)}","skin_undertone":"{choices(SKIN_UNDERTONE_VALUES)}","confidence":"{choices(CONFIDENCE_VALUES)}"}},"nail":{{"shape":"{choices(SHAPE_VALUES)}","length":"{choices(LENGTH_VALUES)}","colors":["{choices(COLOR_VALUES)}"],"finish":["{choices(FINISH_VALUES)}"],"confidence":"{choices(CONFIDENCE_VALUES)}"}}}}}}

成功必填：
- nail.shape 非空
- nail.length 非空
- nail.colors 非空数组
- finish 可为空数组；hand 字段必须输出，但不确定时用低置信度近似判断。

颜色规则：
- nail.colors 只能描述指甲/甲片颜色，不能把肤色、背景、衣服、滤镜颜色当成甲面颜色。
- colors 可以有一个或多个基础色系。
- 细分色必须归并：深绿/墨绿/深蓝绿/橄榄绿 -> 绿色；酒红/枣红 -> 红色；裸粉/豆沙粉 -> 粉色或裸色；奶白/米白 -> 白色。
"""
    if retry:
        prompt += (
            "\n上一次输出无法被程序解析或核心字段缺失。请重新输出一个 JSON 对象："
            "若不是已完成美甲款式图，返回 failed 且 features 为 {}；"
            "若是美甲款式图，返回 succeeded，且 nail.shape、nail.length、nail.colors 必须非空。"
        )
    return prompt


def parse_json_response(content: str) -> dict[str, Any]:
    text = extract_json_text(content)
    for candidate in (text, repair_json_text(text)):
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict):
            raise ValueError("Model response JSON is not an object.")
        return parsed
    return json.loads(text)


def extract_json_text(content: str) -> str:
    text = content.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    if not text.startswith("{"):
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
    return text


def repair_json_text(text: str) -> str:
    repaired = (
        text.replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
    )
    repaired = re.sub(r"</?(?:unk|unknown)>", "", repaired)

    lines = []
    for line in repaired.splitlines():
        stripped = line.strip()
        if re.fullmatch(r'"[^"]+"\s*,?', stripped) and not stripped.rstrip(",").endswith(("}", "]")):
            continue
        lines.append(line)

    repaired = "\n".join(lines)
    repaired = re.sub(r",(\s*[}\]])", r"\1", repaired)
    return repaired


def string_value(value: Any, allowed: set[str] | None = None, default: str = "") -> str:
    if not isinstance(value, str):
        return default
    value = value.strip()
    if not value or (allowed is not None and value not in allowed):
        return default
    return value


def string_list(value: Any, allowed: set[str] | None = None, limit: int = 12) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = str(item).strip()
        if not text:
            continue
        if allowed is not None and text not in allowed:
            continue
        if text not in result:
            result.append(text)
        if len(result) >= limit:
            break
    return result


def normalize_features(parsed: dict[str, Any]) -> dict[str, Any]:
    status = string_value(parsed.get("status"), {"succeeded", "failed"}, default="succeeded")
    if status == "failed":
        error = string_value(parsed.get("error"), default="model marked image as failed")
        raise ValueError(f"model_failed: {error}")

    raw = parsed.get("features", parsed)
    if not isinstance(raw, dict):
        raw = {}
    raw_hand = raw.get("hand") if isinstance(raw.get("hand"), dict) else raw
    raw_nail = raw.get("nail") if isinstance(raw.get("nail"), dict) else raw

    return {
        "hand": {
            "finger_shape": string_value(raw_hand.get("finger_shape"), VALUE_SETS["finger_shape"], default="均衡"),
            "skin_undertone": string_value(raw_hand.get("skin_undertone"), VALUE_SETS["skin_undertone"], default="中性"),
            "confidence": string_value(raw_hand.get("confidence"), VALUE_SETS["confidence"], default="低"),
        },
        "nail": {
            "shape": string_value(raw_nail.get("shape"), VALUE_SETS["shape"], default="椭圆"),
            "length": string_value(raw_nail.get("length"), VALUE_SETS["length"], default="中"),
            "colors": string_list(raw_nail.get("colors"), VALUE_SETS["colors"], limit=4),
            "finish": string_list(raw_nail.get("finish"), VALUE_SETS["finish"]),
            "confidence": string_value(raw_nail.get("confidence"), VALUE_SETS["confidence"], default="低"),
        },
    }


def analyze_image(api_key: str, base_url: str, model: str, image_path: Path) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            content = longcat_completion(api_key, base_url, model, image_path, image_feature_prompt(retry=attempt > 0))
            features = normalize_features(parse_json_response(content))
            if core_features_complete(features):
                return features
            raise ValueError("incomplete_core_features: model returned empty or incomplete nail shape, length, or colors")
        except ValueError as exc:
            if str(exc).startswith(("model_failed:", "incomplete_core_features:")):
                raise
            last_error = exc
        except Exception as exc:
            last_error = exc
    raise last_error or ValueError("analysis failed")


def load_output(path: Path = OUTPUT_PATH) -> dict[str, Any]:
    payload = load_json(path) if path.exists() else None
    if isinstance(payload, dict) and isinstance(payload.get("items"), list):
        return payload
    return {"items": []}


def write_output(path: Path, payload: dict[str, Any], registry_ids: list[str], item_map: dict[str, dict[str, Any]]) -> None:
    payload.clear()
    payload["items"] = [item_map[item_id] for item_id in registry_ids if item_id in item_map]
    save_json(path, payload)


def slim_features(features: Any) -> dict[str, Any]:
    if not isinstance(features, dict):
        return {}
    hand = features.get("hand")
    nail = features.get("nail")
    if isinstance(hand, dict) and isinstance(nail, dict):
        return {
            "hand": {key: hand[key] for key in REQUIRED_HAND_FEATURE_KEYS if key in hand},
            "nail": {key: nail[key] for key in REQUIRED_NAIL_FEATURE_KEYS if key in nail},
        }
    return {}


def slim_item(item: dict[str, Any]) -> dict[str, Any]:
    error = str(item.get("error") or "").strip()
    features = slim_features(item.get("features"))
    status = int(item.get("status") or infer_status(error, features))
    result = {
        "note_id": str(item.get("note_id") or ""),
        "run_dir": str(item.get("run_dir") or ""),
        "image_path": str(item.get("image_path") or ""),
        "status": status,
        "features": features,
    }
    if error:
        result["error"] = error
    return result


def infer_status(error: str, features: dict[str, Any]) -> int:
    if not error and core_features_complete(features):
        return STATUS_SUCCEEDED
    if error.startswith("missing_image:"):
        return STATUS_MISSING_IMAGE
    if error.startswith(("model_failed:", "incomplete_core_features:")):
        return STATUS_MODEL_FAILED
    return STATUS_FAILED


def item_map_from_output(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in payload.get("items", []):
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("note_id") or "").strip()
        if item_id:
            result[item_id] = slim_item(item)
    return result


def build_item(
    item_id: str,
    entry: DigestEntry | None = None,
    image_path: Path | None = None,
    features: dict[str, Any] | None = None,
    error: str = "",
) -> dict[str, Any]:
    features = slim_features(features) if features else {}
    item = {
        "note_id": item_id,
        "run_dir": entry.run_dir if entry else "",
        "image_path": relative_asset_path(image_path),
        "status": infer_status(error, features),
        "features": features,
    }
    if error:
        item["error"] = error
    return item


def selected_registry_ids(all_ids: list[str], note_ids: list[str] | None, limit: int | None) -> list[str]:
    if note_ids:
        requested = {str(item).strip() for item in note_ids if str(item).strip()}
        result = [item_id for item_id in all_ids if item_id in requested]
        missing = requested - set(result)
        if missing:
            print(f"Requested note ids not found in registry: {', '.join(sorted(missing))}")
        return result[:limit] if limit else result
    return all_ids[:limit] if limit else all_ids


def has_completed_features(item: dict[str, Any] | None) -> bool:
    if not isinstance(item, dict):
        return False
    features = item.get("features")
    if not isinstance(features, dict) or item.get("error"):
        return False
    return core_features_complete(features)


def core_features_complete(features: dict[str, Any]) -> bool:
    nail = features.get("nail")
    return (
        isinstance(nail, dict)
        and bool(nail.get("shape"))
        and bool(nail.get("length"))
        and bool(nail.get("colors"))
    )


def analyze_item(api_key: str, base_url: str, model: str, item_id: str, entry: DigestEntry, image_path: Path) -> dict[str, Any]:
    features = analyze_image(api_key, base_url, model, image_path)
    return build_item(item_id, entry, image_path, features)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze XHS nail image features with LongCat.")
    parser.add_argument("--limit", type=int, default=None, help="Process at most N registry ids. Useful for a small smoke test.")
    parser.add_argument("--note-id", action="append", default=None, help="Process a specific registry note id. Can be repeated.")
    parser.add_argument("--force", action="store_true", help="Reprocess succeeded items instead of skipping them.")
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help=f"Concurrent API workers. Default: {DEFAULT_WORKERS}.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    api_key, base_url, model = load_config()

    all_registry_ids = registry_note_ids()
    registry_ids = selected_registry_ids(all_registry_ids, args.note_id, args.limit)
    digest_index = build_digest_index()
    output = load_output()
    item_map = item_map_from_output(output)
    summary = {
        "registry_ids": len(registry_ids),
        "skipped_existing": 0,
        "succeeded": 0,
        "missing_image": 0,
        "failed": 0,
    }
    pending: list[tuple[str, DigestEntry, Path]] = []

    for item_id in registry_ids:
        current = item_map.get(item_id)
        if has_completed_features(current) and not args.force:
            summary["skipped_existing"] += 1
            continue

        entry = digest_index.get(item_id)
        if entry is None:
            item_map[item_id] = build_item(item_id, error="missing_image: note_id not found in any xhs_note_digest.json")
            summary["missing_image"] += 1
            write_output(OUTPUT_PATH, output, all_registry_ids, item_map)
            print(f"[missing_image] {item_id}: no digest record")
            continue

        image_path = select_image_path(entry.note)
        if image_path is None:
            item_map[item_id] = build_item(item_id, entry, error="missing_image: no local standard_nail_image found")
            summary["missing_image"] += 1
            write_output(OUTPUT_PATH, output, all_registry_ids, item_map)
            print(f"[missing_image] {item_id}: no standard_nail_image")
            continue

        pending.append((item_id, entry, image_path))

    workers = max(1, args.workers)
    if pending:
        print(f"Analyzing {len(pending)} images with {workers} worker(s).")
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(analyze_item, api_key, base_url, model, item_id, entry, image_path): (item_id, entry, image_path)
            for item_id, entry, image_path in pending
        }
        for future in as_completed(futures):
            item_id, entry, image_path = futures[future]
            try:
                item_map[item_id] = future.result()
                summary["succeeded"] += 1
                print(f"[succeeded] {item_id}: {relative_asset_path(image_path)}")
            except Exception as exc:
                item_map[item_id] = build_item(item_id, entry, image_path, error=str(exc))
                summary["failed"] += 1
                print(f"[failed] {item_id}: {exc}")
            write_output(OUTPUT_PATH, output, all_registry_ids, item_map)

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
