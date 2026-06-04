from __future__ import annotations

import mimetypes
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.db import database, init_db

mimetypes.add_type("image/webp", ".webp")


def create_app() -> FastAPI:
    settings = get_settings()
    database.configure(settings.database_url)

    app = FastAPI(title="焕甲 API", version="0.1.0")
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
        settings.tryon_artifact_path.mkdir(parents=True, exist_ok=True)
        settings.seed_path.mkdir(parents=True, exist_ok=True)
        settings.report_path.mkdir(parents=True, exist_ok=True)
        init_db()
        from app.services.auth_service import AuthService
        from app.services.merchant_service import MerchantShopService

        with database.session() as session:
            admin_user = AuthService().ensure_default_admin(session)
            MerchantShopService().ensure_default_admin_shop(session, admin_user)

    app.mount(
        settings.public_files_prefix,
        StaticFiles(directory=str(settings.base_dir / "data")),
        name="files",
    )
    app.mount(
        "/openclaw-assets",
        StaticFiles(directory=str(settings.xhs_crawler_assets_path), check_dir=False),
        name="openclaw-assets",
    )
    app.mount(
        "/xhs-daily-report-assets",
        StaticFiles(directory=str(settings.xhs_daily_report_assets_path), check_dir=False),
        name="xhs-daily-report-assets",
    )

    from app.routers import (
        admin,
        ai_recommend,
        auth,
        bookings,
        events,
        favorites,
        jobs,
        market,
        merchant,
        messages,
        nails,
        ops_admin,
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
    app.include_router(merchant.router, prefix=settings.api_prefix)
    app.include_router(bookings.router, prefix=settings.api_prefix)
    app.include_router(messages.router, prefix=settings.api_prefix)
    app.include_router(market.router, prefix=settings.api_prefix)
    app.include_router(ai_recommend.router, prefix=settings.api_prefix)
    app.include_router(tryon.router, prefix=settings.api_prefix)
    app.include_router(events.router, prefix=settings.api_prefix)
    app.include_router(ops_admin.router, prefix=settings.api_prefix)
    app.include_router(jobs.router, prefix=settings.api_prefix)
    app.include_router(trend.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)

    mobile_web_dist = Path(os.getenv("MOBILE_WEB_DIST", ""))
    mobile_web_index = mobile_web_dist / "index.html"
    if mobile_web_index.exists():
        mobile_assets_dir = mobile_web_dist / "assets"
        mobile_expo_dir = mobile_web_dist / "_expo"
        mobile_favicon = mobile_web_dist / "favicon.ico"
        if mobile_assets_dir.exists():
            app.mount("/mobile-assets", StaticFiles(directory=str(mobile_assets_dir)), name="mobile-web-assets")
        if mobile_expo_dir.exists():
            app.mount("/mobile-expo", StaticFiles(directory=str(mobile_expo_dir)), name="mobile-web-expo")

        @app.get("/mobile-favicon.ico")
        @app.head("/mobile-favicon.ico")
        def serve_mobile_favicon() -> FileResponse:
            return FileResponse(mobile_favicon if mobile_favicon.exists() else mobile_web_index)

        @app.get("/mobile")
        @app.get("/mobile/{full_path:path}")
        @app.head("/mobile")
        @app.head("/mobile/{full_path:path}")
        def serve_mobile_web(full_path: str = "") -> FileResponse:
            return FileResponse(mobile_web_index)

    ops_web_dist = Path(os.getenv("OPS_WEB_DIST", ""))
    ops_web_index = ops_web_dist / "index.html"
    if ops_web_index.exists():
        assets_dir = ops_web_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="ops-web-assets")

        @app.get("/")
        @app.get("/{full_path:path}")
        @app.head("/")
        @app.head("/{full_path:path}")
        def serve_ops_web(full_path: str = "") -> FileResponse:
            if full_path.startswith(
                (
                    "api/",
                    "files/",
                    "openclaw-assets/",
                    "xhs-daily-report-assets/",
                    "mobile",
                    "mobile-assets/",
                    "mobile-expo/",
                )
            ):
                raise HTTPException(status_code=404, detail="Not found")
            return FileResponse(ops_web_index)

    return app


app = create_app()
