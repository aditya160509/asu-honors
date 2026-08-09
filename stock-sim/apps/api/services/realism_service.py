"""Persistence and orchestration for market-realism observations."""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from db.models import (
    Company,
    CorporateAction,
    EconomicCalendarEvent,
    InstitutionalFlow,
    Holding,
    MarketMicroTick,
    MarketNewsBulletin,
    MarketRegimeState,
    MarketSessionState,
    Portfolio,
    PriceHistory,
    ReplayLedger,
    SimulationProfile,
    Timeline,
    TimelineCompanyState,
)
from db.timeline_resolver import get_latest_price
from engine.realism import (
    CorporateAction as CorporateActionSpec,
    EconomicEventType,
    FundamentalState,
    MarketRegime,
    SessionPhase,
    apply_corporate_action,
    build_order_book,
    classify_regime,
    economic_event_impact,
    evaluate_guardrails,
    evolve_fundamentals,
    generate_flows,
    get_preset,
    next_business_date,
    realism_news,
    replay_fingerprint,
    regime_parameters,
    session_timestamp,
    session_windows,
    slippage_bps,
    stable_seed,
)


DEFAULT_FUNDAMENTAL_STATE = {
    "revenue_growth": 0.05,
    "operating_margin": 0.18,
    "earnings_growth": 0.08,
    "leverage": 1.0,
    "quality_score": 60.0,
}


def get_or_create_profile(
    db: Session,
    timeline_id: int,
    preset: Optional[str] = None,
) -> SimulationProfile:
    """Load a timeline profile, creating the replay contract on first use."""

    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    profile = db.query(SimulationProfile).filter_by(timeline_id=timeline_id).first()
    if profile is not None:
        if preset is not None and profile.preset != preset:
            raise ValueError("A timeline's realism preset is immutable; create a branch to change it")
        return profile

    resolved = get_preset(preset or "realistic")
    profile = SimulationProfile(
        timeline_id=timeline_id,
        preset=resolved.name,
        timezone_name="America/New_York",
        micro_ticks_per_session=resolved.micro_ticks_per_session,
        seed=int(timeline.rng_seed),
        version=1,
        parameters={
            # Existing timelines have a golden-master price path.  Keep their
            # legacy OU price inputs stable until an admin explicitly selects
            # a realism profile; quote/depth/flow/replay observations are still
            # recorded immediately.
            "legacy_pricing": True,
            "base_spread_bps": resolved.base_spread_bps,
            "depth_levels": resolved.depth_levels,
            "max_participation_rate": resolved.max_participation_rate,
            "market_impact_scale": resolved.market_impact_scale,
            "circuit_breaker_pct": resolved.circuit_breaker_pct,
            "volatility_pause_pct": resolved.volatility_pause_pct,
        },
    )
    db.add(profile)
    db.flush()
    _ensure_timeline_company_states(db, timeline_id)
    return profile


def set_profile(db: Session, timeline_id: int, preset: str) -> SimulationProfile:
    """Version an explicitly selected realism profile for a timeline."""

    resolved = get_preset(preset)
    profile = get_or_create_profile(db, timeline_id)
    profile.preset = resolved.name
    profile.micro_ticks_per_session = resolved.micro_ticks_per_session
    profile.version = int(profile.version or 1) + 1
    profile.is_enabled = True
    profile.parameters = {
        **dict(profile.parameters or {}),
        "legacy_pricing": False,
        "base_spread_bps": resolved.base_spread_bps,
        "depth_levels": resolved.depth_levels,
        "max_participation_rate": resolved.max_participation_rate,
        "market_impact_scale": resolved.market_impact_scale,
        "circuit_breaker_pct": resolved.circuit_breaker_pct,
        "volatility_pause_pct": resolved.volatility_pause_pct,
    }
    db.flush()
    return profile


def _ensure_timeline_company_states(db: Session, timeline_id: int) -> None:
    companies = db.query(Company).order_by(Company.id).all()
    existing = {
        row.company_id: row
        for row in db.query(TimelineCompanyState).filter_by(timeline_id=timeline_id).all()
    }
    for company in companies:
        if company.id in existing:
            continue
        db.add(
            TimelineCompanyState(
                timeline_id=timeline_id,
                company_id=company.id,
                shares_outstanding=int(company.shares_outstanding or 0),
                is_listed=True,
                fundamental_state=dict(DEFAULT_FUNDAMENTAL_STATE),
            )
        )
    db.flush()


