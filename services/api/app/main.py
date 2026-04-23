from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.db import database, init_db


def create_app() -> FastAPI:
    settings = get_settings()
    database.configure(settings.database_url)

    app = FastAPI(title="NailTry AI API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup() -> None:
        settings.upload_path.mkdir(parents=True, exist_ok=True)
        settings.tryon_result_path.mkdir(parents=True, exist_ok=True)
        settings.seed_path.mkdir(parents=True, exist_ok=True)
        settings.report_path.mkdir(parents=True, exist_ok=True)
        init_db()
        from app.services.auth_service import AuthService

        with database.session() as session:
            AuthService().ensure_default_admin(session)

    app.mount(
        settings.public_files_prefix,
        StaticFiles(directory=str(settings.base_dir / "data")),
        name="files",
    )

    from app.routers import (
        admin,
        ai_recommend,
        auth,
        events,
        favorites,
        jobs,
        nails,
        ops_reports,
        posts,
        trend,
        tryon,
        users,
    )

    app.include_router(auth.router, prefix=settings.api_prefix)
    app.include_router(users.router, prefix=settings.api_prefix)
    app.include_router(nails.router, prefix=settings.api_prefix)
    app.include_router(favorites.router, prefix=settings.api_prefix)
    app.include_router(posts.router, prefix=settings.api_prefix)
    app.include_router(ai_recommend.router, prefix=settings.api_prefix)
    app.include_router(tryon.router, prefix=settings.api_prefix)
    app.include_router(events.router, prefix=settings.api_prefix)
    app.include_router(ops_reports.router, prefix=settings.api_prefix)
    app.include_router(jobs.router, prefix=settings.api_prefix)
    app.include_router(trend.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)

    return app


app = create_app()
