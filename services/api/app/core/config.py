from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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
    openai_image_model: str = "gpt-image-2"
    image_pipeline_version: str = "mediapipe-sam31-v1"
    image_provider_config_hash: str = ""
    remote_gpu_tryon_url: str = ""
    remote_gpu_tryon_api_key: str = ""
    remote_gpu_tryon_timeout_seconds: float = 180.0
    gaode_api_key: str = ""
    default_admin_enabled: bool = True
    default_admin_phone: str = "13886722666"
    default_admin_username: str = "keke"
    default_admin_password: str = "admin@123456"
    default_admin_bio: str = (
        "谢谢关注!\n"
        "大家有对我不满的地方都可以提出来，尽情发言，一会就给你们全删了。"
        "*的竟敢对皇帝不满，我来上网就是来当皇帝的，顺我者昌逆我者亡。"
        "能面刺寡人之过者，诛九族。上网谏寡人者，处极刑。谤讥于市朝闻寡人之耳者，赐自尽。"
    )

    seed_xlsx_path: str = "./命题三美甲评测数据（对外版）.xlsx"
    upload_dir: str = "./data/uploads"
    tryon_result_dir: str = "./data/tryon_results"
    tryon_artifact_dir: str = "./data/tryon_artifacts"
    seed_dir: str = "./data/seed"
    report_dir: str = "./data/reports"
    public_files_prefix: str = "/files"

    openclaw_enabled: bool = True
    openclaw_skill_name: str = "nail_ops_strategy"
    openclaw_base_url: str = "http://openclaw:3000"
    ops_report_timezone: str = "Asia/Shanghai"

    allow_mock_image_edit_fallback: bool = True
    hot_keywords: list[str] = Field(default_factory=lambda: ["热门", "流行", "当季", "最近", "爆款", "trend"])

    @property
    def base_dir(self) -> Path:
        return Path(__file__).resolve().parents[4]

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
    def report_path(self) -> Path:
        return self.resolve_path(self.report_dir)

    @property
    def seed_xlsx(self) -> Path:
        return self.resolve_path(self.seed_xlsx_path)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
