"""Future Lab (Section 11) — branch/fork lifecycle: create, cost-estimate,
extend, archive.

Replaces sim_service.create_branch_timeline's broken overrides path (it
inserted ConfigParameter(scope="timeline", ...), which violates that table's
own CHECK constraint on `scope` and was marked `# pragma: no cover` --
i.e. never actually exercised). Overrides now go through the dedicated
timeline_overrides table (db/models/scenario_lab.py::TimelineOverride),
which was designed for exactly this and has no such constraint conflict.
"""

import hashlib
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import ConflictError, NotFoundError
from apps.api.services import notification_service
from db.models import (
    Company,
    CompanyFactorScore,
    FinancialQualitySubscore,
    MoatSubscore,
    SimulationState,
    Timeline,
    TimelineOverride,
)
from engine.orchestrator import run_ticks

VALID_TARGET_TYPES = frozenset({"factor_score", "config", "event", "cycle_transition", "driver_bias"})
VALID_PRIMITIVES = frozenset({
    "manual", "structural_override", "macro_shock", "sensitivity_sweep", "monte_carlo", "liquidity_scenario",
})
# Rough per-company, per-tick cost floor used for the pre-flight compute
# estimate shown in the branch wizard (Section 11.3 step 5) -- calibrated
# loosely against observed tick latency, not a hard SLA.
ESTIMATED_MS_PER_COMPANY_PER_TICK = 0.8


@dataclass(frozen=True)
class OverrideSpec:
    target_type: str
    target_key: str
    override_value: str
    effective_from_sim_date: date
    target_scope_id: Optional[int] = None
    effective_to_sim_date: Optional[date] = None


