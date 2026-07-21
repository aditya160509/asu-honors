"""Simulation control: advance ticks, timeline branching, admin operations."""

import logging
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from apps.api.schemas import AdvanceResponse
from apps.api.services import notification_service
from apps.api.services.trade_service import check_and_fill_limit_orders
from db.models import ConfigParameter, EventInstance, MarketEvent, SimulationState, Timeline
from engine.orchestrator import run_ticks

logger = logging.getLogger(__name__)


def advance_simulation(db: Session, timeline_id: int, days: int) -> AdvanceResponse:
    """Advance the simulation by `days` ticks and summarize the outcome.

    engine.orchestrator.run_ticks returns a list of per-tick result dicts. Each
    dict is either {"status": "completed", "sim_date", "next_date", "tick_count",
    ...} or {"status": "skipped", "reason": "already_executed", "sim_date"} for
    an idempotent no-op. Only completed ticks count toward ticks_executed.
    """
    results = run_ticks(db, timeline_id, num_ticks=days)

    ticks_executed = sum(1 for r in results if r.get("status") == "completed")
    last = results[-1] if results else {}

    # Trading Desk (Phase 3): check open limit orders against the end-of-advance
    # price once per advance call — not against every intermediate day of a
    # multi-day advance (see trade_service.check_and_fill_limit_orders docstring).
    # Notifications (price alerts / watchlist movers) follow the same cadence.
    if ticks_executed > 0:
        check_and_fill_limit_orders(db, timeline_id)
        notification_service.evaluate_price_alerts(db, timeline_id)
        notification_service.evaluate_watchlist_movers(db, timeline_id)

    sim_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is not None:
        new_sim_date = sim_state.current_sim_date
        tick_count = sim_state.tick_count
    else:
        new_sim_date = last.get("next_date") or last.get("sim_date") or date.today()  # pragma: no cover — run_ticks always creates sim_state
        tick_count = last.get("tick_count", 0)  # pragma: no cover

    cycle_phase = last.get("cycle_phase")

    return AdvanceResponse(
        ticks_executed=ticks_executed,
        new_sim_date=new_sim_date,
        tick_count=tick_count,
        cycle_phase=cycle_phase,
    )


def create_branch_timeline(
    db: Session,
    user_id: Optional[int],
    name: str,
    parent_id: int,
    branch_date: date,
    rng_seed: Optional[int],
    overrides: Optional[dict] = None,
) -> Timeline:
    """Deprecated thin wrapper — delegates to branch_service.create_branch.

    Retained for backward compatibility with any existing caller passing the
    old untyped `overrides: dict` shape; new code should call
    branch_service.create_branch directly with typed OverrideSpec rows via
    the /api/v1/sim/timelines router. The old `overrides["config_overrides"]`
    path this used to implement was never actually reachable (it inserted
    ConfigParameter(scope="timeline", ...), which violates that table's own
    CHECK constraint on `scope`) -- overrides are silently ignored here now
    rather than raising, since no caller ever successfully exercised that
    path in the first place.
    """
    from apps.api.services.branch_service import create_branch

    return create_branch(
        db, user_id=user_id, name=name, parent_id=parent_id, branch_date=branch_date,
        rng_seed=rng_seed, primitive="manual", overrides=None,
    )


def inject_event(
    db: Session,
    event_id: int,
    timeline_id: int,
    scope_type: str,
    scope_ref: int,
    sim_date: Optional[date],
    severity: Optional[float],
) -> EventInstance:
    """Create an EventInstance row with an optional severity override."""
    event = db.query(MarketEvent).filter_by(id=event_id).first()
    if event is None:
        raise NotFoundError(f"MarketEvent {event_id} not found")

    sim_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    effective_date = sim_date or (sim_state.current_sim_date if sim_state else date.today())
    resolved_severity = severity if severity is not None else 0.5
    expires_on = effective_date.replace() if event.duration_days == 0 else _add_days(effective_date, event.duration_days)

    instance = EventInstance(
        event_id=event_id,
        timeline_id=timeline_id,
        scope_ref=scope_ref,
        scope_type=scope_type,
        sim_date=effective_date,
        resolved_severity=resolved_severity,
        applied_effects=event.effect_profile,
        expires_on=expires_on,
    )
    db.add(instance)
    db.flush()
    return instance


def _add_days(d: date, days: int) -> date:
    return d + timedelta(days=days)


def update_config_parameter(
    db: Session,
    key: str,
    value: str,
    scope: str,
    scope_id: Optional[int],
) -> ConfigParameter:
    """Upsert a ConfigParameter row keyed by (key, scope, scope_id)."""
    row = db.query(ConfigParameter).filter_by(key=key, scope=scope, scope_id=scope_id).first()
    if row is None:
        row = ConfigParameter(key=key, value=value, scope=scope, scope_id=scope_id)
        db.add(row)
    else:
        row.value = value
    db.flush()
    return row
