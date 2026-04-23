from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.ops import (
    OpsReportRead,
    OverviewMetricsResponse,
    PerformanceMetricsResponse,
    ReportGenerateResponse,
    ReportSaveRequest,
)
from app.services.report_service import ReportService


router = APIRouter(prefix="/ops", tags=["ops"])
report_service = ReportService()


@router.post("/reports/generate", response_model=ReportGenerateResponse)
def generate_report(
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> ReportGenerateResponse:
    return report_service.generate_report(db, report_date=report_date)


@router.post("/reports/save", response_model=OpsReportRead)
def save_report(payload: ReportSaveRequest, db: Session = Depends(get_db)) -> OpsReportRead:
    report = report_service.save_report(
        db,
        report_date=payload.report_date,
        markdown_content=payload.markdown_content,
        summary_text=payload.summary_text,
        report_json=payload.report_json,
    )
    return OpsReportRead.model_validate(report)


@router.get("/reports/today", response_model=OpsReportRead | None)
def get_today_report(db: Session = Depends(get_db)) -> OpsReportRead | None:
    report = report_service.get_today_report(db)
    if report is None:
        return None
    return OpsReportRead.model_validate(report)


@router.get("/reports/history", response_model=list[OpsReportRead])
def get_report_history(
    limit: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db),
) -> list[OpsReportRead]:
    reports = report_service.get_history(db, limit=limit)
    return [OpsReportRead.model_validate(report) for report in reports]


@router.get("/metrics/overview", response_model=OverviewMetricsResponse)
def get_overview_metrics(
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> OverviewMetricsResponse:
    return report_service.get_overview_metrics(db, report_date=report_date)


@router.get("/metrics/performance", response_model=PerformanceMetricsResponse)
def get_performance_metrics(
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> PerformanceMetricsResponse:
    return report_service.get_performance_metrics(db, report_date=report_date)
