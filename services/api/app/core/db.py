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
    if "users" not in inspector.get_table_names():
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    with database.engine.begin() as connection:
        if "phone" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(20)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone ON users (phone)"))


def get_db() -> Generator[Session, None, None]:
    session = database.session()
    try:
        yield session
    finally:
        session.close()