def evolve_timeline_fundamentals(
    db: Session,
    timeline_id: int,
    sim_date: date,
    tick_number: int,
    macro_growth: float,
    interest_rate: float,
    sector_rotation: Optional[dict[int, float]] = None,
    event_surprise: float = 0.0,
) -> int:
    """Advance timeline-local fundamental state at a reporting boundary."""

    profile = get_or_create_profile(db, timeline_id)
    states = db.query(TimelineCompanyState).filter_by(timeline_id=timeline_id).order_by(TimelineCompanyState.company_id).all()
    updated = 0
    for state in states:
        values = {**DEFAULT_FUNDAMENTAL_STATE, **(state.fundamental_state or {})}
        previous = FundamentalState(
            revenue_growth=float(values["revenue_growth"]),
            operating_margin=float(values["operating_margin"]),
            earnings_growth=float(values["earnings_growth"]),
            leverage=float(values["leverage"]),
            quality_score=float(values["quality_score"]),
        )
        if profile.parameters.get("legacy_pricing", True):
            next_state = previous
        else:
            next_state = evolve_fundamentals(
                previous,
                macro_growth,
                interest_rate,
                float((sector_rotation or {}).get(state.company_id, 0.0)),
                event_surprise,
                stable_seed(profile.seed, timeline_id, state.company_id, tick_number, "fundamentals"),
            )
        state.fundamental_state = {
            "revenue_growth": next_state.revenue_growth,
            "operating_margin": next_state.operating_margin,
            "earnings_growth": next_state.earnings_growth,
            "leverage": next_state.leverage,
            "quality_score": next_state.quality_score,
        }
        updated += 1
        _upsert_replay(
            db,
            timeline_id,
            sim_date,
            0,
            30_000 + state.company_id,
            "fundamental_refresh",
            {"company_id": state.company_id, **state.fundamental_state},
            entity_type="company",
            entity_id=state.company_id,
            deterministic_seed=stable_seed(profile.seed, timeline_id, state.company_id, tick_number, "fundamentals"),
        )
    db.flush()
    return updated


def get_session_state(
    db: Session,
    timeline_id: int,
    sim_date: Optional[date] = None,
) -> MarketSessionState:
    profile = get_or_create_profile(db, timeline_id)
    if sim_date is None:
        from db.models import SimulationState

        state = db.query(SimulationState).filter_by(timeline_id=timeline_id).first()
        sim_date = state.current_sim_date if state else date.today()
    row = db.query(MarketSessionState).filter_by(timeline_id=timeline_id, sim_date=sim_date).first()
    if row is not None:
        return row
    open_window = next(window for window in session_windows(sim_date, profile.timezone_name) if window.phase == SessionPhase.OPEN)
    row = MarketSessionState(
        timeline_id=timeline_id,
        sim_date=sim_date,
        phase=SessionPhase.CLOSED.value,
        status="scheduled",
        session_start=open_window.starts_at,
        session_end=open_window.ends_at,
        current_tick=0,
        total_ticks=profile.micro_ticks_per_session,
    )
    db.add(row)
    db.flush()
    return row


def _depth_payload(book) -> dict:
    return {
        "bids": [{"price": level.price, "quantity": level.quantity} for level in book.bids],
        "asks": [{"price": level.price, "quantity": level.quantity} for level in book.asks],
        "total_bid_depth": book.total_bid_depth,
        "total_ask_depth": book.total_ask_depth,
    }


def _latest_volume(db: Session, timeline_id: int, company_id: int, fallback: int = 1000) -> int:
    row = (
        db.query(PriceHistory.volume)
        .filter_by(timeline_id=timeline_id, company_id=company_id)
        .order_by(PriceHistory.sim_date.desc())
        .first()
    )
    return int(row[0]) if row and row[0] else fallback


def _upsert_replay(
    db: Session,
    timeline_id: int,
    sim_date: date,
    tick_index: int,
    sequence: int,
    event_type: str,
    payload: dict,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    deterministic_seed: Optional[int] = None,
) -> ReplayLedger:
    seed = deterministic_seed if deterministic_seed is not None else stable_seed(timeline_id, sim_date, tick_index, event_type, entity_id)
    fingerprint = replay_fingerprint(payload)
    row = (
        db.query(ReplayLedger)
        .filter_by(timeline_id=timeline_id, sim_date=sim_date, tick_index=tick_index, sequence=sequence)
        .first()
    )
    if row is None:
        row = ReplayLedger(
            timeline_id=timeline_id,
            sim_date=sim_date,
            tick_index=tick_index,
            sequence=sequence,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            deterministic_seed=seed,
            fingerprint=fingerprint,
            payload=payload,
        )
        db.add(row)
    elif row.fingerprint != fingerprint:
        raise ValueError("Replay ledger conflict: an existing sequence has different payload")
    return row


