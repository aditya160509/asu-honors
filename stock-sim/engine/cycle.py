"""Section 6.I — Economic cycle state machine and sector factor generation."""

import random

CYCLE_PHASES = ("expansion", "peak", "contraction", "trough")

# transition matrix: phase -> list of (next_phase, probability_weight)
# weights are normalised so each row sums to 1.0.
# Expected average durations (geometric):
#   expansion:   1/(1-0.97) ≈ 33 days, peak: 1/(1-0.85) ≈ 7 days,
#   contraction: 1/(1-0.96) ≈ 25 days, trough: 1/(1-0.80) ≈ 5 days.
# Full cycle ≈ 70 days (~3.5 months); expansions/contractions last ~4-5 weeks each.
CYCLE_TRANSITIONS: dict[str, list[tuple[str, float]]] = {
    "expansion":   [("expansion", 0.97), ("peak", 0.03)],
    "peak":        [("peak", 0.85), ("contraction", 0.15)],
    "contraction": [("contraction", 0.96), ("trough", 0.04)],
    "trough":      [("trough", 0.80), ("expansion", 0.20)],
}

PHASE_MARKET_RETURN: dict[str, float] = {
    "expansion":   0.0004,
    "peak":        0.0001,
    "contraction": -0.0003,
    "trough":      -0.0001,
}

PHASE_GDP_GROWTH: dict[str, float] = {
    "expansion":   3.0,
    "peak":        1.5,
    "contraction": -1.5,
    "trough":      0.5,
}

PHASE_INTEREST_RATE: dict[str, float] = {
    "expansion":   4.5,
    "peak":        5.5,
    "contraction": 3.0,
    "trough":      2.0,
}

PHASE_SENTIMENT: dict[str, float] = {
    "expansion":   0.3,
    "peak":        0.1,
    "contraction": -0.3,
    "trough":      -0.5,
}


def advance_cycle_phase(current_phase: str, rng: random.Random) -> str:
    """Section 6.I — transition to next phase using the stochastic transition matrix."""
    transitions = CYCLE_TRANSITIONS.get(current_phase)
    if transitions is None:
        return "expansion"
    phases, weights = zip(*transitions)
    total = sum(weights)
    normalised = [w / total for w in weights]
    return rng.choices(phases, weights=normalised, k=1)[0]


def compute_cycle_state(
    cycle_phase: str,
    rng: random.Random,
) -> dict[str, float]:
    """Section 6.I — produce market_factor_return and macro indicators for a given phase.

    Returns dict with keys:
        market_factor_return, gdp_growth, interest_rate, market_sentiment
    Each has a small random jitter applied.
    """
    base_mfr = PHASE_MARKET_RETURN[cycle_phase]
    return {
        "market_factor_return": round(base_mfr + rng.gauss(0, 0.0005), 6),
        "gdp_growth": round(PHASE_GDP_GROWTH[cycle_phase] + rng.gauss(0, 0.3), 4),
        "interest_rate": round(PHASE_INTEREST_RATE[cycle_phase] + rng.gauss(0, 0.1), 4),
        "market_sentiment": round(PHASE_SENTIMENT[cycle_phase] + rng.gauss(0, 0.05), 4),
    }


def generate_sector_shocks(
    industry_ids: list[int],
    cycle_sensitivity_map: dict[int, float],
    sector_beta_default_map: dict[int, float],
    market_factor_return: float,
    rng: random.Random,
) -> dict[int, float]:
    """Section 6.I — draw sector factor return F^s per industry.

    F^s = cycle_sensitivity * market_factor_return + sector_idiosyncratic_noise
    """
    shocks: dict[int, float] = {}
    for ind_id in industry_ids:
        sens = cycle_sensitivity_map.get(ind_id, 1.0)
        base = sens * market_factor_return
        idiosyncratic = rng.gauss(0, 0.002)
        shocks[ind_id] = round(base + idiosyncratic, 6)
    return shocks
