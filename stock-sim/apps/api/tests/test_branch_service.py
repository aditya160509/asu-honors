"""Tests for apps/api/services/branch_service.py — fork creation, cost
estimate, extend, archive."""

import re
from datetime import date, timedelta

import pytest

from apps.api.exceptions import ConflictError, NotFoundError
from apps.api.services import branch_service
from db.models import (
    CompanyFactorScore,
    FinancialQualitySubscore,
    MoatSubscore,
    PriceHistory,
    SimulationState,
    Timeline,
    TimelineOverride,
)


def _check_constraint_set(table, constraint_name: str) -> set[str]:
    """Extract the quoted string literals out of a CheckConstraint's SQL text,
    e.g. "target_type in ('a', 'b')" -> {"a", "b"}."""
    for constraint in table.constraints:
        if getattr(constraint, "name", None) == constraint_name:
            return set(re.findall(r"'([^']*)'", constraint.sqltext.text))
    raise AssertionError(f"No constraint named {constraint_name!r} found on {table.name}")


def test_valid_target_types_matches_db_check_constraint():
    """branch_service.VALID_TARGET_TYPES is the API-layer allowlist for
    TimelineOverride.target_type; ck_timeline_overrides_target_type is the
    DB's last line of defense against bad data from any other write path.
    Nothing keeps these two in sync if one changes without the other --
    this test exists so that drift becomes a loud test failure instead of a
    silent gap (see branch_service.py's TARGET_KEY_VOCABULARIES comment)."""
    db_values = _check_constraint_set(TimelineOverride.__table__, "ck_timeline_overrides_target_type")
    assert db_values == branch_service.VALID_TARGET_TYPES


def test_valid_primitives_matches_db_check_constraint():
    """Same drift guard as above, for branch_service.VALID_PRIMITIVES vs.
    ck_timelines_primitive. The DB constraint also allows a null primitive
    (pre-Future-Lab timelines have none), which VALID_PRIMITIVES doesn't
    need to represent since branch_service.create_branch always receives a
    concrete primitive string."""
    db_values = _check_constraint_set(Timeline.__table__, "ck_timelines_primitive")
    assert db_values == branch_service.VALID_PRIMITIVES


def test_create_branch_basic(test_db, test_timeline, test_user):
    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="My Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
    )
    test_db.commit()

    assert timeline.id is not None
    assert timeline.parent_timeline_id == test_timeline.id
    assert timeline.branch_point_sim_date == date(2026, 1, 2)
    assert timeline.is_live is False
    assert timeline.status == "pending"
    assert timeline.primitive == "manual"
    assert timeline.rng_seed is not None

    state = test_db.query(SimulationState).filter_by(timeline_id=timeline.id).first()
    assert state is not None
    assert state.current_sim_date == date(2026, 1, 2)
    assert state.tick_count == 0
    assert state.is_running is False


def test_create_branch_deterministic_seed_when_given(test_db, test_timeline, test_user):
    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Seeded Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=12345, primitive="manual",
    )
    assert timeline.rng_seed == 12345


# Postgres INTEGER (Timeline.rng_seed's column type) is a signed 32-bit int,
# max 2**31 - 1 = 2147483647. int(sha256_digest[:8], 16) draws uniformly
# from [0, 2**32 - 1] -- about half of all auto-generated seeds silently
# overflowed that column and crashed branch creation with a bare
# "psycopg.errors.NumericValueOutOfRange" 500, no validation message,
# reproducing only on roughly a coin flip (confirmed empirically: ~50% of
# hashes over many trials exceed the column's max).
_PG_INTEGER_MAX = 2**31 - 1


def test_create_branch_auto_seed_always_fits_postgres_integer_column(test_db, test_timeline, test_user):
    for i in range(200):
        timeline = branch_service.create_branch(
            test_db, user_id=test_user.id, name=f"Auto Seed Branch {i}", parent_id=test_timeline.id,
            branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
        )
        assert 0 <= timeline.rng_seed <= _PG_INTEGER_MAX


def test_create_branch_explicit_seed_over_postgres_integer_max_raises(test_db, test_timeline, test_user):
    with pytest.raises(ConflictError):
        branch_service.create_branch(
            test_db, user_id=test_user.id, name="Overflowing Seed", parent_id=test_timeline.id,
            branch_date=date(2026, 1, 2), rng_seed=_PG_INTEGER_MAX + 1, primitive="manual",
        )


def test_create_branch_explicit_seed_negative_raises(test_db, test_timeline, test_user):
    with pytest.raises(ConflictError):
        branch_service.create_branch(
            test_db, user_id=test_user.id, name="Negative Seed", parent_id=test_timeline.id,
            branch_date=date(2026, 1, 2), rng_seed=-1, primitive="manual",
        )


