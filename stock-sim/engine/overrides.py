"""Future Lab (Section 11) — pure helpers for applying timeline_overrides rows
to the tick loop.

Deliberately kept side-effect-free (no DB/session access) so these are
directly unit-testable and safe to call from parallel ensemble workers
(engine/ensemble.py) without any shared mutable state.

Structural overrides only ever target CompanyFactorScore fields and
ConfigParameter values (persisted, quarter-stable state) -- the 7 tick-loop
drivers (value_opportunity, earnings_surprise, ...) are recomputed fresh
every tick in orchestrator._compute_drivers and can't be durably "pinned."
A driver override is instead realized as an additive bias applied after the
driver's normal computation (apply_driver_bias below), matching how
apply_effect_to_drivers (engine/events.py) already layers event deltas on
top of computed values rather than replacing them.
"""

from datetime import date
from typing import Any, Optional

DRIVER_KEYS = frozenset({
    "value_opportunity", "earnings_surprise", "news_severity",
    "economic_outlook", "guidance", "technical_momentum",
    "institutional_buying",
})

# The 5 top-level CompanyFactorScore fields a factor_score override may
# target -- matches the set _apply_factor_effects_to_company (engine/
# orchestrator.py) already handles for event-driven effects, so a
# Future-Lab-authored override lands on the exact same fields a real
# MarketEvent would.
FACTOR_SCORE_KEYS = frozenset({
    "management_quality", "moat_score", "financial_quality", "fcf_quality", "growth_potential",
})


def apply_driver_bias(driver_values: dict[str, float], bias: dict[str, float]) -> dict[str, float]:
    """Add a per-driver additive bias, then clamp back to [-1, 1].

    `bias` maps driver_key -> additive delta (only keys present in
    DRIVER_KEYS are applied; anything else is ignored defensively).
    """
    if not bias:
        return driver_values
    result = dict(driver_values)
    for key, delta in bias.items():
        if key not in DRIVER_KEYS:
            continue
        result[key] = max(-1.0, min(1.0, result.get(key, 0.0) + delta))
    return result


def build_cycle_transition_override(
    target_phase: str, strength: float = 1.0,
) -> dict[str, list[tuple[str, float]]]:
    """Build a transition-matrix override that biases (strength < 1.0) or
    freezes (strength >= 1.0) every phase's transition toward `target_phase`.

    strength=1.0 means "every phase transitions to target_phase with
    probability 1" (a hard freeze -- used for the duration of a Macro Shock
    scenario). strength in (0, 1) blends the forced target_phase probability
    in alongside the phase's normal transitions, renormalized to sum to 1,
    so a partial-strength shock still allows organic phase movement, just
    biased toward the target.

    Only ever overrides *which phase is entered next* — GDP growth, interest
    rate, and market sentiment are always subsequently derived by
    compute_cycle_state() for whatever phase results, never set directly, so
    no override can produce a phase/macro combination the live engine could
    not itself produce (see engine/cycle.py::CYCLE_TRANSITIONS).
    """
    from engine.cycle import CYCLE_PHASES, CYCLE_TRANSITIONS

    strength = max(0.0, min(1.0, strength))
    overrides: dict[str, list[tuple[str, float]]] = {}
    for phase in CYCLE_PHASES:
        if strength >= 1.0:
            overrides[phase] = [(target_phase, 1.0)]
            continue
        base = dict(CYCLE_TRANSITIONS.get(phase, [(phase, 1.0)]))
        blended: dict[str, float] = {k: v * (1.0 - strength) for k, v in base.items()}
        blended[target_phase] = blended.get(target_phase, 0.0) + strength
        total = sum(blended.values())
        overrides[phase] = [(k, v / total) for k, v in blended.items()]
    return overrides


def resolve_active_overrides(
    rows: list[Any], sim_date: date,
) -> dict[str, list[Any]]:
    """Group a timeline's TimelineOverride rows by target_type, keeping only
    rows active on `sim_date` (effective_from <= sim_date and
    (effective_to is null or effective_to >= sim_date)).

    Each `row` is expected to expose target_type, target_key,
    target_scope_id, override_value, effective_from_sim_date,
    effective_to_sim_date (duck-typed against db.models.scenario_lab.TimelineOverride
    so this stays a pure function independent of the ORM).
    """
    grouped: dict[str, list[Any]] = {}
    for row in rows:
        if row.effective_from_sim_date > sim_date:
            continue
        if row.effective_to_sim_date is not None and row.effective_to_sim_date < sim_date:
            continue
        grouped.setdefault(row.target_type, []).append(row)
    return grouped


def driver_bias_by_company(
    driver_bias_rows: list[Any],
) -> dict[Optional[int], dict[str, float]]:
    """Build {target_scope_id_or_None: {driver_key: delta}} from active
    target_type='driver_bias' TimelineOverride rows. target_scope_id is a
    company id, or None for a market-wide bias applied to every company.
    target_key is the driver name; override_value is the delta, stringified
    (TimelineOverride.override_value is a String column so arbitrary target
    types can share one column)."""
    result: dict[Optional[int], dict[str, float]] = {}
    for row in driver_bias_rows:
        try:
            delta = float(row.override_value)
        except (TypeError, ValueError):
            continue
        if row.target_key not in DRIVER_KEYS:
            continue
        result.setdefault(row.target_scope_id, {})[row.target_key] = delta
    return result


def apply_config_overrides(params: dict[str, float], config_rows: list[Any]) -> dict[str, float]:
    """Layer active target_type='config' TimelineOverride rows on top of the
    global ConfigParameter dict (engine.orchestrator._load_params).

    Unlike driver_bias/factor_score (additive nudges), a config override
    REPLACES the named key's value outright -- config keys like
    theta_default or kyle_lambda_scale are absolute settings, not deltas, so
    "override_value" is the new value itself, not something added to the
    current one. target_scope_id is ignored: ConfigParameter's own
    scope/scope_id (global/industry/company) already exists for scoping;
    a timeline_overrides row of target_type='config' always means "override
    this global key for this timeline."
    """
    if not config_rows:
        return params
    result = dict(params)
    for row in config_rows:
        try:
            result[row.target_key] = float(row.override_value)
        except (TypeError, ValueError):
            continue
    return result


def factor_score_bias_by_company(
    factor_score_rows: list[Any],
) -> dict[Optional[int], dict[str, float]]:
    """Build {target_scope_id_or_None: {factor_key: delta}} from active
    target_type='factor_score' TimelineOverride rows, mirroring
    driver_bias_by_company's shape. target_scope_id is a company id, or
    None for a market-wide bias applied to every company. Applied as a flat
    additive nudge (no decay) to whichever of the 5 top-level
    CompanyFactorScore fields (FACTOR_SCORE_KEYS) target_key names --
    simpler than the EventInstance severity/decay pipeline
    (_apply_factor_effects_to_company), appropriate for a
    user-authored branch override rather than a firing news event.
    """
    result: dict[Optional[int], dict[str, float]] = {}
    for row in factor_score_rows:
        try:
            delta = float(row.override_value)
        except (TypeError, ValueError):
            continue
        if row.target_key not in FACTOR_SCORE_KEYS:
            continue
        result.setdefault(row.target_scope_id, {})[row.target_key] = delta
    return result