def create_branch(
    db: Session,
    user_id: Optional[int],
    name: str,
    parent_id: int,
    branch_date: date,
    rng_seed: Optional[int],
    primitive: str,
    overrides: Optional[list[OverrideSpec]] = None,
) -> Timeline:
    """Fork a new timeline from `parent_id` at `branch_date`.

    Validates the parent exists and branch_date falls within its history,
    creates the child Timeline row (status='pending' -- the caller/router is
    responsible for enqueueing the fast-forward job; this function only
    creates the row and its overrides), and inserts any requested
    TimelineOverride rows. Never fast-forwards inline.
    """
    parent = db.query(Timeline).filter_by(id=parent_id).first()
    if parent is None:
        raise NotFoundError(f"Parent timeline {parent_id} not found")

    parent_state = db.query(SimulationState).filter_by(timeline_id=parent_id).first()
    if parent_state is None:
        raise NotFoundError(f"No simulation state for parent timeline {parent_id}")

    if branch_date > parent_state.current_sim_date:
        raise ConflictError(
            f"branch_point_sim_date {branch_date} is after parent timeline's current sim date "
            f"{parent_state.current_sim_date}"
        )

    if primitive not in VALID_PRIMITIVES:
        raise ConflictError(f"Unknown primitive '{primitive}'")

    seed = rng_seed
    if seed is None:
        digest = hashlib.sha256(f"{name}-{time.time()}".encode("utf-8")).hexdigest()
        seed = int(digest[:8], 16)

    timeline = Timeline(
        name=name,
        parent_timeline_id=parent_id,
        branch_point_sim_date=branch_date,
        owner_user_id=user_id,
        rng_seed=seed,
        is_live=False,
        primitive=primitive,
        status="pending",
        last_touched_at=datetime.now(timezone.utc),
    )
    db.add(timeline)
    db.flush()

    # New timeline starts frozen at the branch point -- the caller enqueues
    # the fast-forward job (Phase 4) to advance it from here. tick_count is
    # inherited from the parent (not reset to 0): _compute_fiscal_period
    # (engine/orchestrator.py) treats tick_count as an absolute day-count
    # since a single global epoch shared by every timeline, so a branch
    # forked after its parent's first year must keep the parent's count or
    # its fiscal-period labeling (and quarter-boundary cadence) desyncs from
    # its own real current_sim_date.
    new_state = SimulationState(
        timeline_id=timeline.id,
        current_sim_date=branch_date,
        tick_count=parent_state.tick_count,
        is_running=False,
    )
    db.add(new_state)

    # MoatSubscore/FinancialQualitySubscore are timeline-scoped tables that
    # only ever get rows via db/seeds/seed_companies.py (live timeline) or
    # event write-back (engine/orchestrator.py's _apply_factor_effects_to_
    # company). A freshly created branch has neither, so
    # _refresh_fundamentals's moat_composite/financial_quality_composite
    # calls saw an empty subscore dict for every company on the branch's
    # first fast-forwarded quarter -- moat_composite crashed outright with
    # ZeroDivisionError (see engine/scoring.py), and financial_quality_
    # composite silently zeroed out FQ instead. Cloning the parent's rows
    # onto the child's timeline_id at fork time gives the branch the same
    # starting subscore state as its parent, exactly like SimulationState
    # above.
    for ms in db.query(MoatSubscore).filter_by(timeline_id=parent_id).all():
        db.add(MoatSubscore(
            company_id=ms.company_id,
            timeline_id=timeline.id,
            subfactor_key=ms.subfactor_key,
            score=ms.score,
            score_base=ms.score_base,
        ))
    for fqs in db.query(FinancialQualitySubscore).filter_by(timeline_id=parent_id).all():
        db.add(FinancialQualitySubscore(
            company_id=fqs.company_id,
            timeline_id=timeline.id,
            fiscal_period=fqs.fiscal_period,
            subfactor_key=fqs.subfactor_key,
            raw_metric_value=fqs.raw_metric_value,
            peer_percentile=fqs.peer_percentile,
            subscore=fqs.subscore,
            applied_weight=fqs.applied_weight,
        ))

    # CompanyFactorScore is also timeline-scoped (migration 0015) and is what
    # engine/orchestrator.py actually reads for growth_potential/moat_score/
    # financial_quality on every tick (_load_tick_state's latest_cfs,
    # _refresh_fundamentals's latest_cfs_by_company). Without cloning it here,
    # a fresh branch has zero rows until its own first quarter boundary (up
    # to 63 ticks away): growth_potential silently falls back to a flat 50.0
    # for every company, and any factor_score-type TimelineOverride has no
    # row to apply itself against, so it silently no-ops the whole time.
    for cfs in db.query(CompanyFactorScore).filter_by(timeline_id=parent_id).all():
        db.add(CompanyFactorScore(
            company_id=cfs.company_id,
            timeline_id=timeline.id,
            fiscal_period=cfs.fiscal_period,
            management_quality=cfs.management_quality,
            moat_score=cfs.moat_score,
            financial_quality=cfs.financial_quality,
            fcf_quality=cfs.fcf_quality,
            growth_potential=cfs.growth_potential,
            intrinsic_score=cfs.intrinsic_score,
            fair_pe=cfs.fair_pe,
            intrinsic_value=cfs.intrinsic_value,
            computed_at=cfs.computed_at,
            management_quality_base=cfs.management_quality_base,
            growth_potential_base=cfs.growth_potential_base,
            fcf_quality_base=cfs.fcf_quality_base,
            moat_score_base=cfs.moat_score_base,
            financial_quality_base=cfs.financial_quality_base,
        ))

    for spec in overrides or []:
        if spec.target_type not in VALID_TARGET_TYPES:
            raise ConflictError(f"Unknown override target_type '{spec.target_type}'")
        db.add(TimelineOverride(
            timeline_id=timeline.id,
            target_type=spec.target_type,
            target_key=spec.target_key,
            target_scope_id=spec.target_scope_id,
            override_value=spec.override_value,
            effective_from_sim_date=spec.effective_from_sim_date,
            effective_to_sim_date=spec.effective_to_sim_date,
        ))

    db.flush()
    return timeline