def _market_returns(
    db: Session,
    timeline_id: int,
    sim_date: date,
    price_by_company: dict[int, float],
) -> tuple[list[float], dict[int, float]]:
    previous_rows = (
        db.query(PriceHistory.company_id, PriceHistory.close)
        .filter(PriceHistory.timeline_id == timeline_id, PriceHistory.sim_date < sim_date)
        .order_by(PriceHistory.sim_date.desc())
        .all()
    )
    previous: dict[int, float] = {}
    for company_id, close in previous_rows:
        if company_id not in previous:
            previous[company_id] = float(close)
    returns = [
        (float(price) - previous[company_id]) / max(abs(previous[company_id]), 0.01)
        for company_id, price in price_by_company.items()
        if company_id in previous and previous[company_id] > 0
    ]
    return returns, previous


def record_daily_market_state(
    db: Session,
    timeline_id: int,
    sim_date: date,
    tick_number: int,
    price_by_company: dict[int, float],
    volume_by_company: dict[int, int],
    liquidity_by_company: Optional[dict[int, float]] = None,
    market_shock=None,
) -> MarketRegimeState:
    """Persist a daily quote, regime, flow, session, and replay snapshot."""

    profile = get_or_create_profile(db, timeline_id)
    returns, previous = _market_returns(db, timeline_id, sim_date, price_by_company)
    liquidity = liquidity_by_company or {}
    liquidity_index = sum(float(liquidity.get(cid, 50.0)) for cid in price_by_company) / max(len(price_by_company), 1) / 100.0
    breadth = (
        sum(1 if value > 0 else -1 if value < 0 else 0 for value in returns) / max(len(returns), 1)
    )
    snapshot = classify_regime(returns, breadth=breadth, liquidity_index=liquidity_index)
    regime_row = db.query(MarketRegimeState).filter_by(timeline_id=timeline_id, sim_date=sim_date).first()
    if regime_row is None:
        regime_row = MarketRegimeState(
            timeline_id=timeline_id,
            sim_date=sim_date,
            regime=snapshot.regime.value,
            realized_volatility=snapshot.realized_volatility,
            market_return=snapshot.market_return,
            breadth=snapshot.breadth,
            liquidity_index=snapshot.liquidity_index,
            drawdown=snapshot.drawdown,
            sector_leadership={},
        )
        db.add(regime_row)
    else:
        regime_row.regime = snapshot.regime.value
        regime_row.realized_volatility = snapshot.realized_volatility
        regime_row.market_return = snapshot.market_return
        regime_row.breadth = snapshot.breadth
        regime_row.liquidity_index = snapshot.liquidity_index

    session_state = get_session_state(db, timeline_id, sim_date)
    session_state.phase = SessionPhase.CLOSED.value
    session_state.status = "closed"
    session_state.current_tick = profile.micro_ticks_per_session

    companies = {
        company.id: company
        for company in db.query(Company).filter(Company.id.in_(list(price_by_company))).all()
    }
    industry_returns: dict[int, list[float]] = {}
    for company_id, close in price_by_company.items():
        company = companies.get(company_id)
        prior = previous.get(company_id)
        if company is None or prior is None or prior <= 0:
            continue
        industry_returns.setdefault(company.industry_id, []).append((float(close) - prior) / prior)
    sector_leadership = {
        str(industry_id): round(sum(values) / len(values), 8)
        for industry_id, values in sorted(
            industry_returns.items(),
            key=lambda item: sum(item[1]) / max(len(item[1]), 1),
            reverse=True,
        )
    }
    regime_row.sector_leadership = sector_leadership
    existing_quotes = {
        (row.company_id, row.tick_index): row
        for row in db.query(MarketMicroTick).filter_by(timeline_id=timeline_id, sim_date=sim_date).all()
    }
    existing_flows = {
        row.company_id: row
        for row in db.query(InstitutionalFlow).filter_by(timeline_id=timeline_id, sim_date=sim_date, tick_index=0).all()
    }
    open_timestamp = session_timestamp(sim_date, 0, get_preset(profile.preset), profile.timezone_name)
    halted_companies = 0
    halt_reasons: list[str] = []
    for company_id, close in price_by_company.items():
        company = companies.get(company_id)
        if company is None:
            continue
        score = float(liquidity.get(company_id, company.market_liquidity_score or 50.0))
        previous_close = previous.get(company_id, float(close))
        vol = float(company.volatility or abs(float(close) - previous_close) / max(previous_close, 0.01) or 0.02)
        adv_shares = max(1.0, float(volume_by_company.get(company_id, _latest_volume(db, timeline_id, company_id))) / max(float(close), 0.01))
        flow = generate_flows(
            profile.seed,
            timeline_id,
            company_id,
            tick_number,
            snapshot.regime,
            snapshot.market_return,
            score,
            profile.preset,
        )
        deterministic = stable_seed(profile.seed, timeline_id, sim_date, 0, company_id, "quote")
        book = build_order_book(
            float(close), adv_shares, vol, score, deterministic, profile.preset,
            session_phase=SessionPhase.OPEN, order_imbalance=max(-1.0, min(1.0, flow.net_flow / 4.0)),
            liquidity_multiplier=(market_shock.liquidity_multiplier if market_shock is not None else 1.0),
        )
        guard = evaluate_guardrails(previous_close, float(close), [], profile.preset)
        if guard.halted:
            halted_companies += 1
            if guard.reason is not None:
                halt_reasons.append(guard.reason.value)
        if (company_id, 0) not in existing_quotes:
            db.add(
                MarketMicroTick(
                    timeline_id=timeline_id,
                    company_id=company_id,
                    sim_date=sim_date,
                    tick_index=0,
                    tick_at=open_timestamp,
                    phase=SessionPhase.OPEN.value,
                    mid_price=book.mid_price,
                    bid_price=book.bid_price,
                    ask_price=book.ask_price,
                    spread_bps=book.spread_bps,
                    bid_size=book.total_bid_depth,
                    ask_size=book.total_ask_depth,
                    volume=int(volume_by_company.get(company_id, 0)),
                    order_imbalance=flow.net_flow / max(abs(flow.net_flow) + 1.0, 1.0),
                    slippage_bps=slippage_bps(int(max(1, volume_by_company.get(company_id, 1) * 0.01)), adv_shares, vol, book.spread_bps, score, profile.preset),
                    regime=snapshot.regime.value,
                    is_halted=guard.halted,
                    halt_reason=guard.reason.value if guard.reason else None,
                    deterministic_seed=deterministic,
                    depth=_depth_payload(book),
                )
            )
        if company_id not in existing_flows:
            db.add(
                InstitutionalFlow(
                    timeline_id=timeline_id,
                    company_id=company_id,
                    sim_date=sim_date,
                    tick_index=0,
                    institutional_flow=flow.institutional_flow,
                    insider_flow=flow.insider_flow,
                    retail_flow=flow.retail_flow,
                    net_flow=flow.net_flow,
                    insider_signal=flow.insider_signal,
                )
            )
        _upsert_replay(
            db,
            timeline_id,
            sim_date,
            0,
            company_id + 1,
            "market_quote",
            {
                "company_id": company_id,
                "mid_price": round(float(close), 8),
                "regime": snapshot.regime.value,
                "flow": flow.net_flow,
                "halted": guard.halted,
            },
            entity_type="company",
            entity_id=company_id,
            deterministic_seed=deterministic,
        )

    _upsert_replay(
        db,
        timeline_id,
        sim_date,
        0,
        0,
        "regime_classification",
        {
            "regime": snapshot.regime.value,
            "realized_volatility": snapshot.realized_volatility,
            "breadth": snapshot.breadth,
            "liquidity_index": snapshot.liquidity_index,
        },
        deterministic_seed=stable_seed(profile.seed, timeline_id, sim_date, "regime"),
    )
    if market_shock is not None and market_shock.active:
        shock_exists = db.query(MarketNewsBulletin).filter_by(
            timeline_id=timeline_id,
            sim_date=sim_date,
            event_type=market_shock.shock_type,
        ).first()
        if shock_exists is None:
            headline, body = realism_news(
                market_shock.shock_type,
                None,
                None,
                "negative",
                market_shock.magnitude * 100.0,
                stable_seed(profile.seed, timeline_id, sim_date, "shock_news"),
            )
            db.add(
                MarketNewsBulletin(
                    timeline_id=timeline_id,
                    sim_date=sim_date,
                    event_type=market_shock.shock_type,
                    headline=headline,
                    body=body,
                    sentiment="negative",
                    severity=market_shock.magnitude * 100.0,
                    source="simulation",
                    payload={
                        "liquidity_shock": market_shock.liquidity_shock,
                        "market_return_shock": market_shock.market_return_shock,
                        "liquidity_multiplier": market_shock.liquidity_multiplier,
                    },
                )
            )
        _upsert_replay(
            db,
            timeline_id,
            sim_date,
            0,
            5_000,
            "market_shock",
            {
                "shock_type": market_shock.shock_type,
                "magnitude": market_shock.magnitude,
                "liquidity_shock": market_shock.liquidity_shock,
                "market_return_shock": market_shock.market_return_shock,
            },
            deterministic_seed=stable_seed(profile.seed, timeline_id, sim_date, "market_shock"),
        )
    session_state.phase = SessionPhase.CLOSED.value
    session_state.status = "halted" if halted_companies else "closed"
    session_state.halt_reason = halt_reasons[0] if halt_reasons else session_state.halt_reason
    session_state.volatility_pause_count = max(
        int(session_state.volatility_pause_count or 0),
        halted_companies,
    )
    db.flush()
    return regime_row


