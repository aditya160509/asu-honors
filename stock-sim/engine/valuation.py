"""Section 6.D-6.F — fair P/E, intrinsic value, and its daily drift."""


def fair_pe(
    pe0: float,
    intrinsic_score: float,
    growth_score: float,
    beta_pe: float,
    beta_g: float,
    pe_min: float,
    pe_max: float,
) -> float:
    """Section 6.D — Fair PE = PE0 * (1 + beta_pe*(IS-50)/50) * (1 + beta_g*(GS-50)/50), clamped to [pe_min, pe_max].

    At IntrinsicScore=50 and GrowthScore=50 both quality/growth terms are zero,
    so FairPE reduces to exactly PE0 (the industry baseline).
    """
    quality_term = 1 + beta_pe * (intrinsic_score - 50) / 50
    growth_term = 1 + beta_g * (growth_score - 50) / 50
    raw = pe0 * quality_term * growth_term
    return max(pe_min, min(pe_max, raw))


def intrinsic_value_per_share(fair_pe: float, eps: float) -> float:
    """Section 6.E — Intrinsic Value per Share = FairPE * EPS."""
    return fair_pe * eps


def drift_iv(iv: float, expected_annual_growth: float, trading_days_per_year: int = 252) -> float:
    """Section 6.F — daily drift of intrinsic value toward its annual growth rate."""
    daily_growth = (1 + expected_annual_growth) ** (1 / trading_days_per_year) - 1
    return iv * (1 + daily_growth)
