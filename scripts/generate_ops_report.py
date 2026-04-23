from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.config import get_settings
from app.core.db import database, init_db
from app.services.report_service import ReportService


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and save ops report")
    parser.add_argument("--date", type=str, default=None)
    args = parser.parse_args()

    database.configure(get_settings().database_url)
    init_db()
    report_date = date.fromisoformat(args.date) if args.date else None
    with database.session() as db:
        service = ReportService()
        generated = service.generate_report(db, report_date=report_date)
        saved = service.save_report(
            db,
            report_date=generated.report_date,
            markdown_content=generated.markdown_content,
            summary_text=generated.summary_text,
            report_json=generated.report_json,
        )
    print({"report_id": saved.id, "report_date": saved.report_date.isoformat()})


if __name__ == "__main__":
    main()
