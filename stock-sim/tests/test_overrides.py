"""Unit tests for engine/overrides.py -- pure Future Lab override helpers."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

import pytest

from engine.overrides import (
    apply_config_overrides,
    apply_driver_bias,
    build_cycle_transition_override,
    driver_bias_by_company,
    factor_score_bias_by_company,
    resolve_active_overrides,
)


@dataclass
class _FakeOverrideRow:
    target_type: str
    target_key: str
    override_value: str
    effective_from_sim_date: date
    effective_to_sim_date: Optional[date] = None
    target_scope_id: Optional[int] = None


# ── apply_driver_bias ───────────────────────────────────────────────────


def test_apply_driver_bias_adds_delta():
    result = apply_driver_bias({"guidance": 0.1}, {"guidance": 0.2})
    assert result["guidance"] == pytest.approx(0.3)


def test_apply_driver_bias_clamps_to_range():
    result = apply_driver_bias({"guidance": 0.9}, {"guidance": 0.5})
    assert result["guidance"] == 1.0
    result2 = apply_driver_bias({"guidance": -0.9}, {"guidance": -0.5})
    assert result2["guidance"] == -1.0


def test_apply_driver_bias_ignores_unknown_keys():
    result = apply_driver_bias({"guidance": 0.1}, {"not_a_real_driver": 5.0})
    assert "not_a_real_driver" not in result
    assert result["guidance"] == 0.1


def test_apply_driver_bias_no_bias_returns_original():
    original = {"guidance": 0.1}
    assert apply_driver_bias(original, {}) is original


# ── build_cycle_transition_override ─────────────────────────────────────


def test_build_cycle_transition_override_full_strength_freezes_every_phase():
    overrides = build_cycle_transition_override("contraction", strength=1.0)
    for phase in ("expansion", "peak", "contraction", "trough"):
        assert overrides[phase] == [("contraction", 1.0)]


def test_build_cycle_transition_override_partial_strength_blends():
    overrides = build_cycle_transition_override("contraction", strength=0.5)
    expansion_transitions = dict(overrides["expansion"])
    # contraction's probability should be boosted relative to the organic
    # transition matrix, but not to a full 1.0 (still partial strength).
    assert 0.0 < expansion_transitions["contraction"] < 1.0
    assert sum(expansion_transitions.values()) == pytest.approx(1.0)


def test_build_cycle_transition_override_never_mutates_module_state():
    """Regression: must never mutate engine.cycle.CYCLE_TRANSITIONS, since
    that would corrupt every other timeline/ensemble member's organic
    transitions (see the function's own docstring)."""
    from engine.cycle import CYCLE_TRANSITIONS

    before = {k: list(v) for k, v in CYCLE_TRANSITIONS.items()}
    build_cycle_transition_override("trough", strength=1.0)
    after = {k: list(v) for k, v in CYCLE_TRANSITIONS.items()}
    assert before == after


# ── resolve_active_overrides ─────────────────────────────────────────────


def test_resolve_active_overrides_groups_by_target_type():
    rows = [
        _FakeOverrideRow("config", "theta_default", "0.08", date(2026, 1, 1)),
        _FakeOverrideRow("driver_bias", "guidance", "-0.2", date(2026, 1, 1)),
    ]
    grouped = resolve_active_overrides(rows, date(2026, 1, 5))
    assert len(grouped["config"]) == 1
    assert len(grouped["driver_bias"]) == 1


def test_resolve_active_overrides_excludes_future_rows():
    rows = [_FakeOverrideRow("config", "theta_default", "0.08", date(2026, 6, 1))]
    grouped = resolve_active_overrides(rows, date(2026, 1, 5))
    assert grouped == {}


def test_resolve_active_overrides_excludes_expired_rows():
    rows = [
        _FakeOverrideRow(
            "cycle_transition", "contraction", "1.0",
            date(2026, 1, 1), effective_to_sim_date=date(2026, 1, 10),
        )
    ]
    grouped = resolve_active_overrides(rows, date(2026, 2, 1))
    assert grouped == {}


def test_resolve_active_overrides_includes_row_with_no_end_date():
    rows = [_FakeOverrideRow("config", "theta_default", "0.08", date(2026, 1, 1), effective_to_sim_date=None)]
    grouped = resolve_active_overrides(rows, date(2027, 1, 1))
    assert len(grouped["config"]) == 1


# ── driver_bias_by_company ───────────────────────────────────────────────


def test_driver_bias_by_company_market_wide_uses_none_key():
    rows = [_FakeOverrideRow("driver_bias", "technical_momentum", "-0.3", date(2026, 1, 1), target_scope_id=None)]
    result = driver_bias_by_company(rows)
    assert result[None]["technical_momentum"] == pytest.approx(-0.3)


def test_driver_bias_by_company_scoped_to_one_company():
    rows = [_FakeOverrideRow("driver_bias", "guidance", "0.5", date(2026, 1, 1), target_scope_id=42)]
    result = driver_bias_by_company(rows)
    assert result[42]["guidance"] == pytest.approx(0.5)
    assert None not in result


def test_driver_bias_by_company_ignores_invalid_key():
    rows = [_FakeOverrideRow("driver_bias", "not_a_driver", "0.5", date(2026, 1, 1))]
    assert driver_bias_by_company(rows) == {}


def test_driver_bias_by_company_ignores_non_numeric_value():
    rows = [_FakeOverrideRow("driver_bias", "guidance", "not_a_number", date(2026, 1, 1))]
    assert driver_bias_by_company(rows) == {}


# ── apply_config_overrides ───────────────────────────────────────────────


def test_apply_config_overrides_replaces_value():
    rows = [_FakeOverrideRow("config", "theta_default", "0.08", date(2026, 1, 1))]
    result = apply_config_overrides({"theta_default": 0.05, "r_cap": 0.2}, rows)
    assert result["theta_default"] == pytest.approx(0.08)
    assert result["r_cap"] == pytest.approx(0.2)  # untouched keys survive


def test_apply_config_overrides_adds_new_key():
    rows = [_FakeOverrideRow("config", "kyle_lambda_scale", "0.0005", date(2026, 1, 1))]
    result = apply_config_overrides({}, rows)
    assert result["kyle_lambda_scale"] == pytest.approx(0.0005)


def test_apply_config_overrides_no_rows_returns_same_dict():
    params = {"theta_default": 0.05}
    assert apply_config_overrides(params, []) is params


def test_apply_config_overrides_ignores_non_numeric_value():
    rows = [_FakeOverrideRow("config", "theta_default", "not_a_number", date(2026, 1, 1))]
    result = apply_config_overrides({"theta_default": 0.05}, rows)
    assert result["theta_default"] == pytest.approx(0.05)


# ── factor_score_bias_by_company ─────────────────────────────────────────


def test_factor_score_bias_by_company_scoped():
    rows = [_FakeOverrideRow("factor_score", "financial_quality", "-15", date(2026, 1, 1), target_scope_id=7)]
    result = factor_score_bias_by_company(rows)
    assert result[7]["financial_quality"] == pytest.approx(-15.0)


def test_factor_score_bias_by_company_market_wide():
    rows = [_FakeOverrideRow("factor_score", "moat_score", "5", date(2026, 1, 1), target_scope_id=None)]
    result = factor_score_bias_by_company(rows)
    assert result[None]["moat_score"] == pytest.approx(5.0)


def test_factor_score_bias_by_company_ignores_invalid_key():
    rows = [_FakeOverrideRow("factor_score", "not_a_real_factor", "5", date(2026, 1, 1))]
    assert factor_score_bias_by_company(rows) == {}


def test_factor_score_bias_by_company_ignores_non_numeric_value():
    rows = [_FakeOverrideRow("factor_score", "moat_score", "not_a_number", date(2026, 1, 1))]
    assert factor_score_bias_by_company(rows) == {}
