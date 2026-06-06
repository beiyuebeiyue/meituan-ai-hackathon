from __future__ import annotations

import asyncio
import logging
import mimetypes
import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import httpx
import websockets
from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.db import database, init_db

mimetypes.add_type("image/webp", ".webp")
logger = logging.getLogger(__name__)


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
        from app.services.seed_service import SeedService

        with database.session() as session:
            admin_user = AuthService().ensure_default_admin(session)
            if settings.enable_packaged_seed_styles:
                SeedService().ensure_packaged_seed_styles(session, author_user_id=admin_user.id if admin_user else None)
            MerchantShopService().ensure_default_admin_shop(session, admin_user)
        from app.tasks.trend_tasks import start_weekly_trend_campaign_scheduler

        start_weekly_trend_campaign_scheduler()

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

    @app.get("/xhs-weekly-nail-report.html")
    @app.head("/xhs-weekly-nail-report.html")
    @app.get("/xhs_weekly_nail_report.html")
    @app.head("/xhs_weekly_nail_report.html")
    def serve_xhs_weekly_nail_report() -> FileResponse:
        return FileResponse(settings.xhs_weekly_report_path)

    @app.get("/openclaw-gateway")
    @app.head("/openclaw-gateway")
    def redirect_openclaw_gateway() -> RedirectResponse:
        return RedirectResponse("/openclaw-gateway/")

    @app.get("/openclaw-ws-health")
    def openclaw_websocket_health_http() -> dict[str, str]:
        return {"status": "http-ok", "websocket": "available"}

    @app.websocket("/openclaw-ws-health")
    async def openclaw_websocket_health(websocket: WebSocket) -> None:
        await websocket.accept()
        await websocket.send_text("ok")
        await websocket.close()

    @app.websocket("/openclaw-gateway")
    @app.websocket("/openclaw-gateway/{full_path:path}")
    async def proxy_openclaw_gateway_websocket(websocket: WebSocket, full_path: str = "") -> None:
        target_url = _openclaw_target_url(settings.openclaw_base_url, full_path, websocket.url.query, websocket=True)
        headers = _proxy_headers(websocket.headers, exclude=WEBSOCKET_HANDSHAKE_HEADERS)
        await websocket.accept()
        try:
            async with websockets.connect(target_url, additional_headers=headers, open_timeout=10) as upstream:
                browser_to_upstream = asyncio.create_task(_websocket_browser_to_upstream(websocket, upstream))
                upstream_to_browser = asyncio.create_task(_websocket_upstream_to_browser(websocket, upstream))
                done, pending = await asyncio.wait(
                    {browser_to_upstream, upstream_to_browser},
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
                for task in done:
                    task.result()
        except WebSocketDisconnect:
            return
        except Exception as exc:
            logger.warning("OpenClaw websocket proxy failed for %s: %s", target_url, exc)
            await _close_websocket(websocket, code=1011)

    @app.api_route(
        "/openclaw-gateway/{full_path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    )
    async def proxy_openclaw_gateway(request: Request, full_path: str = "") -> Response:
        target_url = _openclaw_target_url(settings.openclaw_base_url, full_path, request.url.query)
        headers = _proxy_headers(request.headers, exclude={"content-length"})
        body = await request.body()
        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=False) as client:
                upstream = await client.request(request.method, target_url, headers=headers, content=body)
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="OpenClaw Gateway 暂不可用") from exc

        response_headers = {
            key: value
            for key, value in upstream.headers.items()
            if key.lower() not in {"connection", "content-encoding", "content-length", "transfer-encoding"}
        }
        return Response(content=upstream.content, status_code=upstream.status_code, headers=response_headers)

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
                    "openclaw-gateway",
                    "xhs-daily-report-assets/",
                    "xhs-weekly-nail-report.html",
                    "mobile",
                    "mobile-assets/",
                    "mobile-expo/",
                )
            ):
                raise HTTPException(status_code=404, detail="Not found")
            return FileResponse(ops_web_index)

    return app


def _openclaw_target_url(base_url: str, full_path: str, query: str = "", websocket: bool = False) -> str:
    parsed = urlsplit(base_url.rstrip("/"))
    scheme = parsed.scheme
    if websocket:
        scheme = "wss" if scheme == "https" else "ws"
    path = "/".join(part.strip("/") for part in (parsed.path, full_path) if part.strip("/"))
    return urlunsplit((scheme, parsed.netloc, f"/{path}" if path else "/", query, ""))


WEBSOCKET_HANDSHAKE_HEADERS = {
    "content-length",
    "origin",
    "sec-websocket-extensions",
    "sec-websocket-key",
    "sec-websocket-protocol",
    "sec-websocket-version",
    "upgrade",
}


def _proxy_headers(headers, exclude: set[str] | None = None) -> dict[str, str]:
    ignored = {"host", "connection"}
    if exclude:
        ignored.update(exclude)
    return {key: value for key, value in headers.items() if key.lower() not in ignored}


async def _websocket_browser_to_upstream(websocket: WebSocket, upstream) -> None:
    while True:
        message = await websocket.receive()
        if message["type"] == "websocket.disconnect":
            await upstream.close()
            return
        if "text" in message and message["text"] is not None:
            await upstream.send(message["text"])
        elif "bytes" in message and message["bytes"] is not None:
            await upstream.send(message["bytes"])


async def _websocket_upstream_to_browser(websocket: WebSocket, upstream) -> None:
    async for message in upstream:
        if isinstance(message, bytes):
            await websocket.send_bytes(message)
        else:
            await websocket.send_text(message)


async def _close_websocket(websocket: WebSocket, code: int) -> None:
    try:
        await websocket.close(code=code)
    except RuntimeError:
        return


app = create_app()
