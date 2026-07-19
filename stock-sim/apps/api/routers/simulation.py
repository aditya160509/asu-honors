"""Simulation control — advance ticks, branch timelines, admin controls."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user, require_admin
from apps.api.config import settings
from apps.api.database import get_db
from apps.api.exceptions import NotFoundError
from apps.api.schemas import (
    AdvanceRequest,
    AdvanceResponse,
    BranchCostEstimateResponse,
    ConfigParameterResponse,
    ConfigUpdateRequest,
    DistributionResponse,
    EventInjectRequest,
    EventInstanceResponse,
    SimulationStateResponse,
    TimelineCreateRequest,
    TimelineDiffResponse,
    TimelineExtendRequest,
    TimelineGroupResponse,
    TimelineResponse,
    TimelineStatusResponse,
)
from apps.api.services import audit_service, branch_service, sim_service, timeline_group_service
from db.models import ConfigParameter, EventInstance, SimulationState, Timeline, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sim", tags=["Simulation Control"])


@router.post("/advance", response_model=AdvanceResponse)
def advance(
    request: AdvanceRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AdvanceResponse:
    try:
        result = sim_service.advance_simulation(db, request.timeline_id, request.days)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    return result


@router.get("/timelines/estimate-cost", response_model=BranchCostEstimateResponse)
def estimate_branch_cost(
    parent_timeline_id: int = Query(...),
    fast_forward_days: int = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> BranchCostEstimateResponse:
    result = branch_service.estimate_branch_cost(db, parent_timeline_id, fast_forward_days)
    return BranchCostEstimateResponse(**result)


@router.post("/timelines", response_model=TimelineResponse, status_code=status.HTTP_201_CREATED)
def create_timeline(
    request: TimelineCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Timeline:
    overrides = [
        branch_service.OverrideSpec(
            target_type=o.target_type,
            target_key=o.target_key,
            override_value=o.override_value,
            effective_from_sim_date=o.effective_from_sim_date,
            target_scope_id=o.target_scope_id,
            effective_to_sim_date=o.effective_to_sim_date,
        )
        for o in (request.overrides or [])
    ]
    timeline = branch_service.create_branch(
        db,
        user_id=user.id,
        name=request.name,
        parent_id=request.parent_timeline_id,
        branch_date=request.branch_point_sim_date,
        rng_seed=request.rng_seed,
        primitive=request.primitive,
        overrides=overrides,
    )
    audit_service.record(
        db, actor_user_id=user.id, action="create_timeline", timeline_id=timeline.id,
        after_value={"parent_timeline_id": request.parent_timeline_id, "primitive": request.primitive},
    )
    db.commit()

    # Dispatch the fast-forward job AFTER commit -- the worker opens its own
    # DB session (apps/api/tasks.py) and must see the just-created Timeline/
    # SimulationState/TimelineOverride rows, which only become visible to
    # other connections once this transaction commits.
    #
    # A prior incident: this dispatch was previously fire-and-forget with no
    # worker-liveness check. If no Celery worker was listening at dispatch
    # time (stale API process started before the worker existed, worker
    # crashed, Redis flushed), the task vanished silently and the branch was
    # left at status='pending' forever with no signal to the user that
    # anything was wrong. A cheap liveness ping before dispatch closes most
    # of that gap: if no worker responds within 1s, mark the branch 'failed'
    # immediately (a real, already-supported status -- see
    # ck_timelines_status) instead of leaving it indistinguishable from
    # "about to start."
    if request.fast_forward_days > 0:
        from apps.api.celery_app import celery_app
        from apps.api.tasks import run_fast_forward_job

        worker_alive = False
        try:
            worker_alive = bool(celery_app.control.ping(timeout=1.0))
        except Exception:
            logger.exception("Celery worker liveness ping failed for timeline %s", timeline.id)

        if worker_alive:
            run_fast_forward_job.delay(timeline.id, request.fast_forward_days)
        else:
            logger.error(
                "No Celery worker responded to liveness ping -- timeline %s fast-forward "
                "was never dispatched; marking status=failed instead of leaving it stuck pending.",
                timeline.id,
            )
            timeline.status = "failed"
            audit_service.record(
                db, actor_user_id=user.id, action="create_timeline", timeline_id=timeline.id,
                after_value={"status": "failed", "reason": "no Celery worker available at dispatch time"},
            )
            db.commit()

    return timeline


@router.get("/timelines", response_model=list[TimelineResponse])
def list_timelines(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Timeline]:
    return db.query(Timeline).filter(
        (Timeline.owner_user_id == user.id) | (Timeline.owner_user_id.is_(None))
    ).order_by(Timeline.id).all()


@router.get("/timelines/{timeline_id}/status", response_model=TimelineStatusResponse)
def get_timeline_status(
    timeline_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TimelineStatusResponse:
    result = branch_service.get_timeline_status(db, timeline_id)
    return TimelineStatusResponse(**result)


@router.get("/timelines/{timeline_id}/diff", response_model=TimelineDiffResponse)
def diff_timeline(
    timeline_id: int,
    vs: int = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TimelineDiffResponse:
    entries = branch_service.diff_timelines(db, timeline_id, vs)
    return TimelineDiffResponse(left_timeline_id=timeline_id, right_timeline_id=vs, entries=entries)


@router.post("/timelines/{timeline_id}/extend", response_model=TimelineResponse)
def extend_timeline(
    timeline_id: int,
    request: TimelineExtendRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Timeline:
    timeline = branch_service.extend_timeline(db, timeline_id, request.days)
    db.commit()
    return timeline


@router.delete("/timelines/{timeline_id}", response_model=TimelineResponse)
def delete_timeline(
    timeline_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Timeline:
    timeline = branch_service.archive_timeline(db, timeline_id)
    audit_service.record(db, actor_user_id=user.id, action="delete_timeline", timeline_id=timeline_id)
    db.commit()
    return timeline


@router.get("/timeline-groups/{group_id}", response_model=TimelineGroupResponse)
def get_timeline_group(
    group_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TimelineGroupResponse:
    group = timeline_group_service.get_group(db, group_id)
    members = timeline_group_service.get_member_timelines(db, group_id)
    return TimelineGroupResponse(
        id=group.id,
        primitive=group.primitive,
        label=group.label,
        owner_user_id=group.owner_user_id,
        created_at=group.created_at,
        member_timeline_ids=[m.id for m in members],
    )


@router.get("/timeline-groups/{group_id}/distribution", response_model=DistributionResponse)
def get_timeline_group_distribution(
    group_id: int,
    metric: str = Query(default="portfolio_return"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> DistributionResponse:
    result = timeline_group_service.compute_distribution(db, group_id, metric)
    return DistributionResponse(**result)


@router.get("/state", response_model=SimulationStateResponse)
def get_state(
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> SimulationStateResponse:
    sim_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is None:
        raise NotFoundError(f"No simulation state for timeline {timeline_id}")
    return SimulationStateResponse(
        timeline_id=sim_state.timeline_id,
        current_sim_date=sim_state.current_sim_date,
        tick_count=sim_state.tick_count,
        is_running=sim_state.is_running,
    )


@router.post("/admin/events", response_model=EventInstanceResponse, status_code=status.HTTP_201_CREATED)
def inject_event(
    request: EventInjectRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> EventInstance:
    instance = sim_service.inject_event(
        db,
        event_id=request.event_id,
        timeline_id=request.timeline_id,
        scope_type=request.scope_type,
        scope_ref=request.scope_ref,
        sim_date=request.sim_date,
        severity=request.severity_override,
    )
    db.commit()
    return instance


@router.put("/admin/config", response_model=ConfigParameterResponse)
def update_config(
    request: ConfigUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ConfigParameter:
    row = sim_service.update_config_parameter(
        db, key=request.key, value=request.value, scope=request.scope, scope_id=request.scope_id
    )
    db.commit()
    return row


@router.get("/admin/config", response_model=list[ConfigParameterResponse])
def list_config(
    scope: str = "global",
    scope_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[ConfigParameter]:
    query = db.query(ConfigParameter).filter_by(scope=scope)
    if scope_id is not None:
        query = query.filter_by(scope_id=scope_id)
    return query.all()
