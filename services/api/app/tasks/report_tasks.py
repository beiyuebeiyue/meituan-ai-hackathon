from __future__ import annotations

from datetime import date

from app.core.db import database
from app.services.report_service import ReportService


def generate_and_save_report(report_date: date | None = None) -> None:
    database.configure()
    with database.session() as db:
        service = ReportService()
        generated = service.generate_report(db, report_date=report_date)
        service.save_report(
            db,
            report_date=generated.report_date,
            markdown_content=generated.markdown_content,
            summary_text=generated.summary_text,
            report_json=generated.report_json,
        )
