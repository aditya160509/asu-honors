"""Section 6.D-6.F — fair P/E via the logistic quality multiplier, intrinsic value, and its daily drift."""

import math

DEFAULT_Q_MIN = 0.30
DEFAULT_Q_MAX = 5.00
DEFAULT_Q_STEEPNESS = 0.12
DEFAULT_Q_INFLECTION = 60.0


def quality_multiplier(
    intrinsic_score: float,
    q_min: float = DEFAULT_Q_MIN,
    q_max: float = DEFAULT_Q_MAX,
    k: float = DEFAULT_Q_STEEPNESS,
    c: float = DEFAULT_Q_INFLECTION,
) -> float:
    """Q(S) = q_min + (q_max - q_min) / (1 + exp(-k*(S - c))).

    S is the 0-100 IntrinsicScore composite (Section 6.C — already combines
    growth, moat, financial quality, management, and FCF quality). The
    logistic shape encodes diminishing marginal valuation: below the
    inflection point c, quality improvements barely move the multiplier
    (businesses stay near q_min); crossing c is where investors start
    paying up rapidly; above it the premium flattens out approaching q_max.
    """
    return q_min + (q_max - q_min) / (1.0 + math.exp(-k * (intrinsic_score - c)))


def fair_pe(
    pe0: float,
    intrinsic_score: float,
    pe_min: float,
    pe_max: float,
    q_min: float = DEFAULT_Q_MIN,
    q_max: float = DEFAULT_Q_MAX,
    k: float = DEFAULT_Q_STEEPNESS,
    c: float = DEFAULT_Q_INFLECTION,
) -> float:
    """Section 6.D — Fair PE = PE_industry * Q(IntrinsicScore), clamped to [pe_min, pe_max].

    PE_industry should be the industry's median (or cycle-normalized median)
    P/E per the design note in the spec, to avoid a few richly-valued
    outliers skewing the baseline every company is measured against.
    """
    raw = pe0 * quality_multiplier(intrinsic_score, q_min, q_max, k, c)
    return max(pe_min, min(pe_max, raw))


def intrinsic_value_per_share(fair_pe: float, eps: float) -> float:
    """Section 6.E — Intrinsic Value per Share = FairPE * EPS."""
    return fair_pe * eps


def drift_iv(iv: float, expected_annual_growth: float, trading_days_per_year: int = 252) -> float:
    """Section 6.F — daily drift of intrinsic value toward its annual growth rate."""
    daily_growth = (1 + expected_annual_growth) ** (1 / trading_days_per_year) - 1
    return iv * (1 + daily_growth)
