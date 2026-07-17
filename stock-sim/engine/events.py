"""Section 6.N — applying market event effect profiles to drivers and factor scores."""

import math


def decay(rho: float, days_elapsed: int) -> float:
    """Section 6.N — exponential decay factor exp(-rho * days_elapsed)."""
    return math.exp(-rho * days_elapsed)


def _clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def apply_effect_to_drivers(
    driver_values: dict[str, float],
    effect_profile: dict[str, float],
    severity: float,
    rho: float,
    days_elapsed: int,
) -> dict[str, float]:
    """Section 6.N — add a decayed, severity-scaled effect onto each targeted driver.

    effect_profile maps driver_key -> base effect magnitude (signed).
    Returns a new dict; does not mutate the input.
    All driver values are clamped to [-1, 1] after applying effects.
    """
    decay_factor = decay(rho, days_elapsed)
    updated = dict(driver_values)
    normalized_severity = severity / 100.0
    for driver_key, base_effect in effect_profile.items():
        delta = base_effect * normalized_severity * decay_factor
        updated[driver_key] = _clamp(updated.get(driver_key, 0.0) + delta)
    return updated


def apply_effect_to_factor_scores(
    factor_scores: dict[str, float],
    effect_profile: dict[str, float],
    severity: float,
    rho: float,
    days_elapsed: int,
    score_min: float = 0.0,
    score_max: float = 100.0,
) -> dict[str, float]:
    """Section 6.N — same decayed-effect application, clamped to the valid score range."""
    decay_factor = decay(rho, days_elapsed)
    updated = dict(factor_scores)
    normalized_severity = severity / 100.0
    for factor_key, base_effect in effect_profile.items():
        delta = base_effect * normalized_severity * decay_factor
        new_value = updated.get(factor_key, 0.0) + delta
        updated[factor_key] = max(score_min, min(score_max, new_value))
    return updated
