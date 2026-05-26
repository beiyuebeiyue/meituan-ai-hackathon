from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class ReportGenerateResponse(BaseModel):
    report_date: date
    markdown_content: str
    summary_text: str
    report_json: dict[str, object]


class ReportSaveRequest(BaseModel):
    report_date: date
    markdown_content: str
    summary_text: str
    report_json: dict[str, object]


class OpsReportRead(BaseModel):
    id: str
    report_date: date
    markdown_content: str
    summary_text: str
    report_json: dict[str, object]
    local_file_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OpsMarkdownReportRead(BaseModel):
    report_date: date
    date_key: str
    markdown_content: str
    local_file_path: str
    created_at: datetime


class PerformanceMetricsResponse(BaseModel):
    report_date: date
    top_clicked_styles: list[dict[str, object]]
    top_exposed_styles: list[dict[str, object]]
    high_impression_low_ctr: list[dict[str, object]]
    low_impression_high_ctr: list[dict[str, object]]


class JobLogRead(BaseModel):
    id: str
    job_name: str
    status: str
    message: str
    payload_json: dict[str, object] = Field(default_factory=dict)
    started_at: datetime
    finished_at: datetime | None = None

    model_config = {"from_attributes": True}


class OpsLoginRequest(BaseModel):
    username: str
    password: str


class OpsTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OpsMetricPair(BaseModel):
    total: int
    today: int


class OpsDashboardMetrics(BaseModel):
    users: OpsMetricPair
    merchants: OpsMetricPair
    images: OpsMetricPair
    likes: OpsMetricPair
    collects: OpsMetricPair
    shares: OpsMetricPair
    tryon_users: OpsMetricPair
    bookings: OpsMetricPair
    completed_bookings: OpsMetricPair
    revenue: OpsMetricPair


class OpsPopularNail(BaseModel):
    note_id: str
    keyword: str
    title: str
    desc: str
    tag_list: list[str]
    image_list: list[str]
    liked_count: int
    collected_count: int
    share_count: int


class OpsDashboardResponse(BaseModel):
    report_date: date
    timezone: str
    metrics: OpsDashboardMetrics
    popular_nails: list[OpsPopularNail]


class OpsAnalyticsKpis(BaseModel):
    dau: int
    new_users: int
    recommendation_impressions: int
    recommendation_clicks: int
    recommendation_ctr: float
    tryon_started: int
    tryon_completed: int
    tryon_completion_rate: float
    booking_submits: int
    completed_orders: int
    revenue_cents: int
    average_order_value_cents: int
    click_to_tryon_rate: float
    tryon_to_booking_rate: float
    booking_to_order_rate: float
    click_to_order_rate: float
    arpu_cents: int
    revenue_conversion_rate: float


class OpsAnalyticsFunnelStep(BaseModel):
    key: str
    label: str
    count: int
    conversion_rate: float
    step_rate: float
    dropoff_rate: float
    dropoff_count: int


class OpsAnalyticsTrendPoint(BaseModel):
    date: date
    recommendation_clicks: int
    tryon_started: int
    tryons: int
    tryon_completed: int
    booking_submits: int
    bookings: int
    completed_orders: int
    revenue_cents: int


class OpsAnalyticsRankItem(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    impressions: int
    clicks: int
    ctr: float
    tryons: int
    tryon_rate: float
    bookings: int
    booking_rate: float
    completed_orders: int
    completion_rate: float
    revenue_cents: int
    revenue_share: float


class OpsAnalyticsOverviewResponse(BaseModel):
    start_date: date
    end_date: date
    generated_at: datetime
    kpis: OpsAnalyticsKpis
    funnel: list[OpsAnalyticsFunnelStep]
    trends: list[OpsAnalyticsTrendPoint]
    top_styles: list[OpsAnalyticsRankItem]
    top_shops: list[OpsAnalyticsRankItem]


OpsChatRole = Literal["user", "assistant"]


class OpsChatMessage(BaseModel):
    role: OpsChatRole
    content: str = Field(min_length=1, max_length=2000)


class OpsChatRequest(BaseModel):
    messages: list[OpsChatMessage] = Field(min_length=1, max_length=20)


class OpsChatResponse(BaseModel):
    reply: str
    model: str


class OpsUserListItem(BaseModel):
    id: str
    uid: int
    username: str
    phone: str | None = None
    avatar_url: str | None = None
    last_login_ip_location: str | None = None
    role: str
    created_at: datetime
    booking_count: int = 0
    tryon_count: int = 0
    like_count: int = 0
    collect_count: int = 0


class OpsUserListResponse(BaseModel):
    items: list[OpsUserListItem]
    total: int


class OpsMerchantListItem(BaseModel):
    id: str
    merchant_user_id: str
    merchant_name: str
    merchant_phone: str | None = None
    name: str
    city: str
    address: str
    contact_phone: str | None = None
    created_at: datetime
    booking_count: int = 0
    completed_booking_count: int = 0


class OpsMerchantListResponse(BaseModel):
    items: list[OpsMerchantListItem]
    total: int


class OpsMerchantUserListItem(BaseModel):
    id: str
    uid: int
    username: str
    phone: str | None = None
    avatar_url: str | None = None
    last_login_ip_location: str | None = None
    role: str
    created_at: datetime
    shop_count: int = 0
    booking_count: int = 0
    completed_booking_count: int = 0


class OpsMerchantUserListResponse(BaseModel):
    items: list[OpsMerchantUserListItem]
    total: int


class OpsPostListItem(BaseModel):
    id: str
    author_user_id: str
    author_uid: int
    author_name: str
    author_role: str
    title: str
    description: str
    image_url: str
    local_image_path: str
    tags: list[str]
    is_hidden: bool
    shop_id: str | None = None
    shop_name: str | None = None
    shop_city: str | None = None
    verified_booking_id: str | None = None
    created_at: datetime
    updated_at: datetime


class OpsPostListResponse(BaseModel):
    items: list[OpsPostListItem]
    total: int


OpsCouponTargetType = Literal["user"]


class OpsCouponGrantCreate(BaseModel):
    target_type: OpsCouponTargetType
    target_id: str = Field(min_length=1, max_length=36)
    coupon_name: str = Field(min_length=1, max_length=120)
    amount: int = Field(gt=0)
    valid_from: date | None = None
    valid_until: date | None = None
    note: str = Field(default="", max_length=500)


class OpsCouponGrantRead(BaseModel):
    id: str
    target_type: OpsCouponTargetType
    target_id: str
    target_name: str
    coupon_name: str
    amount: int
    valid_from: date | None = None
    valid_until: date | None = None
    note: str
    created_by: str
    created_at: datetime


class OpsCouponGrantListResponse(BaseModel):
    items: list[OpsCouponGrantRead]
    total: int
