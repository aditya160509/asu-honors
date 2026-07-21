"""Section 6.A-6.C — cross-sectional percentile scoring and composite scores."""

import numpy as np

DEFAULT_TOP_LEVEL_WEIGHTS = {
    "management_quality": 0.25,
    "moat_score": 0.25,
    "financial_quality": 0.20,
    "fcf_quality": 0.10,
    "growth_potential": 0.20,
}


def percentile_rank_scores(raw_values: np.ndarray, lower_is_better: bool = False) -> np.ndarray:
    """Section 6.A — cross-sectional percentile rank, scaled to 0-100.

    Ties receive the average rank of the tied group (average-rank method).
    """
    values = np.asarray(raw_values, dtype=float)
    n = values.size
    if n == 0:
        return np.array([], dtype=float)
    if n == 1:
        return np.array([50.0])

    order = values.argsort()
    ranks = np.empty(n, dtype=float)
    sorted_values = values[order]

    i = 0
    while i < n:
        j = i
        while j + 1 < n and sorted_values[j + 1] == sorted_values[i]:
            j += 1
        avg_rank = (i + j) / 2.0
        ranks[order[i : j + 1]] = avg_rank
        i = j + 1

    scores = ranks / (n - 1) * 100.0
    if lower_is_better:
        scores = 100.0 - scores
    return scores


def financial_quality_composite(
    subscores: dict[str, float],
    industry_pillar_weights: dict[str, float],
    subfactor_pillar_map: dict[str, str],
) -> float:
    """Section 6.B — FQ = sum over pillars of (pillar_weight * mean of that pillar's subscores)."""
    pillar_values: dict[str, list[float]] = {}
    for subfactor_key, score in subscores.items():
        pillar = subfactor_pillar_map[subfactor_key]
        pillar_values.setdefault(pillar, []).append(score)

    total = 0.0
    for pillar, weight in industry_pillar_weights.items():
        scores_in_pillar = pillar_values.get(pillar, [])
        if not scores_in_pillar:
            continue
        pillar_mean = sum(scores_in_pillar) / len(scores_in_pillar)
        total += weight * pillar_mean
    return total


def moat_composite(subscores: dict[str, float], weights: dict[str, float]) -> float:
    """Section 6.C precursor — Moat Score = weighted average of moat subfactors."""
    weighted_sum = sum(weights[key] * score for key, score in subscores.items())
    weight_total = sum(weights[key] for key in subscores)
    if weight_total == 0:
        return 0.0
    return weighted_sum / weight_total


def intrinsic_score(
    mgmt: float,
    moat: float,
    fq: float,
    fcfq: float,
    growth: float,
    weights: dict[str, float] = DEFAULT_TOP_LEVEL_WEIGHTS,
) -> float:
    """Section 6.C — IntrinsicScore = weighted sum of the 5 top-level factors."""
    return (
        weights["management_quality"] * mgmt
        + weights["moat_score"] * moat
        + weights["financial_quality"] * fq
        + weights["fcf_quality"] * fcfq
        + weights["growth_potential"] * growth
    )
