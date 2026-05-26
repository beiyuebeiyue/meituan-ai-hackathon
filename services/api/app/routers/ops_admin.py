from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import create_ops_access_token
from app.dependencies import require_ops_admin
from app.schemas.ops import (
    OpsCouponGrantCreate,
    OpsCouponGrantListResponse,
    OpsCouponGrantRead,
    OpsAnalyticsOverviewResponse,
    OpsChatRequest,
    OpsChatResponse,
    OpsDashboardResponse,
    OpsLoginRequest,
    OpsMerchantListItem,
    OpsMerchantListResponse,
    OpsMerchantUserListItem,
    OpsMerchantUserListResponse,
    OpsMarkdownReportRead,
    OpsPostListItem,
    OpsPostListResponse,
    OpsReportRead,
    PerformanceMetricsResponse,
    ReportGenerateResponse,
    ReportSaveRequest,
    OpsTokenResponse,
    OpsUserListItem,
    OpsUserListResponse,
)
from app.schemas.trends import OpsTrendCampaignCreateRequest, OpsTrendCampaignRead, OpsTrendNailCandidateListResponse
from app.services.ops_admin_service import OpsAdminService
from app.services.analytics_service import AnalyticsService
from app.services.ops_chat_service import OpsChatService
from app.services.report_service import ReportService
from app.services.trend_nail_service import TrendNailService


router = APIRouter(prefix="/ops", tags=["ops-admin"])
ops_admin_service = OpsAdminService()
ops_chat_service = OpsChatService()
report_service = ReportService()
analytics_service = AnalyticsService()
trend_nail_service = TrendNailService()


@router.post("/auth/login", response_model=OpsTokenResponse)
def login_ops_admin(payload: OpsLoginRequest) -> OpsTokenResponse:
    settings = get_settings()
    if payload.username != settings.ops_admin_username or payload.password != settings.ops_admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="运营后台账号或密码错误")
    return OpsTokenResponse(access_token=create_ops_access_token())


