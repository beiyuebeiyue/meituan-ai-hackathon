from __future__ import annotations

from datetime import date


def render_daily_report_markdown(report_date: date, report_json: dict[str, object]) -> str:
    metrics = report_json.get("metrics", {})
    actions = report_json.get("actions", [])
    top_tags = report_json.get("top_trending_tags", [])
    lines = [
        f"# NailTry AI 运营日报 - {report_date.isoformat()}",
        "",
        "## 摘要",
        str(report_json.get("summary", "")),
        "",
        "## 核心指标",
        f"- 首页曝光量：{metrics.get('homepage_impressions', 0)}",
        f"- 首页点击量：{metrics.get('homepage_clicks', 0)}",
        f"- 首页 CTR：{metrics.get('homepage_ctr', 0):.2%}",
        "",
        "## 热门标签",
    ]
    if top_tags:
        lines.extend([f"- {item.get('tag')}：{item.get('count')}" for item in top_tags])
    else:
        lines.append("- 暂无")
    lines.extend(["", "## 建议动作"])
    if actions:
        lines.extend([f"- {action}" for action in actions])
    else:
        lines.append("- 暂无建议")
    return "\n".join(lines)
