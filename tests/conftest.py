from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))


@pytest.fixture()
def app_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "test.db"
    upload_dir = tmp_path / "uploads"
    tryon_dir = tmp_path / "tryon_results"
    seed_dir = tmp_path / "seed"
    report_dir = tmp_path / "reports"
    xhs_report_assets_dir = tmp_path / "xhs-daily-nail-report-assets"
    xhs_crawler_assets_dir = tmp_path / "xhs-crawler-assets"
    seed_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("UPLOAD_DIR", str(upload_dir))
    monkeypatch.setenv("TRYON_RESULT_DIR", str(tryon_dir))
    monkeypatch.setenv("SEED_DIR", str(seed_dir))
    monkeypatch.setenv("REPORT_DIR", str(report_dir))
    monkeypatch.setenv("XHS_DAILY_REPORT_ASSETS_DIR", str(xhs_report_assets_dir))
    monkeypatch.setenv("XHS_CRAWLER_ASSETS_DIR", str(xhs_crawler_assets_dir))
    monkeypatch.setenv("SEED_XLSX_PATH", str(ROOT / "命题三美甲评测数据（对外版）.xlsx"))
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("LONGCAT_API_KEY", "")
    monkeypatch.setenv("OPS_AI_PROVIDER", "local")

    from app.core.config import get_settings
    from app.core.db import Base, database

    get_settings.cache_clear()
    settings = get_settings()
    database.configure(settings.database_url)
    Base.metadata.drop_all(bind=database.engine)
    Base.metadata.create_all(bind=database.engine)

    yield settings

    Base.metadata.drop_all(bind=database.engine)


@pytest.fixture()
def client(app_env):
    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture()
def db_session(app_env):
    from app.core.db import database

    with database.session() as session:
        yield session


@pytest.fixture()
def image_factory(tmp_path: Path):
    def _create(name: str, color: tuple[int, int, int] = (240, 180, 180)) -> Path:
        path = tmp_path / name
        Image.new("RGB", (256, 256), color).save(path)
        return path

    return _create
