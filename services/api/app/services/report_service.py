from __future__ import annotations

import json
from collections import Counter
from datetime import date, datetime, timedelta
from statistics import median
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.models.ops_report import OpsReport
from app.models.style_event_daily import StyleEventDaily
from app.schemas.ops import OverviewMetricsResponse, OverviewSeriesItem, PerformanceMetricsResponse, ReportGenerateResponse
from app.services.job_log_service import JobLogService
from app.services.trend_service import TrendService
from app.utils.markdown import render_daily_report_markdown


class ReportService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.trend_service = TrendService()
        self.job_logs = JobLogService()

    def generate_report(self, db: Session, report_date: date | None = None) -> ReportGenerateResponse:
        target_date = report_date or datetime.now(ZoneInfo(self.settings.ops_report_timezone)).date()
        snapshot = self.trend_service.fetch_and_store_snapshot(db, target_date)
        rows = list(db.scalars(select(StyleEventDaily).where(StyleEventDaily.stat_date == target_date)))
        styles = {style.id: style for style in db.scalars(select(NailStyle))}
        row_dicts = [self._serialize_daily_row(row, styles.get(row.style_id)) for row in rows if styles.get(row.style_id) is not None]
        total_impressions = sum(item["impressions"] for item in row_dicts)
        total_clicks = sum(item["clicks"] for item in row_dicts)
        ctr = total_clicks / total_impressions if total_impressions else 0.0
        impression_avg = sum(item["impressions"] for item in row_dicts) / len(row_dicts) if row_dicts else 0
        ctr_median = median([item["ctr"] for item in row_dicts]) if row_dicts else 0.0

        top_clicked = sorted(row_dicts, key=lambda item: item["clicks"], reverse=True)[:5]
        top_exposed = sorted(row_dicts, key=lambda item: item["impressions"], reverse=True)[:5]
        high_impression_low_ctr = [
            item for item in row_dicts if item["impressions"] >= impression_avg and item["ctr"] < ctr_median
        ][:5]
        low_impression_high_ctr = [
            item for item in row_dicts if item["impressions"] < impression_avg and item["ctr"] >= ctr_median
        ][:5]
        trending_styles = sorted(
            [
                {"style_id": style.id, "title": style.title, "image_url": style.image_url, "score": round(style.popularity_score, 2)}
                for style in styles.values()
            ],
            key=lambda item: item["score"],
            reverse=True,
        )[:5]
        tag_counter: Counter[str] = Counter()
        for style in styles.values():
            for tag in style.tags_json or []:
                tag_counter[tag] += 1
        if not tag_counter and snapshot.payload_json.get("top_tags"):
            tag_counter.update({item["tag"]: item["count"] for item in snapshot.payload_json["top_tags"]})  # type: ignore[index]
        top_tags = [{"tag": tag, "count": count} for tag, count in tag_counter.most_common(5)]

        summary = self._build_summary(top_tags, snapshot.payload_json.get("summary", ""))
        report_json = {
            "report_date": target_date.isoformat(),
            "summary": summary,
            "metrics": {
                "homepage_impressions": total_impressions,
                "homepage_clicks": total_clicks,
                "homepage_ctr": ctr,
            },
            "top_clicked_styles": top_clicked,
            "top_exposed_styles": top_exposed,
            "high_impression_low_ctr": high_impression_low_ctr,
            "low_impression_high_ctr": low_impression_high_ctr,
            "top_trending_styles": trending_styles,
            "top_trending_tags": top_tags,
            "actions": self._build_actions(top_clicked, high_impression_low_ctr, low_impression_high_ctr),
        }
        markdown_content = render_daily_report_markdown(target_date, report_json)
        return ReportGenerateResponse(
            report_date=target_date,
            markdown_content=markdown_content,
            summary_text=summary,
            report_json=report_json,
        )

    def save_report(
        self,
        db: Session,
        report_date: date,
        markdown_content: str,
        summary_text: str,
        report_json: dict[str, object],
    ) -> OpsReport:
        job = self.job_logs.start(db, "ops_report", message=f"生成 {report_date.isoformat()} 报告")
        json_path = self.settings.report_path / f"{report_date.isoformat()}.json"
        markdown_path = self.settings.report_path / f"{report_date.isoformat()}.md"
        self.settings.report_path.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(report_json, ensure_ascii=False, indent=2), encoding="utf-8")
        markdown_path.write_text(markdown_content, encoding="utf-8")

        report = db.scalar(select(OpsReport).where(OpsReport.report_date == report_date))
        if report is None:
            report = OpsReport(
                report_date=report_date,
                markdown_content=markdown_content,
                summary_text=summary_text,
                report_json=report_json,
                local_file_path=str(markdown_path),
            )
        else:
            report.markdown_content = markdown_content
            report.summary_text = summary_text
            report.report_json = report_json
            report.local_file_path = str(markdown_path)
        db.add(report)
        db.commit()
        db.refresh(report)
        self.job_logs.finish(db, job, status="succeeded", message="报告保存成功", payload={"report_date": report_date.isoformat()})
        return report

    def get_today_report(self, db: Session) -> OpsReport | None:
        target_date = datetime.now(ZoneInfo(self.settings.ops_report_timezone)).date()
        return db.scalar(select(OpsReport).where(OpsReport.report_date == target_date))

    def get_history(self, db: Session, limit: int = 30) -> list[OpsReport]:
        return list(db.scalars(select(OpsReport).order_by(OpsReport.report_date.desc()).limit(limit)))

    def get_overview_metrics(self, db: Session, report_date: date | None = None) -> OverviewMetricsResponse:
        target_date = report_date or datetime.now(ZoneInfo(self.settings.ops_report_timezone)).date()
        rows = list(db.scalars(select(StyleEventDaily).where(StyleEventDaily.stat_date == target_date)))
        total_impressions = sum(item.impressions for item in rows)
        total_clicks = sum(item.clicks for item in rows)
        ctr = total_clicks / total_impressions if total_impressions else 0.0
        styles = {style.id: style for style in db.scalars(select(NailStyle))}
        fastest = sorted(
            [
                {
                    "style_id": row.style_id,
                    "title": styles[row.style_id].title,
                    "image_url": styles[row.style_id].image_url,
                    "delta_score": round(row.clicks * 0.7 + row.favorites * 1.5 + row.tryons * 2.0, 2),
                }
                for row in rows
                if row.style_id in styles
            ],
            key=lambda item: item["delta_score"],
            reverse=True,
        )[:5]
        series = []
        for offset in range(6, -1, -1):
            day = target_date - timedelta(days=offset)
            day_rows = list(db.scalars(select(StyleEventDaily).where(StyleEventDaily.stat_date == day)))
            day_impressions = sum(item.impressions for item in day_rows)
            day_clicks = sum(item.clicks for item in day_rows)
            series.append(
                OverviewSeriesItem(
                    date=day,
                    impressions=day_impressions,
                    clicks=day_clicks,
                    ctr=day_clicks / day_impressions if day_impressions else 0.0,
                )
            )
        return OverviewMetricsResponse(
            report_date=target_date,
            homepage_impressions=total_impressions,
            homepage_clicks=total_clicks,
            homepage_ctr=ctr,
            fastest_rising_styles=fastest,
            series=series,
        )

    def get_performance_metrics(self, db: Session, report_date: date | None = None) -> PerformanceMetricsResponse:
        generated = self.generate_report(db, report_date)
        return PerformanceMetricsResponse(
            report_date=generated.report_date,
            top_clicked_styles=generated.report_json["top_clicked_styles"],  # type: ignore[index]
            top_exposed_styles=generated.report_json["top_exposed_styles"],  # type: ignore[index]
            high_impression_low_ctr=generated.report_json["high_impression_low_ctr"],  # type: ignore[index]
            low_impression_high_ctr=generated.report_json["low_impression_high_ctr"],  # type: ignore[index]
        )

    @staticmethod
    def _serialize_daily_row(row: StyleEventDaily, style: NailStyle | None) -> dict[str, object]:
        return {
            "style_id": row.style_id,
            "title": style.title if style else "未知款式",
            "image_url": style.image_url if style else "",
            "impressions": row.impressions,
            "clicks": row.clicks,
            "favorites": row.favorites,
            "tryons": row.tryons,
            "publishes": row.publishes,
            "ctr": row.ctr,
        }

    @staticmethod
    def _build_summary(top_tags: list[dict[str, object]], external_summary: str) -> str:
        if top_tags:
            tag_names = "、".join(tag["tag"] for tag in top_tags[:2])
            return f"今日站内热度集中在 {tag_names} 风格。{external_summary}".strip()
        return f"今日站内数据整体平稳。{external_summary}".strip()

    @staticmethod
    def _build_actions(
        top_clicked: list[dict[str, object]],
        high_impression_low_ctr: list[dict[str, object]],
        low_impression_high_ctr: list[dict[str, object]],
    ) -> list[str]:
        actions: list[str] = []
        if top_clicked:
            actions.append(f"提升 {top_clicked[0]['title']} 在首页首屏的曝光权重")
        if high_impression_low_ctr:
            actions.append(f"下调 {high_impression_low_ctr[0]['title']} 的推荐位，优化封面和标签")
        if low_impression_high_ctr:
            actions.append(f"扩大 {low_impression_high_ctr[0]['title']} 的曝光，验证潜在爆款价值")
        return actions or ["维持当前推荐配比，继续观察用户偏好变化。"]
