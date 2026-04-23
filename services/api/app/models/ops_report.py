from __future__ import annotations

from datetime import date

from sqlalchemy import Date, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class OpsReport(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ops_reports"

    report_date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    markdown_content: Mapped[str] = mapped_column(Text, nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    report_json: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    local_file_path: Mapped[str] = mapped_column(String(512), nullable=False)
