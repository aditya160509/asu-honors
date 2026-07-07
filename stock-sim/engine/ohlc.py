"""Section 6.O — OHLC intraday price synthesis around the daily close move."""

import random


def synthesize_ohlc(
    prev_close: float,
    current_close: float,
    rng: random.Random,
    intraday_volatility: float = 0.015,
) -> dict[str, float]:
    """Section 6.O — synthesize open/high/low from consecutive daily closes.

    open:  prev_close perturbed by a small random walk (mean 0, std intraday_volatility/2)
    high:  max(open, close) * (1 + abs(w) * intraday_volatility) where w ~ N(0,1)
    low:   min(open, close) * (1 - abs(w) * intraday_volatility)
    close: the given current_close

    All values are clamped to >= 0.01.
    """
    open_perturbation = rng.gauss(0, intraday_volatility / 2)
    o = prev_close * (1 + open_perturbation)

    w = rng.gauss(0, 1)
    half_range = abs(w) * intraday_volatility
    h = max(o, current_close) * (1 + half_range)
    l = min(o, current_close) * (1 - half_range)

    return {
        "open": max(0.01, round(o, 4)),
        "high": max(0.01, round(h, 4)),
        "low": max(0.01, round(l, 4)),
        "close": max(0.01, round(current_close, 4)),
    }


def apply_circuit_breaker(
    price: float,
    prev_close: float,
    r_cap: float = 0.20,
    p_min: float = 0.01,
) -> float:
    """Section 6.J — Apply per-day circuit breaker |r| <= r_cap and floor P >= P_min."""
    if prev_close > 0:
        ret = (price - prev_close) / prev_close
        if abs(ret) > r_cap:
            clipped_ret = r_cap if ret > 0 else -r_cap
            price = prev_close * (1 + clipped_ret)
    return max(price, p_min)
