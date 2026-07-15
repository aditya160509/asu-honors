"""FastAPI application entry point — registers routers, middleware, exception handlers."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.database import engine as db_engine
from apps.api.exceptions import add_exception_handlers
from apps.api.rate_limiter import InMemoryRateLimiter
from apps.api.routers import auth, health, leaderboard, market, news, portfolio, simulation, trading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    yield
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

    application.add_middleware(InMemoryRateLimiter, max_requests=60, window_seconds=60)

    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(market.router)
    application.include_router(trading.router)
    application.include_router(portfolio.router)
    application.include_router(simulation.router)
    application.include_router(news.router)
    application.include_router(leaderboard.router)

    add_exception_handlers(application)

    return application


app = create_app()
