"""SQLAlchemy engine + session factory + FastAPI DB dependency."""

import logging
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, text
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
    except Exception:  # pragma: no cover
        db.rollback()  # pragma: no cover
        raise  # pragma: no cover
    finally:
        db.close()


class MigrationDriftError(RuntimeError):
    """Raised at startup when the DB's applied migration doesn't match the
    code's expected head -- see check_migrations_up_to_date."""


def check_migrations_up_to_date() -> None:
    """Fail loudly at process startup if the connected database's
    alembic_version doesn't match this codebase's migration head.

    Production incident this guards against: the dev database was found
    stuck 3 migrations behind (at revision 0014) while the API server kept
    running and serving requests against tables/columns that didn't exist
    yet, failing confusingly deep inside ORM queries instead of at startup.
    Previously this drift was only ever caught by dev.sh's manual pre-flight
    check, which only helps if every process is launched through that
    script -- any other invocation path (a stray `uvicorn` command, a
    container, CI) had no guard at all.

    Skips silently for SQLite (used only by the test suite's in-memory
    engine, which is created fresh per test via Base.metadata.create_all and
    never has an alembic_version table to compare against).
    """
    if engine.dialect.name == "sqlite":
        return

    from alembic.config import Config
    from alembic.script import ScriptDirectory

    repo_root = Path(__file__).resolve().parents[2]
    alembic_cfg = Config(str(repo_root / "alembic.ini"))
    script = ScriptDirectory.from_config(alembic_cfg)
    expected_head = script.get_current_head()

    with engine.connect() as conn:
        current_rev = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()

    if current_rev != expected_head:
        raise MigrationDriftError(
            f"Database migration drift detected: DB is at revision {current_rev!r}, "
            f"but code expects head revision {expected_head!r}. Run `alembic upgrade head` "
            f"before starting the API server."
        )