def get_order_book_snapshot(
    db: Session,
    timeline_id: int,
    company_id: int,
    sim_date: Optional[date] = None,
    tick_index: int = 0,
) -> MarketMicroTick:
    query = db.query(MarketMicroTick).filter_by(
        timeline_id=timeline_id, company_id=company_id, tick_index=tick_index
    )
    if sim_date is not None:
        query = query.filter_by(sim_date=sim_date)
    row = query.order_by(MarketMicroTick.sim_date.desc()).first()
    if row is None:
        raise NotFoundError("No order-book snapshot exists for this company and timeline")
    return row


def get_latest_regime(db: Session, timeline_id: int) -> MarketRegimeState:
    row = (
        db.query(MarketRegimeState)
        .filter_by(timeline_id=timeline_id)
        .order_by(MarketRegimeState.sim_date.desc())
        .first()
    )
    if row is None:
        raise NotFoundError("No regime state exists for this timeline")
    return row


def list_micro_ticks(
    db: Session,
    timeline_id: int,
    company_id: int,
    sim_date: Optional[date] = None,
    limit: int = 390,
) -> list[MarketMicroTick]:
    query = db.query(MarketMicroTick).filter_by(timeline_id=timeline_id, company_id=company_id)
    if sim_date is not None:
        query = query.filter_by(sim_date=sim_date)
    return query.order_by(MarketMicroTick.sim_date.desc(), MarketMicroTick.tick_index.asc()).limit(limit).all()


