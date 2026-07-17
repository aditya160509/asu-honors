"""Section 6.I-6.J — Ornstein-Uhlenbeck mean-reversion core and volatility sizing."""

import numpy as np


def company_volatility(sigma_ind: float, market_cap: float, leverage: float) -> float:
    """Section 6.G — company-specific daily volatility = sector_base × size_factor × leverage_factor.

    The orchestrator's :func:`~engine.orchestrator.run_tick` overrides this formula
    inline with a different parameterisation (tanh-based size factor, capped
    leverage).  Both produce the same directional behaviour (smaller + more
    leveraged → more volatile); the inline version is the production path, this
    function is retained for unit-test compatibility.
    """
    f_size = (1e9 / max(market_cap, 1)) ** 0.25
    f_lev = 1 + max(leverage, 0)
    return sigma_ind * f_size * f_lev


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