def estimate_branch_cost(db: Session, parent_id: int, fast_forward_days: int) -> dict:
    """Cheap pre-flight cost estimate surfaced in the wizard's confirm step
    (Section 11.3 step 5) before the user commits to a potentially expensive
    fast-forward or ensemble run.
    """
    if fast_forward_days < 0:
        raise ConflictError("fast_forward_days must be >= 0")
    company_count = db.query(Company).count()
    estimated_compute_ms = int(fast_forward_days * company_count * ESTIMATED_MS_PER_COMPANY_PER_TICK)
    return {
        "fast_forward_days": fast_forward_days,
        "company_count": company_count,
        "estimated_compute_ms": estimated_compute_ms,
    }


def extend_timeline(db: Session, timeline_id: int, additional_days: int) -> Timeline:
    """Fast-forward an existing (already-created) branch by `additional_days`
    more ticks. Runs synchronously in this v1 -- see Phase 4 for the
    Celery-backed async wrapper that calls this from a worker task."""
    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    if additional_days <= 0:
        raise ConflictError("additional_days must be > 0")

    timeline.status = "running"
    db.flush()
    try:
        run_ticks(db, timeline_id, num_ticks=additional_days)
        notification_service.evaluate_price_alerts(db, timeline_id)
        notification_service.evaluate_watchlist_movers(db, timeline_id)
    except Exception:
        timeline.status = "failed"
        db.flush()
        raise
    timeline.status = "ready"
    timeline.last_touched_at = datetime.now(timezone.utc)
    notification_service.notify_branch_ready(db, timeline)
    db.flush()
    return timeline


def archive_timeline(db: Session, timeline_id: int) -> Timeline:
    """Soft-delete: mark a timeline archived. Respects `pinned` -- a pinned
    timeline must be explicitly unpinned first (Section 11.8 retention)."""
    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    if timeline.pinned:
        raise ConflictError(f"Timeline {timeline_id} is pinned -- unpin before archiving")
    if timeline.is_live:
        raise ConflictError("Cannot archive the live timeline")

    timeline.status = "archived"
    db.flush()
    return timeline


def get_timeline_status(db: Session, timeline_id: int) -> dict:
    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    return {
        "id": timeline.id,
        "status": timeline.status,
        "current_sim_date": state.current_sim_date if state else None,
        "tick_count": state.tick_count if state else None,
        "last_touched_at": timeline.last_touched_at,
    }


def diff_timelines(db: Session, left_id: int, right_id: int) -> list[dict]:
    """Structural diff (Section 11.5): every TimelineOverride that differs
    between two timelines, keyed by (target_type, target_key,
    target_scope_id). Only compares each timeline's OWN override rows (not
    inherited ones from ancestors) -- the diff is meant to answer "what did
    the user explicitly change on this branch," not "what's different about
    its resolved state," which would require replaying both timelines'
    full override-resolution logic (engine/overrides.py) for every sim_date.
    """
    left = db.query(Timeline).filter_by(id=left_id).first()
    if left is None:
        raise NotFoundError(f"Timeline {left_id} not found")
    right = db.query(Timeline).filter_by(id=right_id).first()
    if right is None:
        raise NotFoundError(f"Timeline {right_id} not found")

    left_rows = {
        (o.target_type, o.target_key, o.target_scope_id): o.override_value
        for o in db.query(TimelineOverride).filter_by(timeline_id=left_id).all()
    }
    right_rows = {
        (o.target_type, o.target_key, o.target_scope_id): o.override_value
        for o in db.query(TimelineOverride).filter_by(timeline_id=right_id).all()
    }

    entries = []
    for key in sorted(set(left_rows) | set(right_rows)):
        lv = left_rows.get(key)
        rv = right_rows.get(key)
        if lv == rv:
            continue
        target_type, target_key, target_scope_id = key
        entries.append({
            "target_type": target_type,
            "target_key": target_key,
            "target_scope_id": target_scope_id,
            "left_value": lv,
            "right_value": rv,
        })
    return entries