def list_market_news(
    db: Session,
    timeline_id: int,
    sim_date: Optional[date] = None,
    limit: int = 100,
) -> list[MarketNewsBulletin]:
    query = db.query(MarketNewsBulletin).filter_by(timeline_id=timeline_id)
    if sim_date is not None:
        query = query.filter_by(sim_date=sim_date)
    return query.order_by(MarketNewsBulletin.sim_date.desc(), MarketNewsBulletin.id.desc()).limit(limit).all()


def list_replay_ledger(
    db: Session,
    timeline_id: int,
    sim_date: Optional[date] = None,
    limit: int = 500,
) -> list[ReplayLedger]:
    query = db.query(ReplayLedger).filter_by(timeline_id=timeline_id)
    if sim_date is not None:
        query = query.filter_by(sim_date=sim_date)
    return query.order_by(ReplayLedger.sim_date.desc(), ReplayLedger.tick_index.desc(), ReplayLedger.sequence.asc()).limit(limit).all()


def run_intraday_ticks(
    db: Session,
    timeline_id: int,
    sim_date: date,
    company_ids: Optional[Iterable[int]] = None,
    tick_count: Optional[int] = None,
) -> int:
    """Run deterministic intraday quote ticks without rewriting daily bars."""

    profile = get_or_create_profile(db, timeline_id)
    preset = get_preset(profile.preset)
    requested = tick_count if tick_count is not None else profile.micro_ticks_per_session
    if requested < 1 or requested > preset.micro_ticks_per_session:
        raise ValueError(f"tick_count must be between 1 and {preset.micro_ticks_per_session}")
    companies_query = db.query(Company).order_by(Company.id)
    if company_ids is not None:
        ids = list(company_ids)
        companies_query = companies_query.filter(Company.id.in_(ids))
    companies = companies_query.all()
    if not companies:
        raise ValueError("No companies available for intraday simulation")
    regime_row = db.query(MarketRegimeState).filter_by(timeline_id=timeline_id).order_by(MarketRegimeState.sim_date.desc()).first()
    regime = MarketRegime(regime_row.regime) if regime_row is not None else MarketRegime.SIDEWAYS
    session_state = get_session_state(db, timeline_id, sim_date)
    existing = {
        (row.company_id, row.tick_index): row
        for row in db.query(MarketMicroTick).filter_by(timeline_id=timeline_id, sim_date=sim_date).all()
    }
    created = 0
    for company in companies:
        latest_price = get_latest_price(db, company.id, timeline_id)
        if latest_price is None:
            continue
        price = float(latest_price)
        volume = _latest_volume(db, timeline_id, company.id)
        score = float(company.market_liquidity_score or 50.0)
        volatility = float(company.volatility or 0.02)
        adv_shares = max(1.0, volume / max(price, 0.01))
        for tick_index in range(requested):
            if (company.id, tick_index) in existing:
                price = float(existing[(company.id, tick_index)].mid_price)
                continue
            phase = SessionPhase.OPEN
            if tick_index == 0:
                phase = SessionPhase.OPEN_AUCTION
            elif tick_index == requested - 1:
                phase = SessionPhase.CLOSE_AUCTION
            flow = generate_flows(profile.seed, timeline_id, company.id, tick_index, regime, 0.0, score, profile.preset)
            rng = __import__("random").Random(stable_seed(profile.seed, timeline_id, sim_date, company.id, tick_index, "micro_move"))
            move = (flow.net_flow * 0.0004) + rng.gauss(0.0, volatility / math.sqrt(max(requested, 1)))
            candidate = max(preset.price_floor, price * (1.0 + max(-0.25, min(0.25, move))))
            guard = evaluate_guardrails(price, candidate, [], profile.preset, liquidity_shock=0.0)
            if guard.halted:
                candidate = price
                session_state.status = "halted"
                session_state.phase = phase.value
                session_state.halt_reason = guard.reason.value if guard.reason else None
                session_state.halt_until = datetime.now(timezone.utc) + timedelta(minutes=5)
                session_state.volatility_pause_count += 1
            else:
                session_state.status = "open"
                session_state.phase = phase.value
            deterministic = stable_seed(profile.seed, timeline_id, sim_date, company.id, tick_index, "order_book")
            book = build_order_book(candidate, adv_shares, volatility, score, deterministic, profile.preset, session_phase=phase, order_imbalance=flow.net_flow / 4.0)
            if guard.halted:
                from dataclasses import replace

                book = replace(book, halted=True, halt_reason=guard.reason)
            tick_at = session_timestamp(sim_date, tick_index, preset, profile.timezone_name)
            db.add(
                MarketMicroTick(
                    timeline_id=timeline_id,
                    company_id=company.id,
                    sim_date=sim_date,
                    tick_index=tick_index,
                    tick_at=tick_at,
                    phase=phase.value,
                    mid_price=round(candidate, 8),
                    bid_price=book.bid_price,
                    ask_price=book.ask_price,
                    spread_bps=book.spread_bps,
                    bid_size=book.total_bid_depth,
                    ask_size=book.total_ask_depth,
                    volume=max(0, int(abs(flow.net_flow) * adv_shares)),
                    order_imbalance=max(-1.0, min(1.0, flow.net_flow / 5.0)),
                    slippage_bps=slippage_bps(max(1, int(abs(flow.net_flow) * adv_shares)), adv_shares, volatility, book.spread_bps, score, profile.preset),
                    regime=regime.value,
                    is_halted=guard.halted,
                    halt_reason=guard.reason.value if guard.reason else None,
                    deterministic_seed=deterministic,
                    depth=_depth_payload(book),
                )
            )
            db.add(
                InstitutionalFlow(
                    timeline_id=timeline_id,
                    company_id=company.id,
                    sim_date=sim_date,
                    tick_index=tick_index,
                    institutional_flow=flow.institutional_flow,
                    insider_flow=flow.insider_flow,
                    retail_flow=flow.retail_flow,
                    net_flow=flow.net_flow,
                    insider_signal=flow.insider_signal,
                )
            )
            _upsert_replay(
                db,
                timeline_id,
                sim_date,
                tick_index,
                company.id + 1,
                "intraday_quote",
                {"company_id": company.id, "mid_price": round(candidate, 8), "phase": phase.value, "halted": guard.halted},
                entity_type="company",
                entity_id=company.id,
                deterministic_seed=deterministic,
            )
            price = candidate
            created += 1
    session_state.current_tick = requested
    session_state.phase = SessionPhase.CLOSED.value
    session_state.status = "closed"
    db.flush()
    return created


