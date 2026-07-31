"""Simulation control — advance ticks, branch timelines, admin controls."""

import csv
import io
import json
import logging
from typing import Optional

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user, require_admin
from apps.api.config import settings
from apps.api.database import get_db
from apps.api.response_cache import response_cache
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
    EnsembleCreateRequest,
    EnsembleCreateResponse,
    TimelineDiffResponse,
    TimelineExtendRequest,
    TimelineRenameRequest,
    TimelineGroupResponse,
    TimelineResponse,
    TimelineStatusResponse,
)
from apps.api.services import audit_service, branch_service, notification_service, result_service, sim_service, timeline_group_service
from db.models import AuditLog, Company, ConfigParameter, EventInstance, PriceDriverScore, PriceHistory, SimulationState, Timeline, TimelineOverride, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sim", tags=["Simulation Control"])


@router.post("/advance", response_model=AdvanceResponse)
def advance(
    request: AdvanceRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AdvanceResponse:
    try:
        if request.mode == "bulk":
            result = sim_service.bulk_advance_simulation(db, request.timeline_id, request.days)
        else:
            result = sim_service.advance_simulation(db, request.timeline_id, request.days)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.commit()
    response_cache.invalidate_timeline(request.timeline_id)

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
            target_scope_type=o.target_scope_type,
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
    timeline.requested_ticks = request.fast_forward_days
    db.commit()

    # Dispatch the fast-forward job AFTER commit -- the worker opens its own
    # DB session (apps/api/tasks.py) and must see the just-created Timeline/
    # SimulationState/TimelineOverride rows, which only become visible to
    # other connections once this transaction commits.
    #
    # Guard the executor so a partially-started API process cannot leave a
    # branch pending forever when no execution path exists.
    if request.fast_forward_days > 0:
        from apps.api import background_jobs
        from apps.api.tasks import run_fast_forward_job

        if background_jobs.available():
            background_jobs.submit(f"timeline-{timeline.id}", run_fast_forward_job,
                                   timeline.id, request.fast_forward_days)
        else:
            logger.error(
                "The in-process worker is unavailable -- timeline %s fast-forward "
                "was never dispatched; marking status=failed instead of leaving it stuck pending.",
                timeline.id,
            )
            timeline.status = "failed"
            notification_service.notify_branch_failed(
                db, timeline, error="background worker unavailable at dispatch time",
            )
            audit_service.record(
                db, actor_user_id=user.id, action="create_timeline", timeline_id=timeline.id,
                after_value={"status": "failed", "reason": "background worker unavailable at dispatch time"},
            )
            db.commit()

    return timeline


@router.get("/timelines/{timeline_id}/analytics")
def get_timeline_analytics(
    timeline_id: int,
    compare_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> dict:
    return response_cache.get_or_create(
        ("timeline-analytics", timeline_id, compare_id),
        10.0,
        lambda: result_service.build_timeline_analytics(db, timeline_id, compare_id),
    )


@router.post("/timeline-groups", response_model=EnsembleCreateResponse, status_code=status.HTTP_201_CREATED)
def create_timeline_group(
    request: EnsembleCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EnsembleCreateResponse:
    """Create and dispatch a real sensitivity/Monte Carlo ensemble.

    Members are committed before background dispatch so jobs can see every
    cloned state row. If no worker is available, the whole request fails
    before dispatch rather than leaving a group permanently pending.
    """
    from apps.api import background_jobs
    from apps.api.tasks import run_ensemble_member_job

    if not background_jobs.available():
        raise HTTPException(status_code=503, detail="The background worker is unavailable")
    try:
        group, members = branch_service.create_ensemble(db, user.id, request)
        for member in members:
            member.requested_ticks = request.fast_forward_days
        audit_service.record(db, actor_user_id=user.id, action="create_timeline_group", timeline_id=None,
                             after_value={"group_id": group.id, "primitive": group.primitive, "members": len(members)})
        db.commit()
    except Exception:
        db.rollback()
        raise
    for member in members:
        background_jobs.submit(f"timeline-{member.id}", run_ensemble_member_job,
                               member.id, request.fast_forward_days)
    return EnsembleCreateResponse(
        group=TimelineGroupResponse(id=group.id, primitive=group.primitive, label=group.label,
                                    owner_user_id=group.owner_user_id, created_at=group.created_at,
                                    member_timeline_ids=[m.id for m in members]),
        timelines=members,
    )


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


@router.get("/timelines/{timeline_id}/progress")
async def stream_timeline_progress(
    timeline_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Stream persisted run progress until the branch reaches a terminal state."""
    async def events():
        while True:
            db.expire_all()
            payload = branch_service.get_timeline_status(db, timeline_id)
            yield f"event: progress\ndata: {json.dumps(payload, default=str)}\n\n"
            if payload["status"] in {"ready", "failed", "archived"}:
                break
            await asyncio.sleep(1)

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
    })


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
    user: User = Depends(get_current_user),
) -> Timeline:
    try:
        timeline = branch_service.extend_timeline(db, timeline_id, request.days)
    except HTTPException:
        # NotFoundError/ConflictError are raised before extend_timeline ever
        # touches timeline.status -- nothing to persist, just propagate as-is.
        raise
    except Exception as exc:
        # branch_service.extend_timeline flips timeline.status = "failed" and
        # flushes (not commits) that change before re-raising. get_db's
        # rollback-on-unhandled-exception would otherwise discard the flushed
        # flip along with the partial simulation writes -- the same incident
        # apps/api/tasks.py's run_fast_forward_job was fixed to avoid for the
        # async path, but this synchronous route hits the identical failure
        # mode. Roll back the bad writes, then persist just the status flip +
        # audit log + notification as their own transaction before re-raising.
        db.rollback()
        timeline_row = db.query(Timeline).filter_by(id=timeline_id).first()
        if timeline_row is not None:
            timeline_row.status = "failed"
            notification_service.notify_branch_failed(db, timeline_row, error=str(exc))
        audit_service.record(
            db, actor_user_id=user.id, action="create_timeline", timeline_id=timeline_id,
            after_value={"status": "failed"},
        )
        db.commit()
        raise
    db.commit()
    return timeline


@router.patch("/timelines/{timeline_id}", response_model=TimelineResponse)
def rename_timeline(
    timeline_id: int,
    request: TimelineRenameRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Timeline:
    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    if timeline.is_live:
        raise HTTPException(status_code=409, detail="The live timeline cannot be renamed")
    timeline.name = request.name
    audit_service.record(db, actor_user_id=user.id, action="rename_timeline", timeline_id=timeline.id,
                         after_value={"name": timeline.name})
    db.commit()
    return timeline


@router.post("/timelines/{timeline_id}/duplicate", response_model=TimelineResponse, status_code=status.HTTP_201_CREATED)
def duplicate_timeline(
    timeline_id: int,
    request: TimelineRenameRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Timeline:
    source = db.query(Timeline).filter_by(id=timeline_id).first()
    if source is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    source_state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if source_state is None:
        raise NotFoundError(f"No simulation state for timeline {timeline_id}")
    overrides = [branch_service.OverrideSpec(
        target_type=o.target_type, target_key=o.target_key, override_value=o.override_value,
        effective_from_sim_date=o.effective_from_sim_date, target_scope_id=o.target_scope_id,
        effective_to_sim_date=o.effective_to_sim_date,
        target_scope_type=o.target_scope_type,
    ) for o in db.query(TimelineOverride).filter_by(timeline_id=timeline_id).all()]
    try:
        duplicate = branch_service.create_branch(
            db, user_id=user.id, name=request.name, parent_id=source.id,
            branch_date=source_state.current_sim_date,
            rng_seed=source.rng_seed, primitive=source.primitive or "manual", overrides=overrides,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return duplicate


@router.get("/timelines/{timeline_id}/export")
def export_timeline(
    timeline_id: int,
    format: str = Query(default="json", pattern="^(json|csv|pdf)$"),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Response:
    """Export persisted experiment observations; never recomputes results."""
    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    companies = {c.id: c.ticker for c in db.query(Company).order_by(Company.id).all()}
    prices = db.query(PriceHistory).filter_by(timeline_id=timeline_id).order_by(PriceHistory.sim_date, PriceHistory.company_id).all()
    rows = [{"ticker": companies.get(row.company_id, str(row.company_id)), "sim_date": str(row.sim_date), "open": float(row.open), "high": float(row.high), "low": float(row.low), "close": float(row.close), "volume": int(row.volume), "intrinsic_value": float(row.intrinsic_value), "order_imbalance": float(row.order_imbalance)} for row in prices]
    driver_rows = [{"ticker": companies.get(row.company_id, str(row.company_id)), "sim_date": str(row.sim_date), "driver_key": row.driver_key, "value": float(row.value), "weight": float(row.weight), "contribution": float(row.contribution)} for row in db.query(PriceDriverScore).filter_by(timeline_id=timeline_id).order_by(PriceDriverScore.sim_date, PriceDriverScore.company_id, PriceDriverScore.driver_key).all()]
    override_rows = [{"target_type": row.target_type, "target_key": row.target_key, "target_scope_type": row.target_scope_type, "target_scope_id": row.target_scope_id, "override_value": row.override_value, "effective_from": str(row.effective_from_sim_date), "effective_to": str(row.effective_to_sim_date) if row.effective_to_sim_date else None} for row in db.query(TimelineOverride).filter_by(timeline_id=timeline_id).order_by(TimelineOverride.id).all()]
    audit_rows = [{"action": row.action, "before": row.before_value, "after": row.after_value, "created_at": str(row.created_at)} for row in db.query(AuditLog).filter_by(timeline_id=timeline_id).order_by(AuditLog.id).all()]
    payload = {"timeline": {"id": timeline.id, "name": timeline.name, "primitive": timeline.primitive, "status": timeline.status}, "state": {"current_sim_date": str(state.current_sim_date) if state else None, "tick_count": state.tick_count if state else None}, "price_history": rows, "factor_history": driver_rows, "overrides": override_rows, "audit_trail": audit_rows}
    if format == "json":
        return Response(content=json.dumps(payload), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="future-lab-{timeline_id}.json"'})
    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["ticker", "sim_date", "open", "high", "low", "close", "volume", "intrinsic_value", "order_imbalance"])
        writer.writeheader(); writer.writerows(rows)
        return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="future-lab-{timeline_id}.csv"'})
    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib import colors
        buf = io.BytesIO(); doc = SimpleDocTemplate(buf, pagesize=LETTER); styles = getSampleStyleSheet()
        story = [Paragraph(f"Future Lab — {timeline.name}", styles["Title"]), Paragraph(f"Timeline {timeline.id} · {timeline.status} · {timeline.primitive or 'manual'}", styles["Normal"]), Spacer(1, 12)]
        story.append(Paragraph(f"Companies: {len(companies)} · Simulated date: {state.current_sim_date if state else '—'} · Ticks: {state.tick_count if state else '—'} · Overrides: {len(override_rows)}", styles["Normal"])); story.append(Spacer(1, 12))
        table_rows = [["Ticker", "Date", "Open", "High", "Low", "Close", "Volume", "Intrinsic"]] + [[r["ticker"], r["sim_date"], f'{r["open"]:.2f}', f'{r["high"]:.2f}', f'{r["low"]:.2f}', f'{r["close"]:.2f}', f'{r["volume"]:,}', f'{r["intrinsic_value"]:.2f}'] for r in rows[-100:]]
        table = Table(table_rows, repeatRows=1); table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1a1f2e")), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("FONTSIZE", (0,0), (-1,-1), 7), ("GRID", (0,0), (-1,-1), .25, colors.lightgrey)])); story.append(table); doc.build(story)
        return Response(content=buf.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="future-lab-{timeline_id}.pdf"'})
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="PDF export dependency is unavailable") from exc


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
    metric: str = Query(default="portfolio_value"),
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
