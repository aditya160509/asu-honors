"""Section 6.K-6.M — order imbalance, volume, liquidity score, and Kyle-lambda price impact."""

import math
import random
from typing import Optional


def order_imbalance(demand: float, supply: float) -> float:
    """Section 6.K — order imbalance = (demand - supply) / (demand + supply), 0 if both are 0."""
    total = demand + supply
    if total == 0:
        return 0.0
    return (demand - supply) / total


def demand_from_pressure(base_volume: float, price_pressure: float, sensitivity: float) -> float:
    """Section 6.K — demand scales up with positive price pressure."""
    return base_volume * max(1.0, 1 + sensitivity * price_pressure)


def supply_from_pressure(base_volume: float, price_pressure: float, sensitivity: float) -> float:
    """Section 6.K — supply scales up with negative price pressure."""
    return base_volume * max(1.0, 1 - sensitivity * price_pressure)


def daily_volume(base_volume: float, free_float_pct: float, imbalance: float) -> float:
    """Section 6.L — traded volume driven by float and how one-sided the order book is."""
    return base_volume * free_float_pct * (1 + abs(imbalance))


def compute_volume_prd(
    market_cap: float,
    free_float_pct: float,
    abs_return: float,
    news_severity_delta: float,
    is_earnings_day: bool,
    turnover_rate: float = 0.001,
    coeff_return: float = 0.5,
    coeff_news: float = 0.3,
    coeff_earnings: float = 0.2,
    noise_sigma: float = 0.1,
    rng: Optional[random.Random] = None,
) -> int:
    """Section 6.L — Volume = BaseFloatTurnover × (1 + a·|r| + b·|d_NS| + c·EarningsDayFlag) × LogNormalNoise.

    BaseFloatTurnover = market_cap * free_float_pct * turnover_rate.
    Returns minimum 1000 shares.
    """
    base = market_cap * free_float_pct * turnover_rate
    multiplier = 1.0 + coeff_return * abs_return + coeff_news * news_severity_delta
    if is_earnings_day:
        multiplier += coeff_earnings
    if rng is not None and noise_sigma > 0:
        multiplier *= math.exp(rng.gauss(0, noise_sigma))
    vol = int(base * multiplier)
    return max(1000, vol)


def market_liquidity_score(free_float_pct: float, avg_daily_volume: float, market_cap: float) -> float:
    """Section 6.M — liquidity score = 100 * free_float_pct * (avg_daily_volume * price_proxy / market_cap), clamped [0,100].

    price_proxy is folded into avg_daily_volume upstream (i.e. avg_daily_volume is
    expressed in currency turnover, not share count) to keep this a pure ratio.
    """
    if market_cap <= 0:
        return 0.0
    turnover_ratio = avg_daily_volume / market_cap
    score = 100.0 * free_float_pct * turnover_ratio
    return max(0.0, min(100.0, score))


def bid_ask_spread(base_spread_bps: float, liquidity_score: float) -> float:
    """Section 6.M — spread widens as liquidity score falls; liquidity_score in [0,100]."""
    illiquidity = (100.0 - liquidity_score) / 100.0
    return base_spread_bps * (1 + illiquidity)


def kyle_lambda_impact(order_size: float, kyle_lambda: float) -> float:
    """Section 6.M — Kyle-lambda linear price impact: delta_price = lambda * order_size."""
    return kyle_lambda * order_size


def kyle_lambda_from_liquidity(liquidity_score: float, scale: float = 1.0) -> float:
    """Section 6.M — lambda decreases as liquidity score increases (more liquid => less impact per share)."""
    return scale / (1.0 + liquidity_score)


def trade_price_with_impact(mid_price: float, order_size: float, kyle_lambda: float, side: str) -> float:
    """Section 6.M — executed price = mid +/- Kyle-lambda impact depending on buy/sell side."""
    impact = kyle_lambda_impact(abs(order_size), kyle_lambda)
    sign = 1.0 if side == "buy" else -1.0
    return mid_price * (1 + sign * impact)