def schedule_economic_event(
    db: Session,
    timeline_id: int,
    event_type: str,
    title: str,
    scheduled_date: date,
    consensus_value: Optional[float],
    importance: float,
    source: str = "simulation",
) -> EconomicCalendarEvent:
    EconomicEventType(event_type)
    profile = get_or_create_profile(db, timeline_id)
    premarket = next(window for window in session_windows(scheduled_date, profile.timezone_name) if window.phase == SessionPhase.PRE_MARKET)
    event = EconomicCalendarEvent(
        timeline_id=timeline_id,
        event_type=event_type,
        title=title,
        scheduled_date=scheduled_date,
        scheduled_at=premarket.starts_at,
        consensus_value=consensus_value,
        importance=max(0.0, min(3.0, float(importance))),
        source=source,
        payload={},
    )
    db.add(event)
    db.flush()
    return event


def schedule_corporate_action(
    db: Session,
    timeline_id: int,
    company_id: int,
    action_type: str,
    effective_date: date,
    ratio: float = 1.0,
    cash_per_share: float = 0.0,
    settlement_price: Optional[float] = None,
    target_company_id: Optional[int] = None,
    source: str = "simulation",
) -> CorporateAction:
    action_value = action_type.value if hasattr(action_type, "value") else str(action_type)
    spec = CorporateActionSpec(action_type=action_value, ratio=ratio, cash_per_share=cash_per_share, settlement_price=settlement_price)
    # Validate all action-specific invariants before persisting.
    if action_value == "split" and ratio <= 0:
        raise ValueError("split ratio must be positive")
    action = CorporateAction(
        timeline_id=timeline_id,
        company_id=company_id,
        target_company_id=target_company_id,
        action_type=action_value,
        announced_date=effective_date,
        effective_date=effective_date,
        ratio=ratio,
        cash_per_share=cash_per_share,
        settlement_price=settlement_price,
        source=source,
        payload={},
    )
    db.add(action)
    db.flush()
    return action


