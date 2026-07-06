"""Section 6.K-6.M — order imbalance, volume, liquidity score, and Kyle-lambda price impact."""

import math


def order_imbalance(demand: float, supply: float) -> float:
    """Section 6.K — order imbalance = (demand - supply) / (demand + supply), 0 if both are 0."""
    total = demand + supply
    if total == 0:
        return 0.0
    return (demand - supply) / total


def demand_from_pressure(base_volume: float, price_pressure: float, sensitivity: float) -> float:
    """Section 6.K — demand scales up with positive price pressure."""
    return base_volume * max(0.0, 1 + sensitivity * price_pressure)


def supply_from_pressure(base_volume: float, price_pressure: float, sensitivity: float) -> float:
    """Section 6.K — supply scales up with negative price pressure."""
    return base_volume * max(0.0, 1 - sensitivity * price_pressure)


def daily_volume(base_volume: float, free_float_pct: float, imbalance: float) -> float:
    """Section 6.L — traded volume driven by float and how one-sided the order book is."""
    return base_volume * free_float_pct * (1 + abs(imbalance))


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
