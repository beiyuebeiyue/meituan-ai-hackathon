from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT_DIR / ".env", ".env"), env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_prefix: str = "/api/v1"
    cors_allow_origins: list[str] = ["*"]

    database_url: str = "postgresql+psycopg://user:password@postgres:5432/nail_ai"
    redis_url: str = "redis://redis:6379/0"

    jwt_secret_key: str = "replace_me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080

    openai_api_key: str = ""
    openai_base_url: str = ""
    openai_text_model: str = "gpt-5.2"
    openai_image_model: str = "gpt-image-2"
    evolink_api_key: str = ""
    evolink_gpt_image_2_url: str = "https://evolink.ai/gpt-image-2"
    evolink_api_base_url: str = "https://api.evolink.ai"
    evolink_image_model: str = "gpt-image-2"
    evolink_image_quality: str = "low"
    evolink_image_size: str = "1:1"
    evolink_image_resolution: str = "1K"
    evolink_poll_interval_seconds: float = 3.0
    evolink_poll_timeout_seconds: float = 180.0
    hf_token: str = ""
    longcat_api_key: str = ""
    longcat_base_url: str = "https://api.longcat.chat/openai"
    longcat_chat_model: str = "LongCat-2.0-Preview"
    longcat_multimodal_model: str = "LongCat-Flash-Omni-2603"
    longcat_chat_timeout_seconds: float = 25.0
    image_pipeline_version: str = "yolo-nail26-v1"
    image_provider_config_hash: str = ""
    nail_yolo_model_path: str = ""
    nail_yolo_imgsz: int = 640
    nail_yolo_confidence: float = 0.25
    nail_yolo_iou: float = 0.7
    nail_yolo_device: str = ""
    remote_gpu_tryon_url: str = ""
    remote_gpu_tryon_api_key: str = ""
    remote_gpu_tryon_timeout_seconds: float = 180.0
    gaode_api_key: str = ""
    default_admin_enabled: bool = True
    default_admin_phone: str = "13886722666"
    default_admin_username: str = "焕甲测试美甲店"
    default_admin_password: str = "admin@123456"
    ops_admin_username: str = "admin"
    ops_admin_password: str = "JRLoZdHl8pFXIJ3gJuXu"
    default_admin_bio: str = (
        "谢谢关注!\n"
        "大家有对我不满的地方都可以提出来，尽情发言，一会就给你们全删了。"
        "*的竟敢对皇帝不满，我来上网就是来当皇帝的，顺我者昌逆我者亡。"
        "能面刺寡人之过者，诛九族。上网谏寡人者，处极刑。谤讥于市朝闻寡人之耳者，赐自尽。"
    )

    seed_xlsx_path: str = "./data/命题三美甲评测数据（对外版）.xlsx"
    upload_dir: str = "./data/uploads"
    tryon_result_dir: str = "./data/tryon_results"
    tryon_artifact_dir: str = "./data/tryon_artifacts"
    seed_dir: str = "./data/seed"
    packaged_seed_dir: str = "./data/seed"
    enable_packaged_seed_styles: bool = True
    report_dir: str = "./data/reports"
    xhs_weekly_report_path_value: str = "./xhs_weekly_nail_report.html"
    xhs_crawler_assets_dir: str = ".openclaw/skills/xhs-popular-nail-posts-crawler/assets"
    xhs_daily_report_assets_dir: str = ".openclaw/skills/xhs-daily-nail-report/assets"
    xhs_embedding_gradio_space_id: str = "dongli/nail_embedder"
    xhs_embedding_timeout_seconds: float = 20.0
    xhs_embedding_search_top_k: int = 200
    public_files_prefix: str = "/files"
    r2_enabled: bool = False
    r2_account_id: str = ""
    r2_bucket_name: str = ""
    r2_api_token: str = ""
    r2_public_base_url: str = ""
    r2_cache_control: str = "public, max-age=31536000, immutable"

    ip_geolocation_enabled: bool = True
    ip_geolocation_provider: str = "ip-api"
    ip_geolocation_timeout_seconds: float = 2.0

    openclaw_enabled: bool = True
    openclaw_skill_name: str = "xhs-daily-nail-report"
    openclaw_base_url: str = "http://host.docker.internal:18789"
    openclaw_model: str = "openclaw/default"
    openclaw_gateway_token: str = ""
    openclaw_schedule_state_path_value: str = ".openclaw/logs/scheduled-tasks.json"
    ops_report_timezone: str = "Asia/Shanghai"
    ops_demo_metrics_enabled: bool = True
    auto_trend_campaign_enabled: bool = True
    auto_trend_campaign_run_on_startup: bool = True
    auto_trend_campaign_startup_delay_seconds: int = 120
    auto_trend_campaign_hour: int = 9
    auto_trend_campaign_limit: int = 12

    hot_keywords: list[str] = Field(default_factory=lambda: ["热门", "流行", "当季", "最近", "爆款", "trend"])

    @property
    def base_dir(self) -> Path:
        return ROOT_DIR

    def resolve_path(self, value: str) -> Path:
        path = Path(value)
        if path.is_absolute():
            return path
        return (self.base_dir / path).resolve()

    @property
    def upload_path(self) -> Path:
        return self.resolve_path(self.upload_dir)

    @property
    def tryon_result_path(self) -> Path:
        return self.resolve_path(self.tryon_result_dir)

    @property
    def tryon_artifact_path(self) -> Path:
        return self.resolve_path(self.tryon_artifact_dir)

    @property
    def seed_path(self) -> Path:
        return self.resolve_path(self.seed_dir)

    @property
    def packaged_seed_path(self) -> Path:
        return self.resolve_path(self.packaged_seed_dir)

    @property
    def report_path(self) -> Path:
        return self.resolve_path(self.report_dir)

    @property
    def xhs_weekly_report_path(self) -> Path:
        return self.resolve_path(self.xhs_weekly_report_path_value)

    @property
    def xhs_crawler_assets_path(self) -> Path:
        return self.resolve_path(self.xhs_crawler_assets_dir)

    @property
    def xhs_daily_report_assets_path(self) -> Path:
        return self.resolve_path(self.xhs_daily_report_assets_dir)

    @property
    def openclaw_schedule_state_path(self) -> Path:
        return self.resolve_path(self.openclaw_schedule_state_path_value)

    @property
    def seed_xlsx(self) -> Path:
        return self.resolve_path(self.seed_xlsx_path)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