def release_due_economic_events(
    db: Session,
    timeline_id: int,
    sim_date: date,
    seed: int,
) -> list[dict]:
    """Release scheduled macro data using a deterministic surprise draw."""

    events = (
        db.query(EconomicCalendarEvent)
        .filter(
            EconomicCalendarEvent.timeline_id == timeline_id,
            EconomicCalendarEvent.scheduled_date <= sim_date,
            EconomicCalendarEvent.status == "scheduled",
        )
        .order_by(EconomicCalendarEvent.scheduled_date.asc(), EconomicCalendarEvent.id.asc())
        .all()
    )
    released: list[dict] = []
    for event in events:
        consensus = float(event.consensus_value or 0.0)
        rng = __import__("random").Random(stable_seed(seed, timeline_id, event.id, event.scheduled_date, "macro_release"))
        actual = consensus + rng.gauss(0.0, max(abs(consensus) * 0.05, 0.10))
        impact = economic_event_impact(event.event_type, actual, consensus, float(event.importance))
        event.actual_value = round(actual, 8)
        event.surprise = impact.normalized_surprise
        event.status = "applied"
        event.payload = {
            "market_return_shock": impact.market_return_shock,
            "rate_change": impact.rate_change,
            "inflation_change": impact.inflation_change,
            "employment_change": impact.employment_change,
            "gdp_change": impact.gdp_change,
        }
        sentiment = "positive" if impact.market_return_shock > 0 else "negative" if impact.market_return_shock < 0 else "neutral"
        headline, body = realism_news(
            event.event_type,
            None,
            None,
            sentiment,
            abs(impact.normalized_surprise) * 100.0,
            stable_seed(seed, timeline_id, event.id, "macro_news"),
        )
        db.add(
            MarketNewsBulletin(
                timeline_id=timeline_id,
                sim_date=sim_date,
                event_type=event.event_type,
                headline=headline,
                body=body,
                sentiment=sentiment,
                severity=abs(impact.normalized_surprise) * 100.0,
                source=event.source,
                source_event_id=event.id,
                payload=event.payload,
            )
        )
        released.append({"event": event, "impact": impact})
        _upsert_replay(
            db,
            timeline_id,
            sim_date,
            0,
            10_000 + event.id,
            "economic_release",
            {"event_id": event.id, "event_type": event.event_type, "actual": actual, "consensus": consensus, "surprise": impact.normalized_surprise},
            entity_type="economic_event",
            entity_id=event.id,
            deterministic_seed=stable_seed(seed, timeline_id, event.id, "macro_release"),
        )
    db.flush()
    return released


