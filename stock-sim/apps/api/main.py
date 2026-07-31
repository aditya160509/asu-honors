"""FastAPI application entry point — registers routers, middleware, exception handlers."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from apps.api.database import check_migrations_up_to_date
from apps.api.database import engine as db_engine
from apps.api.response_cache import response_cache
from apps.api import background_jobs
from apps.api.exceptions import add_exception_handlers

from apps.api.routers import (
    audit_log,
    auth,
    concalls,
    health,
    leaderboard,
    market,
    news,
    notifications,
    portfolio,
    scenario_library,
    simulation,
    trading,
    ws,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Fail loudly at startup rather than serving requests against a database
    # that's behind on migrations -- see check_migrations_up_to_date's
    # docstring for the production incident this prevents from recurring.
    check_migrations_up_to_date()
    background_jobs.start()
    background_jobs.recover_timelines()
    try:
        yield
    finally:
        response_cache.clear()
        background_jobs.stop()
        db_engine.dispose()


def create_app() -> FastAPI:
    """Factory that builds and configures the FastAPI app."""
    application = FastAPI(
        title="Stock-Sim API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=_lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Market grids, analytics and timeline outputs are JSON-heavy. Compressing
    # responses above 1 KiB cuts transfer work for both Render and mobile
    # clients while leaving tiny control responses untouched.
    application.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=5)

    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(market.router)
    application.include_router(trading.router)
    application.include_router(portfolio.router)
    application.include_router(simulation.router)
    application.include_router(scenario_library.router)
    application.include_router(audit_log.router)
    application.include_router(news.router)
    application.include_router(concalls.router)
    application.include_router(leaderboard.router)
    application.include_router(notifications.router)
    application.include_router(ws.router)

    add_exception_handlers(application)

    return application


app = create_app()
