"""Section 6.G-6.H — the 7 price drivers and their composite pressure."""

import math
from typing import Literal

DEFAULT_DRIVER_WEIGHTS = {
    "value_opportunity": 0.20,
    "earnings_surprise": 0.15,
    "news_severity": 0.15,
    "economic_outlook": 0.10,
    "guidance": 0.15,
    "technical_momentum": 0.10,
    "institutional_buying": 0.15,
}


def _clamp(x: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def value_opportunity(iv: float, price: float) -> float:
    """Section 6.G — VO = (IV - Price) / Price, clamped to [-1, 1]."""
    return _clamp((iv - price) / price)


def earnings_surprise(actual_eps: float, consensus_eps: float, days_since: int, decay_rate: float) -> float:
    """Section 6.G — ES = ((actual-consensus)/|consensus|) * exp(-decay_rate * days_since), clamped."""
    if consensus_eps == 0:
        return 0.0
    surprise = (actual_eps - consensus_eps) / abs(consensus_eps)
    decayed = surprise * math.exp(-decay_rate * days_since)
    return _clamp(decayed)


def news_severity(active_events: list[dict], sim_day: int, decay_rate: float) -> float:
    """Section 6.G — NS = sum of each active event's signed severity, decayed by elapsed days, clamped."""
    total = 0.0
    for event in active_events:
        days_elapsed = sim_day - event["start_day"]
        total += event["severity"] * math.exp(-decay_rate * days_elapsed)
    return _clamp(total)


def economic_outlook(cycle_signal: float) -> float:
    """Section 6.G — EO = clamp(cycle_signal, -1, 1)."""
    return _clamp(cycle_signal)


def guidance(direction: Literal["raised", "maintained", "cut"], jump_size: float, days_since: int, decay_rate: float) -> float:
    """Section 6.G — G = signed jump_size (raised=+1, cut=-1, maintained=0) decayed over time, clamped."""
    sign = {"raised": 1.0, "maintained": 0.0, "cut": -1.0}[direction]
    decayed = sign * jump_size * math.exp(-decay_rate * days_since)
    return _clamp(decayed)


def technical_momentum(price: float, moving_average: float, k_m: float) -> float:
    """Section 6.G — TM = tanh(k_m * (price - moving_average) / moving_average)."""
    return math.tanh(k_m * (price - moving_average) / moving_average)


def institutional_buying(net_flow_signal: float) -> float:
    """Section 6.G — IB = clamp(net_flow_signal, -1, 1)."""
    return _clamp(net_flow_signal)


def composite_price_pressure(drivers: dict[str, float], weights: dict[str, float] = DEFAULT_DRIVER_WEIGHTS) -> float:
    """Section 6.H — weighted sum of the 7 price drivers (VO/ES/NS/EO/G/TM/IB)."""
    return sum(weights.get(key, 0) * value for key, value in drivers.items())