def test_create_branch_missing_parent_raises(test_db, test_user):
    with pytest.raises(NotFoundError):
        branch_service.create_branch(
            test_db, user_id=test_user.id, name="Orphan", parent_id=999,
            branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
        )


def test_create_branch_missing_parent_state_raises(test_db, test_user):
    parent = Timeline(id=50, name="No State", rng_seed=1, is_live=True)
    test_db.add(parent)
    test_db.commit()
    with pytest.raises(NotFoundError):
        branch_service.create_branch(
            test_db, user_id=test_user.id, name="Orphan", parent_id=50,
            branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
        )


def test_create_branch_future_date_raises(test_db, test_timeline, test_user):
    current = test_db.query(SimulationState).filter_by(timeline_id=test_timeline.id).first().current_sim_date
    with pytest.raises(ConflictError):
        branch_service.create_branch(
            test_db, user_id=test_user.id, name="Time Traveler", parent_id=test_timeline.id,
            branch_date=current + timedelta(days=30),
            rng_seed=None, primitive="manual",
        )


def test_create_branch_invalid_primitive_raises(test_db, test_timeline, test_user):
    with pytest.raises(ConflictError):
        branch_service.create_branch(
            test_db, user_id=test_user.id, name="Bad Primitive", parent_id=test_timeline.id,
            branch_date=date(2026, 1, 2), rng_seed=None, primitive="not_a_real_primitive",
        )


def test_create_branch_with_overrides_persists_rows(test_db, test_timeline, test_user, test_company):
    overrides = [
        branch_service.OverrideSpec(
            target_type="config", target_key="theta_default", override_value="0.08",
            effective_from_sim_date=date(2026, 1, 2),
        ),
        branch_service.OverrideSpec(
            target_type="driver_bias", target_key="guidance", override_value="0.2",
            effective_from_sim_date=date(2026, 1, 2), target_scope_id=test_company.id,
        ),
    ]
    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Override Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="structural_override", overrides=overrides,
    )
    test_db.commit()

    rows = test_db.query(TimelineOverride).filter_by(timeline_id=timeline.id).order_by(TimelineOverride.id).all()
    assert len(rows) == 2
    assert rows[0].target_type == "config"
    assert rows[0].target_key == "theta_default"
    assert rows[1].target_type == "driver_bias"
    assert rows[1].target_scope_id == test_company.id


def test_create_branch_invalid_override_target_type_raises(test_db, test_timeline, test_user):
    overrides = [
        branch_service.OverrideSpec(
            target_type="not_a_real_type", target_key="x", override_value="1",
            effective_from_sim_date=date(2026, 1, 2),
        ),
    ]
    with pytest.raises(ConflictError):
        branch_service.create_branch(
            test_db, user_id=test_user.id, name="Bad Override", parent_id=test_timeline.id,
            branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual", overrides=overrides,
        )


def test_create_branch_copies_parent_moat_subscores(test_db, test_timeline, test_user, test_company):
    """Regression test: a branch's fast-forward crashes on its first
    fundamentals refresh with ZeroDivisionError in moat_composite because
    the new timeline_id has no MoatSubscore rows of its own -- create_branch
    must seed the child with the parent's latest subscore rows."""
    test_db.add(MoatSubscore(
        company_id=test_company.id, timeline_id=test_timeline.id,
        subfactor_key="brand_strength", score=70.0,
    ))
    test_db.commit()

    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Moat Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
    )
    test_db.commit()

    child_rows = test_db.query(MoatSubscore).filter_by(timeline_id=timeline.id).all()
    assert len(child_rows) == 1
    assert child_rows[0].company_id == test_company.id
    assert child_rows[0].subfactor_key == "brand_strength"
    assert child_rows[0].score == 70.0


def test_create_branch_copies_parent_fq_subscores(test_db, test_timeline, test_user, test_company):
    test_db.add(FinancialQualitySubscore(
        company_id=test_company.id, timeline_id=test_timeline.id, fiscal_period="2026Q1",
        subfactor_key="roic", raw_metric_value=0.15, peer_percentile=80.0, subscore=80.0, applied_weight=1.0,
    ))
    test_db.commit()

    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="FQ Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
    )
    test_db.commit()

    child_rows = test_db.query(FinancialQualitySubscore).filter_by(timeline_id=timeline.id).all()
    assert len(child_rows) == 1
    assert child_rows[0].company_id == test_company.id
    assert child_rows[0].fiscal_period == "2026Q1"
    assert child_rows[0].subfactor_key == "roic"
    assert child_rows[0].subscore == 80.0


