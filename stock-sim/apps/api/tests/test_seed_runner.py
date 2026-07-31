from unittest.mock import MagicMock, patch

from db.seeds.run_all import _has_complete_seed_baseline


def _engine_with_counts(counts: tuple[int, int, int]) -> MagicMock:
    engine = MagicMock()
    connection = engine.connect.return_value.__enter__.return_value
    connection.execute.return_value.one.return_value = counts
    return engine


def test_complete_seed_baseline_requires_all_core_data() -> None:
    with patch("sqlalchemy.create_engine", return_value=_engine_with_counts((1, 153, 306))):
        assert _has_complete_seed_baseline("sqlite://") is True


def test_complete_seed_baseline_reseeds_partial_database() -> None:
    with patch("sqlalchemy.create_engine", return_value=_engine_with_counts((1, 153, 0))):
        assert _has_complete_seed_baseline("sqlite://") is False