@router.get("/dashboard", response_model=OpsDashboardResponse)
def get_ops_dashboard(
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsDashboardResponse:
    return ops_admin_service.dashboard(db)


@router.get("/analytics/overview", response_model=OpsAnalyticsOverviewResponse)
def get_ops_analytics_overview(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsAnalyticsOverviewResponse:
    return analytics_service.overview(db, start_date=start_date, end_date=end_date)


@router.post("/ai/chat", response_model=OpsChatResponse)
def chat_with_ops_ai(
    payload: OpsChatRequest,
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsChatResponse:
    return ops_chat_service.chat(db, payload.messages)


@router.get("/trend-nails/candidates", response_model=OpsTrendNailCandidateListResponse)
def list_trend_nail_candidates(
    limit: int = Query(default=20, ge=1, le=100),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsTrendNailCandidateListResponse:
    return OpsTrendNailCandidateListResponse(items=trend_nail_service.list_candidates(db, limit=limit))


@router.post("/trend-nail-campaigns", response_model=OpsTrendCampaignRead)
def create_trend_nail_campaign(
    payload: OpsTrendCampaignCreateRequest,
    ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsTrendCampaignRead:
    return trend_nail_service.create_campaign(db, payload, created_by=ops_admin)


@router.get("/trend-nail-campaigns/{campaign_id}", response_model=OpsTrendCampaignRead)
def get_trend_nail_campaign(
    campaign_id: str,
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsTrendCampaignRead:
    return trend_nail_service.get_campaign(db, campaign_id)


@router.post("/reports/generate", response_model=ReportGenerateResponse)
def generate_ops_report(
    report_date: date | None = Query(default=None),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> ReportGenerateResponse:
    return report_service.generate_report(db, report_date=report_date)


@router.post("/reports/save", response_model=OpsReportRead)
def save_ops_report(
    payload: ReportSaveRequest,
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsReportRead:
    report = report_service.save_report(
        db,
        report_date=payload.report_date,
        markdown_content=payload.markdown_content,
        summary_text=payload.summary_text,
        report_json=payload.report_json,
    )
    return OpsReportRead.model_validate(report)


@router.get("/reports/today", response_model=OpsReportRead | None)
def get_today_ops_report(
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsReportRead | None:
    report = report_service.get_today_report(db)
    if report is None:
        return None
    return OpsReportRead.model_validate(report)


@router.get("/reports/xhs-nail/today", response_model=OpsMarkdownReportRead | None)
def get_today_xhs_nail_report(
    _ops_admin: str = Depends(require_ops_admin),
) -> OpsMarkdownReportRead | None:
    return report_service.get_today_xhs_nail_report()


@router.get("/reports/xhs-nail/history", response_model=list[OpsMarkdownReportRead])
def get_xhs_nail_report_history(
    limit: int = Query(default=30, ge=1, le=90),
    _ops_admin: str = Depends(require_ops_admin),
) -> list[OpsMarkdownReportRead]:
    return report_service.get_xhs_nail_report_history(limit=limit)


@router.get("/metrics/performance", response_model=PerformanceMetricsResponse)
def get_ops_performance_metrics(
    report_date: date | None = Query(default=None),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> PerformanceMetricsResponse:
    return report_service.get_performance_metrics(db, report_date=report_date)


@router.get("/users", response_model=OpsUserListResponse)
def list_ops_users(
    query: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsUserListResponse:
    return ops_admin_service.list_users(db, query=query.strip(), limit=limit, offset=offset)


@router.get("/users/{user_id}", response_model=OpsUserListItem)
def get_ops_user(
    user_id: str,
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsUserListItem:
    return ops_admin_service.get_user(db, user_id)


@router.get("/merchants", response_model=OpsMerchantListResponse)
def list_ops_merchants(
    query: str = Query(default=""),
    city: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsMerchantListResponse:
    return ops_admin_service.list_merchants(db, query=query.strip(), city=city.strip(), limit=limit, offset=offset)


@router.get("/merchants/cities", response_model=list[str])
def list_ops_merchant_cities(
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> list[str]:
    return ops_admin_service.list_merchant_cities(db)


@router.get("/merchants/{shop_id}", response_model=OpsMerchantListItem)
def get_ops_merchant(
    shop_id: str,
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsMerchantListItem:
    return ops_admin_service.get_merchant(db, shop_id)


@router.get("/merchant-users", response_model=OpsMerchantUserListResponse)
def list_ops_merchant_users(
    query: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsMerchantUserListResponse:
    return ops_admin_service.list_merchant_users(db, query=query.strip(), limit=limit, offset=offset)


@router.get("/merchant-users/{user_id}", response_model=OpsMerchantUserListItem)
def get_ops_merchant_user(
    user_id: str,
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsMerchantUserListItem:
    return ops_admin_service.get_merchant_user(db, user_id)


@router.get("/posts", response_model=OpsPostListResponse)
def list_ops_posts(
    query: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsPostListResponse:
    return ops_admin_service.list_posts(db, query=query.strip(), limit=limit, offset=offset)


@router.get("/posts/{post_id}", response_model=OpsPostListItem)
def get_ops_post(
    post_id: str,
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsPostListItem:
    return ops_admin_service.get_post(db, post_id)


@router.post("/coupons/grants", response_model=OpsCouponGrantRead)
def create_ops_coupon_grant(
    payload: OpsCouponGrantCreate,
    ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsCouponGrantRead:
    return ops_admin_service.create_coupon(db, payload, created_by=ops_admin)


@router.get("/coupons/grants", response_model=OpsCouponGrantListResponse)
def list_ops_coupon_grants(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _ops_admin: str = Depends(require_ops_admin),
    db: Session = Depends(get_db),
) -> OpsCouponGrantListResponse:
    return OpsCouponGrantListResponse(**ops_admin_service.list_coupons(db, limit=limit, offset=offset))
