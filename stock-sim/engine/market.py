"""Section 6.I-6.J — Ornstein-Uhlenbeck mean-reversion core and volatility sizing."""

from typing import Callable, Optional

import numpy as np


def update_log_gap(
    y_t: float,
    theta: float,
    price_pressure: float,
    beta_m: float,
    f_m: float,
    beta_s: float,
    f_s: float,
    sigma: float,
    epsilon: float,
) -> float:
    """Section 6.J — y_{t+1} = y_t - theta*y_t + price_pressure + beta_m*F_m + beta_s*F_s + sigma*epsilon.

    y is the log gap between price and intrinsic value; theta pulls it back to 0.
    With y_t=0 and all shocks/pressure zero, y_{t+1}=0 (fixed point).
    """
    return y_t - theta * y_t + price_pressure + beta_m * f_m + beta_s * f_s + sigma * epsilon


def price_from_gap(iv: float, y: float) -> float:
    """Section 6.J — Price = IV * exp(y)."""
    return iv * np.exp(y)


def _default_size_factor(market_cap: float, ref_cap: float = 1e9) -> float:
    return (ref_cap / max(market_cap, 1.0)) ** 0.25


def _default_leverage_factor(leverage: float) -> float:
    return 1.0 + max(leverage, 0.0)


def company_volatility(
    sigma_ind: float,
    market_cap: float,
    leverage: float,
    f_size_fn: Optional[Callable[[float], float]] = None,
    f_lev_fn: Optional[Callable[[float], float]] = None,
) -> float:
    """Section 6.I — company volatility = sigma_ind * f_size(market_cap) * f_lev(leverage).

    f_size decreases with market cap (smaller caps are more volatile),
    normalised so a 1B cap company gets factor 1.0;
    f_lev increases with leverage. Defaults are sane placeholders when
    industry-specific curves aren't supplied.
    """
    size_fn = f_size_fn or _default_size_factor
    lev_fn = f_lev_fn or _default_leverage_factor
    return sigma_ind * size_fn(market_cap) * lev_fn(leverage)


def update_market_tick(
    y: np.ndarray,
    theta: np.ndarray,
    price_pressure: np.ndarray,
    beta_m: np.ndarray,
    f_m: float,
    beta_s: np.ndarray,
    f_s: np.ndarray,
    sigma: np.ndarray,
    epsilon: np.ndarray,
) -> np.ndarray:
    """Section 6.J / Section 8 — vectorized OU step for an entire universe of companies in one call."""
    return y - theta * y + price_pressure + beta_m * f_m + beta_s * f_s + sigma * epsilon
