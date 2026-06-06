from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.models.nail_style import NailStyle
from app.models.style_event_daily import StyleEventDaily


def _ops_headers(client) -> dict[str, str]:
    settings = get_settings()
    response = client.post(
        "/api/v1/ops/auth/login",
        json={"username": settings.ops_admin_username, "password": settings.ops_admin_password},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_ops_report_generate_and_save(client, db_session, image_factory):
    headers = _ops_headers(client)
    settings = get_settings()
    today = datetime.now(ZoneInfo(settings.ops_report_timezone)).date()
    style_a = NailStyle(
        title="裸粉法式",
        description="desc",
        image_url="http://example.com/a.png",
        local_image_path=str(image_factory("a.png")),
        source_type="seed_xlsx",
        tags_json=["裸粉", "法式"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=30,
        is_trending=True,
    )
    style_b = NailStyle(
        title="贴钻节日",
        description="desc",
        image_url="http://example.com/b.png",
        local_image_path=str(image_factory("b.png")),
        source_type="seed_xlsx",
        tags_json=["贴钻", "节日"],
        dominant_colors_json=[],
        style_metadata_json={},
        popularity_score=12,
        is_trending=False,
    )
    db_session.add_all([style_a, style_b])
    db_session.commit()
    db_session.refresh(style_a)
    db_session.refresh(style_b)

    db_session.add_all(
        [
            StyleEventDaily(style_id=style_a.id, stat_date=today, impressions=100, clicks=40, favorites=12, tryons=9, publishes=0, ctr=0.4),
            StyleEventDaily(style_id=style_b.id, stat_date=today, impressions=200, clicks=20, favorites=3, tryons=2, publishes=0, ctr=0.1),
        ]
    )
    db_session.commit()

    generated = client.post("/api/v1/ops/reports/generate", headers=headers)
    assert generated.status_code == 200
    payload = generated.json()
    assert payload["report_json"]["metrics"]["homepage_impressions"] == 300
    assert payload["report_json"]["metrics"]["homepage_clicks"] == 60
    assert payload["report_json"]["high_impression_low_ctr"][0]["title"] == "贴钻节日"
    assert payload["markdown_content"].startswith("# 焕甲运营日报")

    saved = client.post("/api/v1/ops/reports/save", json=payload, headers=headers)
    assert saved.status_code == 200
    report = saved.json()
    assert Path(report["local_file_path"]).exists()
    assert Path(report["local_file_path"].replace(".md", ".json")).exists()
