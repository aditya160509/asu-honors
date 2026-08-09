"""Deterministic market-realism primitives.

This module is deliberately database-free.  The simulation orchestrator and the
trading service use these functions to produce reproducible market state, while
the API persists the returned observations.  Keeping the mechanics pure makes
replays auditable and prevents an ORM query or process-global random generator
from changing a historical result.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from enum import Enum
from typing import Any, Iterable, Mapping, Optional, Sequence
from zoneinfo import ZoneInfo


class SessionPhase(str, Enum):
    CLOSED = "closed"
    PRE_MARKET = "pre_market"
    OPEN_AUCTION = "open_auction"
    OPEN = "open"
    CLOSE_AUCTION = "close_auction"
    AFTER_HOURS = "after_hours"


class MarketRegime(str, Enum):
    BULL = "bull"
    BEAR = "bear"
    SIDEWAYS = "sideways"
    HIGH_VOLATILITY = "high_volatility"
    CRISIS = "crisis"


class HaltReason(str, Enum):
    CIRCUIT_BREAKER = "circuit_breaker"
    VOLATILITY_PAUSE = "volatility_pause"
    LIQUIDITY_SHOCK = "liquidity_shock"
    ADMIN = "admin"


@dataclass(frozen=True)
class MarketShock:
    """A deterministic market-wide liquidity or price shock."""

    shock_type: Optional[str]
    magnitude: float
    liquidity_shock: float
    market_return_shock: float
    liquidity_multiplier: float

    @property
    def active(self) -> bool:
        return self.shock_type is not None


def no_market_shock() -> MarketShock:
    return MarketShock(None, 0.0, 0.0, 0.0, 1.0)


class CorporateActionType(str, Enum):
    DIVIDEND = "dividend"
    SPLIT = "split"
    BUYBACK = "buyback"
    MERGER = "merger"
    IPO = "ipo"
    DELISTING = "delisting"


class EconomicEventType(str, Enum):
    INTEREST_RATE = "interest_rate"
    INFLATION = "inflation"
    EMPLOYMENT = "employment"
    GDP = "gdp"


@dataclass(frozen=True)
class SessionWindow:
    """A named exchange window with timezone-aware boundaries."""

    phase: SessionPhase
    starts_at: datetime
    ends_at: datetime


@dataclass(frozen=True)
class RealismPreset:
    """Typed simulation controls.

    Values are intentionally explicit and bounded.  A preset is part of the
    replay identity; changing it creates a different simulation, never a
    silent mutation of an existing result.
    """

    name: str
    micro_ticks_per_session: int
    base_spread_bps: float
    depth_levels: int
    max_participation_rate: float
    market_impact_scale: float
    circuit_breaker_pct: float
    volatility_pause_pct: float
    liquidity_shock_probability: float
    flash_crash_probability: float
    institutional_flow_scale: float
    insider_flow_scale: float
    fundamental_drift_scale: float
    event_probability_multiplier: float
    price_floor: float = 0.01
    tick_size: float = 0.01

    def __post_init__(self) -> None:
        if self.micro_ticks_per_session < 1:
            raise ValueError("micro_ticks_per_session must be positive")
        if self.depth_levels < 1:
            raise ValueError("depth_levels must be positive")
        for name in (
            "max_participation_rate",
            "liquidity_shock_probability",
            "flash_crash_probability",
        ):
            value = float(getattr(self, name))
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be between 0 and 1")
        if self.base_spread_bps < 0 or self.circuit_breaker_pct <= 0:
            raise ValueError("spread and circuit-breaker values must be positive")


PRESETS: dict[str, RealismPreset] = {
    "educational": RealismPreset(
        name="educational",
        micro_ticks_per_session=12,
        base_spread_bps=4.0,
        depth_levels=5,
        max_participation_rate=0.08,
        market_impact_scale=0.50,
        circuit_breaker_pct=0.20,
        volatility_pause_pct=0.10,
        liquidity_shock_probability=0.002,
        flash_crash_probability=0.0005,
        institutional_flow_scale=0.50,
        insider_flow_scale=0.20,
        fundamental_drift_scale=0.50,
        event_probability_multiplier=0.75,
    ),
    "realistic": RealismPreset(
        name="realistic",
        micro_ticks_per_session=78,
        base_spread_bps=8.0,
        depth_levels=5,
        max_participation_rate=0.03,
        market_impact_scale=1.0,
        circuit_breaker_pct=0.07,
        volatility_pause_pct=0.04,
        liquidity_shock_probability=0.005,
        flash_crash_probability=0.001,
        institutional_flow_scale=1.0,
        insider_flow_scale=0.35,
        fundamental_drift_scale=1.0,
        event_probability_multiplier=1.0,
    ),
    "institutional": RealismPreset(
        name="institutional",
        micro_ticks_per_session=390,
        base_spread_bps=12.0,
        depth_levels=10,
        max_participation_rate=0.01,
        market_impact_scale=1.35,
        circuit_breaker_pct=0.07,
        volatility_pause_pct=0.04,
        liquidity_shock_probability=0.008,
        flash_crash_probability=0.002,
        institutional_flow_scale=1.5,
        insider_flow_scale=0.50,
        fundamental_drift_scale=1.0,
        event_probability_multiplier=1.10,
    ),
    "crisis": RealismPreset(
        name="crisis",
        micro_ticks_per_session=78,
        base_spread_bps=28.0,
        depth_levels=5,
        max_participation_rate=0.008,
        market_impact_scale=2.5,
        circuit_breaker_pct=0.05,
        volatility_pause_pct=0.025,
        liquidity_shock_probability=0.08,
        flash_crash_probability=0.02,
        institutional_flow_scale=2.0,
        insider_flow_scale=0.75,
        fundamental_drift_scale=1.5,
        event_probability_multiplier=1.75,
    ),
}


def get_preset(name: str) -> RealismPreset:
    """Return a preset by name, rejecting silent fallback for typos."""

    try:
        return PRESETS[name.strip().lower()]
    except KeyError as exc:
        raise ValueError(f"Unknown realism preset '{name}'. Expected one of {sorted(PRESETS)}") from exc


def stable_seed(base_seed: int, *parts: object) -> int:
    """Derive a stable 64-bit seed from a timeline seed and a namespace.

    Python's built-in ``hash`` is process-randomized, so it is not suitable for
    replay.  SHA-256 gives a stable value across workers, Python versions, and
    operating systems.
    """

    payload = "|".join([str(int(base_seed)), *(str(part) for part in parts)]).encode("utf-8")
    # Keep the value inside SQLite/PostgreSQL's signed BIGINT range.  The
    # namespace remains 63-bit and therefore collision-resistant for replay
    # purposes while staying portable across the two test/production stores.
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big", signed=False) & ((1 << 63) - 1)


def rng_for(base_seed: int, *parts: object) -> random.Random:
    """Create an independent deterministic RNG for one simulation namespace."""

    return random.Random(stable_seed(base_seed, *parts))


def replay_fingerprint(payload: Mapping[str, Any]) -> str:
    """Return a canonical SHA-256 fingerprint for an observation or decision."""

    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def session_windows(
    sim_date: date,
    timezone_name: str = "America/New_York",
) -> tuple[SessionWindow, ...]:
    """Build the regular US-equity session schedule for a simulation date."""

    tz = ZoneInfo(timezone_name)
    boundaries = (
        (SessionPhase.PRE_MARKET, time(7, 0), time(9, 25)),
        (SessionPhase.OPEN_AUCTION, time(9, 25), time(9, 30)),
        (SessionPhase.OPEN, time(9, 30), time(15, 55)),
        (SessionPhase.CLOSE_AUCTION, time(15, 55), time(16, 0)),
        (SessionPhase.AFTER_HOURS, time(16, 0), time(20, 0)),
    )
    return tuple(
        SessionWindow(
            phase=phase,
            starts_at=datetime.combine(sim_date, start, tzinfo=tz),
            ends_at=datetime.combine(sim_date, end, tzinfo=tz),
        )
        for phase, start, end in boundaries
    )


def session_phase_at(
    timestamp: datetime,
    timezone_name: str = "America/New_York",
) -> SessionPhase:
    """Resolve a timestamp into a session phase; weekends are closed."""

    local = timestamp.astimezone(ZoneInfo(timezone_name)) if timestamp.tzinfo else timestamp.replace(tzinfo=ZoneInfo(timezone_name))
    if local.weekday() >= 5:
        return SessionPhase.CLOSED
    for window in session_windows(local.date(), timezone_name):
        if window.starts_at <= local < window.ends_at:
            return window.phase
    return SessionPhase.CLOSED


def session_timestamp(
    sim_date: date,
    tick_index: int,
    preset: RealismPreset,
    timezone_name: str = "America/New_York",
) -> datetime:
    """Map a regular-session micro-tick index to a deterministic timestamp."""

    if tick_index < 0 or tick_index >= preset.micro_ticks_per_session:
        raise ValueError("tick_index is outside the configured session")
    window = next(w for w in session_windows(sim_date, timezone_name) if w.phase == SessionPhase.OPEN)
    duration = window.ends_at - window.starts_at
    offset = duration * (tick_index / preset.micro_ticks_per_session)
    return window.starts_at + offset


@dataclass(frozen=True)
class RegimeSnapshot:
    regime: MarketRegime
    realized_volatility: float
    market_return: float
    breadth: float
    liquidity_index: float
    drawdown: float


def classify_regime(
    returns: Sequence[float],
    breadth: float,
    liquidity_index: float,
    drawdown: float = 0.0,
) -> RegimeSnapshot:
    """Classify bull, bear, sideways, high-volatility, or crisis conditions.

    This intentionally uses transparent features instead of an opaque fitted
    model.  It is deterministic, explainable, and stable with short histories.
    """

    clean = [float(value) for value in returns if math.isfinite(float(value))]
    market_return = sum(clean) / len(clean) if clean else 0.0
    realized_volatility = math.sqrt(sum((value - market_return) ** 2 for value in clean) / len(clean)) if clean else 0.0
    breadth = max(-1.0, min(1.0, float(breadth)))
    liquidity_index = max(0.0, min(1.0, float(liquidity_index)))
    drawdown = min(0.0, float(drawdown))

    if drawdown <= -0.20 or (market_return <= -0.025 and realized_volatility >= 0.04 and liquidity_index < 0.35):
        regime = MarketRegime.CRISIS
    elif realized_volatility >= 0.035 or liquidity_index < 0.25:
        regime = MarketRegime.HIGH_VOLATILITY
    elif market_return >= 0.001 and breadth >= 0.10:
        regime = MarketRegime.BULL
    elif market_return <= -0.001 and breadth <= -0.10:
        regime = MarketRegime.BEAR
    else:
        regime = MarketRegime.SIDEWAYS

    return RegimeSnapshot(
        regime=regime,
        realized_volatility=realized_volatility,
        market_return=market_return,
        breadth=breadth,
        liquidity_index=liquidity_index,
        drawdown=drawdown,
    )


REGIME_PARAMETERS: dict[MarketRegime, dict[str, float]] = {
    MarketRegime.BULL: {"drift": 1.15, "volatility": 0.85, "liquidity": 1.10},
    MarketRegime.BEAR: {"drift": 0.85, "volatility": 1.20, "liquidity": 0.85},
    MarketRegime.SIDEWAYS: {"drift": 1.00, "volatility": 0.95, "liquidity": 1.00},
    MarketRegime.HIGH_VOLATILITY: {"drift": 0.95, "volatility": 1.65, "liquidity": 0.65},
    MarketRegime.CRISIS: {"drift": 0.65, "volatility": 2.50, "liquidity": 0.30},
}


def regime_parameters(regime: MarketRegime | str) -> dict[str, float]:
    """Return a copy of the deterministic regime multipliers."""

    resolved = MarketRegime(regime)
    return dict(REGIME_PARAMETERS[resolved])


def generate_market_shock(
    base_seed: int,
    timeline_id: int,
    sim_date: date,
    tick_number: int,
    preset: RealismPreset | str = "realistic",
    regime: MarketRegime | str = MarketRegime.SIDEWAYS,
) -> MarketShock:
    """Draw one deterministic black-swan/flash-crash/liquidity shock."""

    profile = get_preset(preset) if isinstance(preset, str) else preset
    resolved_regime = MarketRegime(regime)
    rng = rng_for(base_seed, timeline_id, sim_date, tick_number, "market_shock")
    crisis_multiplier = 1.0 + (0.75 if resolved_regime == MarketRegime.CRISIS else 0.0)
    draw = rng.random()
    flash_threshold = profile.flash_crash_probability * crisis_multiplier
    black_swan_threshold = flash_threshold + profile.liquidity_shock_probability * crisis_multiplier
    if draw < flash_threshold:
        magnitude = min(0.50, max(0.04, abs(rng.gauss(0.10, 0.035))))
        return MarketShock("flash_crash", magnitude, min(1.0, 0.70 + magnitude), -magnitude, 0.20)
    if draw < black_swan_threshold:
        magnitude = min(0.40, max(0.06, abs(rng.gauss(0.16, 0.06))))
        return MarketShock("black_swan", magnitude, min(1.0, 0.85 + magnitude / 2.0), -magnitude, 0.10)
    if draw < black_swan_threshold + profile.liquidity_shock_probability:
        magnitude = min(1.0, max(0.80, rng.gauss(0.90, 0.05)))
        return MarketShock("liquidity_shock", magnitude, magnitude, 0.0, 0.25)
    return no_market_shock()


@dataclass(frozen=True)
class OrderBookLevel:
    price: float
    quantity: int


@dataclass(frozen=True)
class OrderBookSnapshot:
    mid_price: float
    bid_price: float
    ask_price: float
    spread_bps: float
    bids: tuple[OrderBookLevel, ...]
    asks: tuple[OrderBookLevel, ...]
    liquidity_score: float
    session_phase: SessionPhase
    halted: bool = False
    halt_reason: Optional[HaltReason] = None

    @property
    def total_bid_depth(self) -> int:
        return sum(level.quantity for level in self.bids)

    @property
    def total_ask_depth(self) -> int:
        return sum(level.quantity for level in self.asks)


@dataclass(frozen=True)
class FillResult:
    status: str
    requested_quantity: int
    filled_quantity: int
    remaining_quantity: int
    average_price: Optional[float]
    total_notional: float
    slippage_bps: float
    levels_consumed: int


def _round_to_tick(value: float, tick_size: float, direction: str) -> float:
    units = value / tick_size
    if direction == "down":
        return math.floor(units) * tick_size
    return math.ceil(units) * tick_size


def build_order_book(
    mid_price: float,
    average_daily_volume_shares: float,
    volatility: float,
    liquidity_score: float,
    seed: int,
    preset: RealismPreset | str = "realistic",
    session_phase: SessionPhase = SessionPhase.OPEN,
    liquidity_multiplier: float = 1.0,
    order_imbalance: float = 0.0,
) -> OrderBookSnapshot:
    """Build a deterministic synthetic L2 book from observable state."""

    profile = get_preset(preset) if isinstance(preset, str) else preset
    mid = max(profile.price_floor, float(mid_price))
    liquidity = max(0.0, min(100.0, float(liquidity_score)))
    vol = max(0.0, float(volatility))
    session_multiplier = {
        SessionPhase.PRE_MARKET: 2.0,
        SessionPhase.OPEN_AUCTION: 1.4,
        SessionPhase.OPEN: 1.0,
        SessionPhase.CLOSE_AUCTION: 1.3,
        SessionPhase.AFTER_HOURS: 2.4,
        SessionPhase.CLOSED: 100.0,
    }[session_phase]
    spread_bps = profile.base_spread_bps * (1.0 + (100.0 - liquidity) / 100.0) * (1.0 + vol * 4.0) * session_multiplier
    half_spread = mid * spread_bps / 20_000.0
    bid_price = max(profile.price_floor, _round_to_tick(mid - half_spread, profile.tick_size, "down"))
    ask_price = max(bid_price + profile.tick_size, _round_to_tick(mid + half_spread, profile.tick_size, "up"))

    rng = random.Random(seed)
    depth_scale = max(1.0, float(average_daily_volume_shares)) * profile.max_participation_rate
    depth_scale *= max(0.05, liquidity / 100.0) * max(0.05, float(liquidity_multiplier))
    imbalance = max(-1.0, min(1.0, float(order_imbalance)))
    bids: list[OrderBookLevel] = []
    asks: list[OrderBookLevel] = []
    for level in range(profile.depth_levels):
        distance = level + 1
        bid = max(profile.price_floor, _round_to_tick(bid_price - distance * profile.tick_size, profile.tick_size, "down"))
        ask = _round_to_tick(ask_price + (distance - 1) * profile.tick_size, profile.tick_size, "up")
        base_quantity = depth_scale / max(1.0, distance * 1.35)
        noise_bid = math.exp(rng.gauss(0.0, 0.18))
        noise_ask = math.exp(rng.gauss(0.0, 0.18))
        bid_qty = max(1, int(base_quantity * noise_bid * (1.0 - imbalance * 0.25)))
        ask_qty = max(1, int(base_quantity * noise_ask * (1.0 + imbalance * 0.25)))
        bids.append(OrderBookLevel(price=round(bid, 6), quantity=bid_qty))
        asks.append(OrderBookLevel(price=round(ask, 6), quantity=ask_qty))

    if session_phase == SessionPhase.CLOSED:
        bids = []
        asks = []
    return OrderBookSnapshot(
        mid_price=round(mid, 6),
        bid_price=round(bid_price, 6),
        ask_price=round(ask_price, 6),
        spread_bps=round(spread_bps, 6),
        bids=tuple(bids),
        asks=tuple(asks),
        liquidity_score=round(liquidity, 6),
        session_phase=session_phase,
    )


def execute_market_order(
    book: OrderBookSnapshot,
    side: str,
    quantity: int,
    limit_price: Optional[float] = None,
) -> FillResult:
    """Walk the book and return a partial-fill-aware execution result."""

    if side not in {"buy", "sell"}:
        raise ValueError("side must be buy or sell")
    if quantity <= 0:
        raise ValueError("quantity must be positive")
    if book.halted or book.session_phase == SessionPhase.CLOSED:
        return FillResult("rejected", quantity, 0, quantity, None, 0.0, 0.0, 0)

    levels = book.asks if side == "buy" else book.bids
    filled = 0
    notional = 0.0
    levels_consumed = 0
    for level in levels:
        if limit_price is not None:
            crosses = level.price <= limit_price if side == "buy" else level.price >= limit_price
            if not crosses:
                break
        take = min(quantity - filled, level.quantity)
        if take <= 0:
            break
        filled += take
        notional += take * level.price
        levels_consumed += 1
        if filled == quantity:
            break
    remaining = quantity - filled
    if filled == 0:
        # A non-crossing limit order remains live; the caller can persist it
        # and retry against a later quote.  A market order with no depth is
        # reported as open so the execution layer can decide whether to retry
        # or reject it explicitly.
        status = "open"
        return FillResult(status, quantity, 0, quantity, None, 0.0, 0.0, 0)
    average = notional / filled
    slippage = abs(average - book.mid_price) / max(book.mid_price, 1e-9) * 10_000.0
    status = "filled" if remaining == 0 else "partially_filled"
    return FillResult(status, quantity, filled, remaining, round(average, 8), round(notional, 8), round(slippage, 8), levels_consumed)


@dataclass(frozen=True)
class HaltDecision:
    halted: bool
    reason: Optional[HaltReason]
    resume_after_ticks: int
    observed_return: float


def evaluate_guardrails(
    previous_close: float,
    candidate_price: float,
    recent_returns: Sequence[float],
    preset: RealismPreset | str = "realistic",
    liquidity_shock: float = 0.0,
) -> HaltDecision:
    """Apply volatility pauses, circuit breakers, and liquidity halts."""

    profile = get_preset(preset) if isinstance(preset, str) else preset
    observed = (float(candidate_price) - float(previous_close)) / max(abs(float(previous_close)), profile.price_floor)
    if abs(observed) >= profile.circuit_breaker_pct:
        return HaltDecision(True, HaltReason.CIRCUIT_BREAKER, 3, observed)
    if abs(observed) >= profile.volatility_pause_pct:
        return HaltDecision(True, HaltReason.VOLATILITY_PAUSE, 1, observed)
    if float(liquidity_shock) >= 0.80:
        return HaltDecision(True, HaltReason.LIQUIDITY_SHOCK, 2, observed)
    return HaltDecision(False, None, 0, observed)


@dataclass(frozen=True)
class FlowSnapshot:
    institutional_flow: float
    insider_flow: float
    retail_flow: float
    net_flow: float
    insider_signal: str


def generate_flows(
    base_seed: int,
    timeline_id: int,
    company_id: int,
    tick_number: int,
    regime: MarketRegime | str,
    sentiment: float,
    liquidity_score: float,
    preset: RealismPreset | str = "realistic",
) -> FlowSnapshot:
    """Generate deterministic institutional, insider, and retail flow."""

    profile = get_preset(preset) if isinstance(preset, str) else preset
    resolved_regime = MarketRegime(regime)
    multipliers = regime_parameters(resolved_regime)
    rng = rng_for(base_seed, timeline_id, company_id, tick_number, "flows")
    scale = max(0.05, float(liquidity_score) / 100.0)
    institutional = rng.gauss(sentiment * profile.institutional_flow_scale * multipliers["drift"], 0.35) * scale
    insider = rng.gauss(sentiment * profile.insider_flow_scale, 0.20) * scale
    retail = rng.gauss(sentiment * 0.35, 0.55)
    net = institutional + insider + retail
    if insider > 0.25:
        signal = "accumulation"
    elif insider < -0.25:
        signal = "distribution"
    else:
        signal = "neutral"
    return FlowSnapshot(
        institutional_flow=round(institutional, 8),
        insider_flow=round(insider, 8),
        retail_flow=round(retail, 8),
        net_flow=round(net, 8),
        insider_signal=signal,
    )


def slippage_bps(
    quantity: int,
    average_daily_volume_shares: float,
    volatility: float,
    spread_bps: float,
    liquidity_score: float,
    preset: RealismPreset | str = "realistic",
) -> float:
    """Estimate square-root market impact plus half-spread cost."""

    profile = get_preset(preset) if isinstance(preset, str) else preset
    participation = max(0.0, float(quantity)) / max(float(average_daily_volume_shares), 1.0)
    impact = max(0.0, float(volatility)) * math.sqrt(participation) * 10_000.0 * profile.market_impact_scale
    illiquidity = 1.0 + (100.0 - max(0.0, min(100.0, float(liquidity_score)))) / 100.0
    return round((max(0.0, float(spread_bps)) / 2.0 + impact) * illiquidity, 8)


@dataclass(frozen=True)
class FundamentalState:
    revenue_growth: float
    operating_margin: float
    earnings_growth: float
    leverage: float
    quality_score: float


def evolve_fundamentals(
    previous: FundamentalState,
    macro_growth: float,
    interest_rate: float,
    sector_rotation: float,
    event_surprise: float,
    seed: int,
    drift_scale: float = 1.0,
) -> FundamentalState:
    """Evolve fundamentals with bounded, deterministic quarterly drift."""

    rng = random.Random(seed)
    macro_effect = (float(macro_growth) - 2.0) / 100.0
    rate_effect = -(float(interest_rate) - 4.0) / 100.0
    revenue = float(previous.revenue_growth) + drift_scale * (macro_effect + 0.25 * sector_rotation + 0.35 * event_surprise) + rng.gauss(0.0, 0.006)
    margin = float(previous.operating_margin) + drift_scale * (0.10 * macro_effect + 0.08 * event_surprise + rate_effect * 0.04) + rng.gauss(0.0, 0.003)
    earnings = float(previous.earnings_growth) + drift_scale * (0.55 * revenue + 0.35 * margin) + rng.gauss(0.0, 0.008)
    leverage = float(previous.leverage) + drift_scale * (-0.04 * margin + 0.02 * max(0.0, -macro_effect)) + rng.gauss(0.0, 0.004)
    quality = float(previous.quality_score) + drift_scale * (revenue * 12.0 + margin * 18.0 - leverage * 4.0) + rng.gauss(0.0, 0.5)
    return FundamentalState(
        revenue_growth=max(-0.80, min(1.50, revenue)),
        operating_margin=max(-1.0, min(1.0, margin)),
        earnings_growth=max(-1.0, min(2.0, earnings)),
        leverage=max(0.0, min(20.0, leverage)),
        quality_score=max(0.0, min(100.0, quality)),
    )


@dataclass(frozen=True)
class EconomicImpact:
    normalized_surprise: float
    market_return_shock: float
    rate_change: float
    inflation_change: float
    employment_change: float
    gdp_change: float


def economic_event_impact(
    event_type: EconomicEventType | str,
    actual: float,
    consensus: float,
    importance: float = 1.0,
) -> EconomicImpact:
    """Translate macro surprises into auditable market shocks."""

    kind = EconomicEventType(event_type)
    denominator = max(abs(float(consensus)), 1.0)
    surprise = max(-3.0, min(3.0, (float(actual) - float(consensus)) / denominator))
    magnitude = max(0.0, min(3.0, float(importance)))
    shock = surprise * magnitude
    if kind == EconomicEventType.INTEREST_RATE:
        return EconomicImpact(surprise, -0.004 * shock, shock, 0.0, 0.0, 0.0)
    if kind == EconomicEventType.INFLATION:
        return EconomicImpact(surprise, -0.003 * shock, 0.0, shock, 0.0, 0.0)
    if kind == EconomicEventType.EMPLOYMENT:
        return EconomicImpact(surprise, 0.002 * shock, 0.0, 0.0, shock, 0.0)
    return EconomicImpact(surprise, 0.003 * shock, 0.0, 0.0, 0.0, shock)


@dataclass(frozen=True)
class CorporateAction:
    action_type: CorporateActionType | str
    ratio: float = 1.0
    cash_per_share: float = 0.0
    settlement_price: Optional[float] = None


@dataclass(frozen=True)
class CorporateActionResult:
    price: float
    shares_outstanding: float
    holder_shares: float
    cash_received: float
    active: bool


def apply_corporate_action(
    action: CorporateAction,
    price: float,
    shares_outstanding: float,
    holder_shares: float = 0.0,
) -> CorporateActionResult:
    """Apply a corporate action without mutating caller-owned state."""

    kind = CorporateActionType(action.action_type)
    current_price = max(0.0, float(price))
    company_shares = max(0.0, float(shares_outstanding))
    owned = max(0.0, float(holder_shares))
    cash = 0.0
    active = True
    ratio = float(action.ratio)
    if kind == CorporateActionType.DIVIDEND:
        current_price = max(0.0, current_price - max(0.0, float(action.cash_per_share)))
        cash = owned * max(0.0, float(action.cash_per_share))
    elif kind == CorporateActionType.SPLIT:
        if ratio <= 0:
            raise ValueError("split ratio must be positive")
        current_price /= ratio
        company_shares *= ratio
        owned *= ratio
    elif kind == CorporateActionType.BUYBACK:
        ratio = max(0.0, min(0.95, ratio))
        company_shares *= 1.0 - ratio
        current_price *= 1.0 + ratio * 0.25
    elif kind == CorporateActionType.MERGER:
        if ratio <= 0:
            raise ValueError("merger exchange ratio must be positive")
        owned *= ratio
        current_price = float(action.settlement_price) if action.settlement_price is not None else current_price
    elif kind == CorporateActionType.IPO:
        current_price = max(0.01, float(action.settlement_price or price))
        company_shares = max(company_shares, 1.0)
    elif kind == CorporateActionType.DELISTING:
        current_price = max(0.0, float(action.settlement_price or 0.0))
        active = False
    return CorporateActionResult(
        price=round(current_price, 8),
        shares_outstanding=round(company_shares, 8),
        holder_shares=round(owned, 8),
        cash_received=round(cash, 8),
        active=active,
    )


def realism_news(
    event_type: str,
    company_name: Optional[str],
    industry_name: Optional[str],
    sentiment: str,
    severity: float,
    seed: int,
) -> tuple[str, str]:
    """Generate a deterministic headline/body for scheduled realism events."""

    subject = company_name or (f"{industry_name} sector" if industry_name else "The market")
    rng = random.Random(seed)
    tones = {
        "positive": ["signals improving conditions", "reports an upside development", "draws fresh investor interest"],
        "negative": ["faces a growing risk", "reports a downside development", "comes under investor pressure"],
        "neutral": ["is in focus as new data arrives", "sees a closely watched update", "draws fresh market attention"],
    }
    tone = rng.choice(tones.get(sentiment, tones["neutral"]))
    headline = f"{subject} {tone}"
    body = (
        f"A simulated {event_type.replace('_', ' ')} event with severity {float(severity):.1f} "
        f"was released into the market timeline. The modeled impact is {sentiment}."
    )
    return headline[:300], body


def next_business_date(value: date) -> date:
    """Advance to the next weekday for event calendars and settlements."""

    result = value + timedelta(days=1)
    while result.weekday() >= 5:
        result += timedelta(days=1)
    return result