def test_create_branch_copies_parent_company_factor_scores(test_db, test_timeline, test_user, test_company):
    """Regression test: without this, a fresh branch has zero CompanyFactorScore
    rows until its own first quarter boundary (up to 63 ticks), so
    growth_potential silently falls back to 50.0 for every company and any
    factor_score override has nothing to apply itself against."""
    test_db.add(CompanyFactorScore(
        company_id=test_company.id, timeline_id=test_timeline.id, fiscal_period="2026Q1",
        management_quality=60.0, moat_score=55.0, financial_quality=70.0, fcf_quality=65.0,
        growth_potential=72.0, intrinsic_score=68.0, fair_pe=16.0, intrinsic_value=105.0,
    ))
    test_db.commit()

    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="CFS Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
    )
    test_db.commit()

    child_rows = test_db.query(CompanyFactorScore).filter_by(timeline_id=timeline.id).all()
    assert len(child_rows) == 1
    assert child_rows[0].company_id == test_company.id
    assert child_rows[0].fiscal_period == "2026Q1"
    assert float(child_rows[0].growth_potential) == 72.0
    assert float(child_rows[0].financial_quality) == 70.0


def test_create_branch_inherits_parent_tick_count(test_db, test_timeline, test_user):
    """Regression test: tick_count must carry over from the parent, not reset
    to 0 -- _compute_fiscal_period (engine/orchestrator.py) treats tick_count
    as an absolute day-count since a single global epoch shared by every
    timeline, so resetting it desyncs the branch's fiscal-period labeling
    from its own real current_sim_date once the parent has run past its
    first year."""
    parent_state = test_db.query(SimulationState).filter_by(timeline_id=test_timeline.id).first()
    parent_state.tick_count = 300
    test_db.commit()

    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Tick Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
    )
    test_db.commit()

    state = test_db.query(SimulationState).filter_by(timeline_id=timeline.id).first()
    assert state.tick_count == 300


def test_estimate_branch_cost(test_db, test_timeline, test_company):
    result = branch_service.estimate_branch_cost(test_db, test_timeline.id, fast_forward_days=100)
    assert result["fast_forward_days"] == 100
    assert result["company_count"] == 1
    assert result["estimated_compute_ms"] > 0


def test_estimate_branch_cost_negative_days_raises(test_db, test_timeline):
    with pytest.raises(ConflictError):
        branch_service.estimate_branch_cost(test_db, test_timeline.id, fast_forward_days=-1)


def test_extend_timeline_missing_raises(test_db):
    with pytest.raises(NotFoundError):
        branch_service.extend_timeline(test_db, 999, additional_days=1)


def test_extend_timeline_zero_days_raises(test_db, test_timeline):
    with pytest.raises(ConflictError):
        branch_service.extend_timeline(test_db, test_timeline.id, additional_days=0)


def test_archive_timeline_missing_raises(test_db):
    with pytest.raises(NotFoundError):
        branch_service.archive_timeline(test_db, 999)


def test_archive_timeline_live_raises(test_db, test_timeline):
    with pytest.raises(ConflictError):
        branch_service.archive_timeline(test_db, test_timeline.id)


def test_archive_pinned_timeline_raises(test_db, test_timeline, test_user):
    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Pinned Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
    )
    timeline.pinned = True
    test_db.commit()

    with pytest.raises(ConflictError):
        branch_service.archive_timeline(test_db, timeline.id)


def test_archive_unpinned_branch_succeeds(test_db, test_timeline, test_user):
    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Disposable Branch", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 2), rng_seed=None, primitive="manual",
    )
    test_db.commit()

    archived = branch_service.archive_timeline(test_db, timeline.id)
    assert archived.status == "archived"


def test_extend_timeline_advances_ticks(test_db, test_timeline, test_user, test_company):
    """Full round-trip: fork a branch, then extend it, and confirm its own
    PriceHistory rows accumulate without touching the parent's."""
    from apps.api.tests.test_simulation import _seed_tickable

    _seed_tickable(test_db, test_company, test_timeline)
    timeline = branch_service.create_branch(
        test_db, user_id=test_user.id, name="Extend Me", parent_id=test_timeline.id,
        branch_date=date(2026, 1, 1), rng_seed=99, primitive="manual",
    )
    test_db.commit()

    result = branch_service.extend_timeline(test_db, timeline.id, additional_days=2)
    test_db.commit()

    assert result.status == "ready"
    child_prices = test_db.query(PriceHistory).filter_by(timeline_id=timeline.id).all()
    assert len(child_prices) == 2
    parent_prices = test_db.query(PriceHistory).filter_by(timeline_id=test_timeline.id).all()
    # Parent's own PriceHistory is untouched by the child's fast-forward --
    # regression coverage for the live-data-corruption fix (Phase 1).
    assert len(parent_prices) == 1
