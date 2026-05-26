from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


class DatabaseManager:
    def __init__(self) -> None:
        self._url: str | None = None
        self._engine: Engine | None = None
        self._session_factory: sessionmaker[Session] | None = None

    def configure(self, url: str | None = None) -> None:
        settings = get_settings()
        database_url = url or settings.database_url
        if self._url == database_url and self._engine is not None and self._session_factory is not None:
            return

        connect_args: dict[str, object] = {}
        if database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False

        self._engine = create_engine(
            database_url,
            future=True,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
        self._url = database_url

    @property
    def engine(self) -> Engine:
        if self._engine is None:
            self.configure()
        assert self._engine is not None
        return self._engine

    @property
    def session_factory(self) -> sessionmaker[Session]:
        if self._session_factory is None:
            self.configure()
        assert self._session_factory is not None
        return self._session_factory

    def session(self) -> Session:
        return self.session_factory()


database = DatabaseManager()


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=database.engine)
    sync_runtime_schema()


def _dedupe_merchant_shops(connection, table_names: list[str]) -> None:
    if "merchant_shops" not in table_names:
        return
    inspector = inspect(connection)

    def has_column(table_name: str, column_name: str) -> bool:
        if table_name not in table_names:
            return False
        return column_name in {column["name"] for column in inspector.get_columns(table_name)}

    rows = connection.execute(
        text(
            """
            SELECT id, merchant_user_id
            FROM merchant_shops
            ORDER BY merchant_user_id, is_default DESC, created_at ASC, id ASC
            """
        )
    ).mappings().all()
    grouped: dict[str, list[str]] = {}
    for row in rows:
        grouped.setdefault(str(row["merchant_user_id"]), []).append(str(row["id"]))

    for shop_ids in grouped.values():
        keep_id, duplicate_ids = shop_ids[0], shop_ids[1:]
        if not duplicate_ids:
            connection.execute(text("UPDATE merchant_shops SET is_default = TRUE WHERE id = :keep_id"), {"keep_id": keep_id})
            continue
        for duplicate_id in duplicate_ids:
            for table_name, column_name in (
                ("bookings", "shop_id"),
                ("user_posts", "shop_id"),
                ("nail_styles", "shop_id"),
                ("direct_messages", "booking_invite_shop_id"),
                ("analytics_events", "shop_id"),
            ):
                if has_column(table_name, column_name):
                    connection.execute(
                        text(f"UPDATE {table_name} SET {column_name} = :keep_id WHERE {column_name} = :duplicate_id"),
                        {"keep_id": keep_id, "duplicate_id": duplicate_id},
                    )

            if "merchant_trend_claims" in table_names:
                connection.execute(
                    text(
                        """
                        DELETE FROM merchant_trend_claims
                        WHERE shop_id = :duplicate_id
                          AND EXISTS (
                            SELECT 1
                            FROM merchant_trend_claims kept
                            WHERE kept.shop_id = :keep_id
                              AND kept.style_id = merchant_trend_claims.style_id
                          )
                        """
                    ),
                    {"keep_id": keep_id, "duplicate_id": duplicate_id},
                )
                connection.execute(
                    text("UPDATE merchant_trend_claims SET shop_id = :keep_id WHERE shop_id = :duplicate_id"),
                    {"keep_id": keep_id, "duplicate_id": duplicate_id},
                )

            connection.execute(text("DELETE FROM merchant_shops WHERE id = :duplicate_id"), {"duplicate_id": duplicate_id})
        connection.execute(text("UPDATE merchant_shops SET is_default = TRUE WHERE id = :keep_id"), {"keep_id": keep_id})


