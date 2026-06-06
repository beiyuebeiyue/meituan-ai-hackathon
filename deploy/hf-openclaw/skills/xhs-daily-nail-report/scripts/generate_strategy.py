#!/usr/bin/env python3
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from scripts.utils import load_env, save_text

REPORT_NAME = "xhs_daily_nail_report.md"
STRATEGY_NAME = "xhs_ops_strategy.md"
SHANGHAI_TZ = ZoneInfo("Asia/Shanghai")


def date_key(value):
    return value.strftime("%Y%m%d")


def date_label(value):
    return value.strftime("%Y-%m-%d")


def strip_fence(text):
    match = re.match(r"^\s*```(?:markdown|md)?\s*(.*?)\s*```\s*$", text, flags=re.S)
    return match.group(1).strip() if match else text.strip()


def report_trends_only(markdown):
    for marker in ("\n## 运营策略", "\n# 焕甲小红书运营策略"):
        if marker in markdown:
            return markdown.split(marker, 1)[0].rstrip()
    return markdown.rstrip()


def strategy_section(markdown):
    lines = markdown.strip().splitlines()
    for index, line in enumerate(lines):
        if index == 0 and line.startswith("# "):
            lines[index] = "## 运营策略"
        elif line.startswith("## "):
            lines[index] = f"#{line}"
    return "\n".join(lines).strip()


def build_messages(report_date, report_markdown):
    system = (
        "你是焕甲的小红书内容运营策略师。"
        "你只基于用户提供的日报写策略，不编造日报以外的数据。"
        "输出中文 Markdown，语气直接，动作要可执行。"
    )
    user = f"""请根据下面的小红书美甲运营日报，输出一份运营策略。

要求：
- 不复述标题和正文原文。
- 重点提炼款式方向、内容动作、商家供给、AI 焕手转化和优惠券动作。
- 只写可执行策略，不写泛泛建议。
- 如果日报中某个时间窗口暂无数据，明确降低该窗口结论权重。
- 不要使用“假设”来补齐缺失的预约、转化或用户行为数据；缺失时写“待后台验证”。
- 不要在策略正文引用 Like、Collect、Share 数字，也不要计算百分比、比率或阈值；策略只引用排序、时间窗口、标签和款式方向。
- 不要使用 emoji。
- 输出结构固定为：
  # 焕甲小红书运营策略（{date_label(report_date)}）
  ## 今日判断
  ## 内容策略
  ## 商家供给策略
  ## AI 焕手转化策略
  ## 优惠券策略
  ## 明日执行清单

日报：
{report_markdown}
"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def longcat_chat(messages):
    api_key = os.environ.get("LONGCAT_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("LONGCAT_API_KEY is not set")

    base_url = os.environ.get("LONGCAT_BASE_URL", "https://api.longcat.chat/openai").rstrip("/")
    model = os.environ.get("LONGCAT_MODEL", "LongCat-Flash-Chat-2602-Exp")
    payload = json.dumps(
        {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1800,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"LongCat request failed: {error.code} {detail}") from error

    return result["choices"][0]["message"]["content"]


skill_dir = Path(__file__).resolve().parents[1]
load_env(Path(__file__).resolve().parents[4] / ".env")

target_date = datetime.now(SHANGHAI_TZ).date()
report_dir = skill_dir / "assets" / date_key(target_date)
report_path = report_dir / REPORT_NAME
if not report_path.exists():
    raise SystemExit(f"report not found: {report_path}")

trend_report = report_trends_only(report_path.read_text(encoding="utf-8"))
strategy = strip_fence(longcat_chat(build_messages(target_date, trend_report)))
strategy_path = report_dir / STRATEGY_NAME
save_text(strategy_path, strategy + "\n")
save_text(report_path, f"{trend_report}\n\n{strategy_section(strategy)}\n")
print(strategy_path)
