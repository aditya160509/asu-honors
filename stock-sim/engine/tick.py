"""Section 6.O — single simulation tick orchestrator, a pure function of its inputs."""

from dataclasses import dataclass, field

import numpy as np

from engine.drivers import composite_price_pressure
from engine.market import price_from_gap, update_market_tick


@dataclass(frozen=True)
class CompanyTickInput:
    company_id: int
    y: float
    theta: float
    driver_values: dict[str, float]
    driver_weights: dict[str, float]
    beta_market: float
    beta_sector: float
    sector_factor_return: float
    sigma: float
    epsilon: float
    intrinsic_value: float


@dataclass(frozen=True)
class CompanyTickOutput:
    company_id: int
    y: float
    price: float
    price_pressure: float


@dataclass(frozen=True)
class TickState:
    sim_day: int
    market_factor_return: float
    companies: tuple[CompanyTickInput, ...] = field(default_factory=tuple)
    pressure_scale: float = 1.0


@dataclass(frozen=True)
class TickResult:
    sim_day: int
    outputs: tuple[CompanyTickOutput, ...]


def run_tick(state: TickState, k_drift: float = 0.03) -> TickResult:
    """Section 6.O — advance every company one sim-day via a single vectorized OU update."""
    n = len(state.companies)
    if n == 0:
        return TickResult(sim_day=state.sim_day + 1, outputs=())

    # composite_price_pressure sums 7 drivers each clamped to [-1, 1], so it can
    # reach magnitude ~1.0 -- far larger than a plausible single-day return.
    # pressure_scale converts that composite score into an actual daily log-return
    # contribution; without it, whenever several drivers align (e.g. every
    # company during the same cycle phase) the raw move overshoots the circuit
    # breaker's r_cap and gets clipped identically for every company, producing
    # lockstep price action regardless of company-specific fundamentals.
    price_pressures = state.pressure_scale * np.array(
        [composite_price_pressure(c.driver_values, c.driver_weights) for c in state.companies]
    )
    y = np.array([c.y for c in state.companies])
    theta = np.array([c.theta for c in state.companies])
    beta_m = np.array([c.beta_market for c in state.companies])
    beta_s = np.array([c.beta_sector for c in state.companies])
    f_s = np.array([c.sector_factor_return for c in state.companies])
    sigma = np.array([c.sigma for c in state.companies])
    epsilon = np.array([c.epsilon for c in state.companies])
    iv = np.array([c.intrinsic_value for c in state.companies])

    new_y = update_market_tick(
        y=y,
        theta=theta,
        price_pressure=price_pressures,
        beta_m=beta_m,
        f_m=state.market_factor_return,
        beta_s=beta_s,
        f_s=f_s,
        sigma=sigma,
        epsilon=epsilon,
        k_drift=k_drift,
    )
    new_price = price_from_gap(iv, new_y)

    outputs = tuple(
        CompanyTickOutput(
            company_id=c.company_id,
            y=float(new_y[i]),
            price=float(new_price[i]),
            price_pressure=float(price_pressures[i]),
        )
        for i, c in enumerate(state.companies)
    )
    return TickResult(sim_day=state.sim_day + 1, outputs=outputs)