def sync_runtime_schema() -> None:
    inspector = inspect(database.engine)
    table_names = inspector.get_table_names()
    if "users" not in table_names:
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    with database.engine.begin() as connection:
        if "uid" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN uid INTEGER"))
        if "phone" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(20)"))
        if "birthday" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN birthday VARCHAR(20)"))
        if "bio" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
        if "last_login_ip_location" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN last_login_ip_location VARCHAR(120)"))
        if "location_city" in user_columns:
            connection.execute(text("ALTER TABLE users DROP COLUMN location_city"))
        if "role" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'consumer'"))
        if "source_type" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN source_type VARCHAR(40) DEFAULT 'native'"))
        if "source_external_id" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN source_external_id VARCHAR(160)"))
        if "email" in user_columns and database.engine.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE users ALTER COLUMN email DROP NOT NULL"))
        connection.execute(text("UPDATE users SET role = 'consumer' WHERE role IS NULL OR role = ''"))
        connection.execute(text("UPDATE users SET source_type = 'native' WHERE source_type IS NULL OR source_type = ''"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_uid ON users (uid)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone ON users (phone)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_users_source_external_id ON users (source_external_id)"))
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS ix_users_source_unique
                ON users (source_type, source_external_id)
                WHERE source_external_id IS NOT NULL
                """
            )
        )

        if "user_posts" in table_names:
            post_columns = {column["name"] for column in inspector.get_columns("user_posts")}
            if "shop_id" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN shop_id VARCHAR(36)"))
            if "verified_booking_id" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN verified_booking_id VARCHAR(36)"))
            if "nail_type" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN nail_type VARCHAR(20)"))
            if "is_hidden" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE"))
            if "source_type" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN source_type VARCHAR(50) DEFAULT 'user_upload'"))
            if "source_external_id" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN source_external_id VARCHAR(160)"))
            if "source_metadata_json" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN source_metadata_json JSON"))
            connection.execute(
                text(
                    """
                    UPDATE user_posts
                    SET nail_type = CASE
                        WHEN shop_id IS NOT NULL OR verified_booking_id IS NOT NULL THEN 'handmade'
                        ELSE 'press_on'
                    END
                    WHERE nail_type IS NULL OR nail_type = ''
                    """
                )
            )
            connection.execute(text("UPDATE user_posts SET is_hidden = FALSE WHERE is_hidden IS NULL"))
            connection.execute(text("UPDATE user_posts SET source_type = 'user_upload' WHERE source_type IS NULL OR source_type = ''"))
            connection.execute(text("UPDATE user_posts SET source_metadata_json = '{}' WHERE source_metadata_json IS NULL"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_user_posts_source_external_id ON user_posts (source_external_id)"))
            connection.execute(
                text(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_user_posts_source_unique
                    ON user_posts (source_type, source_external_id)
                    WHERE source_external_id IS NOT NULL
                    """
                )
            )

        if "nail_styles" in table_names:
            style_columns = {column["name"] for column in inspector.get_columns("nail_styles")}
            if "shop_id" not in style_columns:
                connection.execute(text("ALTER TABLE nail_styles ADD COLUMN shop_id VARCHAR(36)"))
            if "verified_booking_id" not in style_columns:
                connection.execute(text("ALTER TABLE nail_styles ADD COLUMN verified_booking_id VARCHAR(36)"))
            if "nail_type" not in style_columns:
                connection.execute(text("ALTER TABLE nail_styles ADD COLUMN nail_type VARCHAR(20)"))
            connection.execute(
                text(
                    """
                    UPDATE nail_styles
                    SET nail_type = CASE
                        WHEN source_type IN ('seed_xlsx', 'xhs_note') THEN 'press_on'
                        WHEN source_type = 'user_upload' AND (shop_id IS NOT NULL OR verified_booking_id IS NOT NULL) THEN 'handmade'
                        ELSE 'press_on'
                    END
                    WHERE nail_type IS NULL OR nail_type = ''
                    """
                )
            )

        _dedupe_merchant_shops(connection, table_names)
        if "merchant_shops" in table_names:
            connection.execute(
                text(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_merchant_shops_merchant_user_id_unique
                    ON merchant_shops (merchant_user_id)
                    """
                )
            )

        if "direct_messages" in table_names:
            message_columns = {column["name"] for column in inspector.get_columns("direct_messages")}
            if "read_at" not in message_columns:
                connection.execute(text("ALTER TABLE direct_messages ADD COLUMN read_at TIMESTAMP"))
            if "image_url" not in message_columns:
                connection.execute(text("ALTER TABLE direct_messages ADD COLUMN image_url VARCHAR(500)"))
            if "local_image_path" not in message_columns:
                connection.execute(text("ALTER TABLE direct_messages ADD COLUMN local_image_path VARCHAR(500)"))
            if "shared_style_id" not in message_columns:
                connection.execute(text("ALTER TABLE direct_messages ADD COLUMN shared_style_id VARCHAR(36)"))
            if "booking_invite_shop_id" not in message_columns:
                connection.execute(text("ALTER TABLE direct_messages ADD COLUMN booking_invite_shop_id VARCHAR(36)"))

        if "tryon_jobs" in table_names:
            tryon_columns = {column["name"] for column in inspector.get_columns("tryon_jobs")}
            if "stage" not in tryon_columns:
                connection.execute(text("ALTER TABLE tryon_jobs ADD COLUMN stage VARCHAR(30) DEFAULT 'pending'"))
            connection.execute(text("UPDATE tryon_jobs SET stage = status WHERE stage IS NULL OR stage = ''"))

        if "bookings" in table_names:
            booking_columns = {column["name"]: column for column in inspector.get_columns("bookings")}
            if "amount_cents" not in booking_columns:
                connection.execute(text("ALTER TABLE bookings ADD COLUMN amount_cents INTEGER DEFAULT 10000 NOT NULL"))
            connection.execute(text("UPDATE bookings SET amount_cents = 10000 WHERE amount_cents IS NULL OR amount_cents <= 0"))
            style_column = booking_columns.get("style_id")
            if style_column and not style_column.get("nullable", True) and database.engine.dialect.name == "postgresql":
                connection.execute(text("ALTER TABLE bookings ALTER COLUMN style_id DROP NOT NULL"))


def get_db() -> Generator[Session, None, None]:
    session = database.session()
    try:
        yield session
    finally:
        session.close()