def list_economic_calendar(
    db: Session,
    timeline_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[EconomicCalendarEvent]:
    query = db.query(EconomicCalendarEvent).filter_by(timeline_id=timeline_id)
    if from_date is not None:
        query = query.filter(EconomicCalendarEvent.scheduled_date >= from_date)
    if to_date is not None:
        query = query.filter(EconomicCalendarEvent.scheduled_date <= to_date)
    return query.order_by(EconomicCalendarEvent.scheduled_date.asc(), EconomicCalendarEvent.id.asc()).all()


def apply_due_corporate_actions(db: Session, timeline_id: int, sim_date: date) -> int:
    """Apply timeline-local share/listing changes and mark actions exactly once."""

    actions = (
        db.query(CorporateAction)
        .filter(
            CorporateAction.timeline_id == timeline_id,
            CorporateAction.effective_date <= sim_date,
            CorporateAction.status == "scheduled",
        )
        .order_by(CorporateAction.effective_date.asc(), CorporateAction.id.asc())
        .all()
    )
    applied = 0
    for action in actions:
        state = db.query(TimelineCompanyState).filter_by(timeline_id=timeline_id, company_id=action.company_id).first()
        company = db.query(Company).filter_by(id=action.company_id).first()
        if state is None or company is None:
            continue
        price = get_latest_price(db, action.company_id, timeline_id) or float(company.current_price or 0.01)
        result = apply_corporate_action(
            CorporateActionSpec(
                action_type=action.action_type,
                ratio=float(action.ratio),
                cash_per_share=float(action.cash_per_share),
                settlement_price=float(action.settlement_price) if action.settlement_price is not None else None,
            ),
            float(price),
            float(state.shares_outstanding),
        )
        state.shares_outstanding = int(round(result.shares_outstanding))
        state.is_listed = result.active
        state.last_action_date = action.effective_date
        portfolios = db.query(Portfolio).filter_by(timeline_id=timeline_id).all()
        for portfolio in portfolios:
            holding = db.query(Holding).filter_by(
                portfolio_id=portfolio.id, company_id=action.company_id
            ).first()
            if holding is None:
                continue
            quantity = Decimal(str(holding.quantity))
            if action.action_type == "dividend":
                portfolio.cash_balance = Decimal(str(portfolio.cash_balance)) + quantity * Decimal(str(action.cash_per_share))
            elif action.action_type == "split":
                holding.quantity = quantity * Decimal(str(action.ratio))
                holding.avg_cost_basis = Decimal(str(holding.avg_cost_basis)) / Decimal(str(action.ratio))
            elif action.action_type == "delisting":
                settlement = Decimal(str(action.settlement_price or 0))
                portfolio.cash_balance = Decimal(str(portfolio.cash_balance)) + quantity * settlement
                db.delete(holding)
        action.status = "applied"
        action.payload = {
            "pre_action_price": float(price),
            "post_action_price": result.price,
            "shares_outstanding": state.shares_outstanding,
            "is_listed": state.is_listed,
        }
        _upsert_replay(
            db,
            timeline_id,
            sim_date,
            0,
            20_000 + action.id,
            "corporate_action",
            {"action_id": action.id, "action_type": action.action_type, **action.payload},
            entity_type="company",
            entity_id=action.company_id,
            deterministic_seed=stable_seed(timeline_id, action.id, "corporate_action"),
        )
        applied += 1
    db.flush()
    return applied


def create_default_economic_calendar(
    db: Session,
    timeline_id: int,
    start_date: date,
    periods: int = 12,
) -> int:
    """Seed a repeatable educational macro calendar for a new timeline."""

    existing = db.query(EconomicCalendarEvent).filter_by(timeline_id=timeline_id).count()
    if existing:
        return existing
    event_defs = (
        (EconomicEventType.INTEREST_RATE.value, "Central bank rate decision", 4.0, 1.5),
        (EconomicEventType.INFLATION.value, "Consumer inflation release", 2.5, 1.0),
        (EconomicEventType.EMPLOYMENT.value, "Employment report", 100.0, 1.0),
        (EconomicEventType.GDP.value, "GDP growth release", 2.5, 1.25),
    )
    created = 0
    cursor = next_business_date(start_date)
    for index in range(periods):
        event_type, title, consensus, importance = event_defs[index % len(event_defs)]
        schedule_economic_event(
            db, timeline_id, event_type, title,
            cursor, consensus, importance,
        )
        cursor = next_business_date(start_date + timedelta(days=(index + 1) * 14 - 1))
        created += 1
    return created
