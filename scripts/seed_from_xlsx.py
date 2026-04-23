from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.config import get_settings
from app.core.db import database, init_db
from app.services.seed_service import SeedService


def resolve_xlsx_path(cli_value: str | None) -> Path:
    settings = get_settings()
    if cli_value:
        return Path(cli_value).expanduser().resolve()
    if settings.seed_xlsx.exists():
        return settings.seed_xlsx
    candidates = sorted(ROOT.glob("*.xlsx"))
    if candidates:
        return candidates[0]
    raise FileNotFoundError("未找到 xlsx，请通过 --xlsx 或 SEED_XLSX_PATH 指定")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import seed nail styles from xlsx")
    parser.add_argument("--xlsx", type=str, default=None)
    args = parser.parse_args()

    database.configure(get_settings().database_url)
    init_db()
    xlsx_path = resolve_xlsx_path(args.xlsx)
    with database.session() as db:
        result = SeedService().import_seed_data(db, xlsx_path=xlsx_path)
    print(result)


if __name__ == "__main__":
    main()
