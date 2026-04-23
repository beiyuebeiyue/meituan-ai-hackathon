from datetime import date, datetime

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


class OverviewSeriesItem(BaseModel):
    date: date
    impressions: int
    clicks: int
    ctr: float


class OverviewMetricsResponse(BaseModel):
    report_date: date
    homepage_impressions: int
    homepage_clicks: int
    homepage_ctr: float
    fastest_rising_styles: list[dict[str, object]]
    series: list[OverviewSeriesItem]


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
