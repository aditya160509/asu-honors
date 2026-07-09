"""SQLAlchemy engine + session factory + FastAPI DB dependency."""

import logging
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from apps.api.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(settings.database_url, pool_size=10, max_overflow=20)
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
