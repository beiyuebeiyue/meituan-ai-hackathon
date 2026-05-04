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
        if "location_city" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN location_city VARCHAR(80)"))
        if "role" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'consumer'"))
        connection.execute(text("UPDATE users SET role = 'consumer' WHERE role IS NULL OR role = ''"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_uid ON users (uid)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone ON users (phone)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))

        if "user_posts" in table_names:
            post_columns = {column["name"] for column in inspector.get_columns("user_posts")}
            if "shop_id" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN shop_id VARCHAR(36)"))
            if "verified_booking_id" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN verified_booking_id VARCHAR(36)"))
            if "is_hidden" not in post_columns:
                connection.execute(text("ALTER TABLE user_posts ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE"))
            connection.execute(text("UPDATE user_posts SET is_hidden = FALSE WHERE is_hidden IS NULL"))

        if "nail_styles" in table_names:
            style_columns = {column["name"] for column in inspector.get_columns("nail_styles")}
            if "shop_id" not in style_columns:
                connection.execute(text("ALTER TABLE nail_styles ADD COLUMN shop_id VARCHAR(36)"))
            if "verified_booking_id" not in style_columns:
                connection.execute(text("ALTER TABLE nail_styles ADD COLUMN verified_booking_id VARCHAR(36)"))

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
            style_column = booking_columns.get("style_id")
            if style_column and not style_column.get("nullable", True) and database.engine.dialect.name == "postgresql":
                connection.execute(text("ALTER TABLE bookings ALTER COLUMN style_id DROP NOT NULL"))


def get_db() -> Generator[Session, None, None]:
    session = database.session()
    try:
        yield session
    finally:
        session.close()
