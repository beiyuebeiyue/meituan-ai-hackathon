from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
API_ROOT = ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.config import get_settings
from app.core.db import database, init_db
from app.services.seed_service import SeedService


def main() -> None:
    database.configure(get_settings().database_url)
    init_db()
    with database.session() as db:
        result = SeedService().enrich_style_metadata(db)
    print(result)


if __name__ == "__main__":
    main()
