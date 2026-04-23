from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook

from app.models.nail_style import NailStyle
from app.services.seed_service import SeedService


class FakeResponse:
    def __init__(self, content: bytes, content_type: str = "image/png", status_code: int = 200):
        self.content = content
        self.status_code = status_code
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError("download failed")


def test_seed_import_handles_dedup_and_failures(db_session, tmp_path, monkeypatch):
    workbook_path = tmp_path / "seed.xlsx"
    workbook = Workbook()
    hand_sheet = workbook.active
    hand_sheet.title = "手图"
    hand_sheet.append(["手图URL", "款式图URL"])
    hand_sheet.append(["http://example.com/hand-1.png", "http://example.com/style-enhanced-1.png"])
    hand_sheet.append(["http://example.com/bad.png", "http://example.com/style-enhanced-dup.png"])
    style_sheet = workbook.create_sheet("款式图")
    style_sheet.append(["序号", "原始款式图URL", "增强后款式图URL"])
    style_sheet.append([1, "http://example.com/style-original-1.png", "http://example.com/style-enhanced-1.png"])
    style_sheet.append([2, "http://example.com/style-original-dup.png", "http://example.com/style-enhanced-dup.png"])
    workbook.save(workbook_path)

    content_map = {
        "http://example.com/hand-1.png": b"hand",
        "http://example.com/style-enhanced-1.png": b"same-style",
        "http://example.com/style-enhanced-dup.png": b"same-style",
        "http://example.com/style-original-1.png": b"orig-a",
        "http://example.com/style-original-dup.png": b"orig-a",
    }

    def fake_get(url: str, **_kwargs):
        if url == "http://example.com/bad.png":
            raise RuntimeError("boom")
        return FakeResponse(content_map[url])

    monkeypatch.setattr("app.services.seed_service.httpx.get", fake_get)
    result = SeedService().import_seed_data(db_session, xlsx_path=workbook_path)

    assert result["hands_count"] == 1
    assert result["style_original_count"] == 2
    assert result["style_enhanced_count"] == 2
    assert result["deduped_style_count"] == 2
    assert result["failed_urls"] == [{"url": "http://example.com/bad.png", "error": "boom"}]
    assert (SeedService().settings.seed_path / "manifests" / "latest.json").exists()
    assert db_session.query(NailStyle).count() == 2
