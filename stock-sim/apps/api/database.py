"""SQLAlchemy engine + session factory + FastAPI DB dependency."""

import logging
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from apps.api.config import settings

logger = logging.getLogger(__name__)

connect_args = {}
kwargs = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    kwargs["poolclass"] = None  # singleton pool, SQLite default
else:
    kwargs["pool_size"] = 10
    kwargs["max_overflow"] = 20

engine = create_engine(settings.database_url, connect_args=connect_args, **kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
