"""Simulation control — advance ticks, branch timelines, admin controls."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user, require_admin
from apps.api.database import get_db
from apps.api.exceptions import NotFoundError
from apps.api.schemas import (
    AdvanceRequest,
    AdvanceResponse,
    ConfigParameterResponse,
    ConfigUpdateRequest,
    EventInjectRequest,
    EventInstanceResponse,
    SimulationStateResponse,
    TimelineCreateRequest,
    TimelineResponse,
)
from apps.api.services import sim_service
from db.models import ConfigParameter, EventInstance, SimulationState, Timeline, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sim", tags=["Simulation Control"])


@router.post("/advance", response_model=AdvanceResponse)
def advance(
    request: AdvanceRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AdvanceResponse:
    result = sim_service.advance_simulation(db, request.timeline_id, request.days)
    db.commit()
    return result


@router.post("/timelines", response_model=TimelineResponse, status_code=status.HTTP_201_CREATED)
def create_timeline(
    request: TimelineCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Timeline:
    timeline = sim_service.create_branch_timeline(
        db,
        user_id=user.id,
        name=request.name,
        parent_id=request.parent_timeline_id,
        branch_date=request.branch_point_sim_date,
        rng_seed=request.rng_seed,
        overrides=request.scenario_overrides,
    )
    db.commit()
    return timeline


@router.get("/timelines", response_model=list[TimelineResponse])
def list_timelines(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[Timeline]:
    return db.query(Timeline).order_by(Timeline.id).all()


@router.get("/state", response_model=SimulationStateResponse)
def get_state(
    timeline_id: int = 1,
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
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[ConfigParameter]:
    return db.query(ConfigParameter).filter_by(scope=scope).all()
