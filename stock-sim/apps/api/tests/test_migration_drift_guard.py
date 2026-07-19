"""Regression tests for apps/api/database.py::check_migrations_up_to_date.

Production incident this guards against: the dev database was found stuck 3
migrations behind (at revision 0014) while the API server kept running and
serving requests against tables/columns that didn't exist yet. This guard
makes any process that boots the FastAPI app (apps/api/main.py's lifespan)
fail loudly at startup instead, regardless of how it was launched.
"""

from unittest.mock import MagicMock, patch

import pytest

import apps.api.database as dbmod


def test_check_migrations_up_to_date_skips_for_sqlite():
    """The test suite's in-memory SQLite engines never have an
    alembic_version table (they're built fresh via Base.metadata.create_all
    per test) -- the guard must no-op rather than error for them."""
    assert dbmod.engine.dialect.name == "sqlite"
    dbmod.check_migrations_up_to_date()  # must not raise


def test_check_migrations_up_to_date_raises_on_drift():
    """If the DB's alembic_version doesn't match the code's migration head,
    startup must fail loudly with a clear message, not silently serve
    requests against stale schema."""
    fake_conn = MagicMock()
    fake_conn.__enter__.return_value.execute.return_value.scalar.return_value = "0014_stale_revision"

    with patch.object(dbmod.engine, "dialect") as mock_dialect, \
         patch.object(dbmod.engine, "connect", return_value=fake_conn):
        mock_dialect.name = "postgresql"
        with pytest.raises(dbmod.MigrationDriftError, match="0014_stale_revision"):
            dbmod.check_migrations_up_to_date()


def test_check_migrations_up_to_date_passes_when_current():
    """No drift -> no exception, even for a non-SQLite dialect."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from pathlib import Path

    repo_root = Path(dbmod.__file__).resolve().parents[2]
    alembic_cfg = Config(str(repo_root / "alembic.ini"))
    script = ScriptDirectory.from_config(alembic_cfg)
    expected_head = script.get_current_head()

    fake_conn = MagicMock()
    fake_conn.__enter__.return_value.execute.return_value.scalar.return_value = expected_head

    with patch.object(dbmod.engine, "dialect") as mock_dialect, \
         patch.object(dbmod.engine, "connect", return_value=fake_conn):
        mock_dialect.name = "postgresql"
        dbmod.check_migrations_up_to_date()  # must not raise
