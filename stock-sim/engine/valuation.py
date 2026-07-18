"""Section 6.D-6.F — PEG-based fair P/E, intrinsic value, and IV's daily drift.

**Revised 2026-07-10 — PEG-based valuation (supersedes the pure P/E x Q(S)
approach).** Fair PE is no longer industry-PE x a quality multiplier applied
directly to a market PE anchor. It is now built up from a industry-neutral
**PEG** (P/E-to-Growth) ratio, so market valuation multiples never directly
enter the intrinsic-value calculation — only business quality and a
company's own estimated sustainable long-term growth rate do:

    Financial Quality Score S (0-100, = IntrinsicScore, Section 6.C)
        -> Quality Multiplier M(S)              (quality_multiplier)
        -> Fair PEG = NeutralIndustryPEG x M(S)  (fair_peg)
        -> Fair P/E = Fair PEG x LongTermGrowthRate%  (fair_pe_from_peg)
        -> Intrinsic Value = EPS x Fair P/E      (intrinsic_value_per_share)

`NeutralIndustryPEG` is the long-term fair PEG a normal, ~S=60 business
deserves in its industry — a configurable per-industry constant, NOT a
market-observed average. `LongTermGrowthRate` is the company's own estimated
sustainable annual EPS growth (as a percentage number, e.g. 18.0 for 18%),
not a market growth expectation.
"""

import math

DEFAULT_M_MIN = 0.6
DEFAULT_M_MAX = 2.0
DEFAULT_M_STEEPNESS = 0.11
DEFAULT_M_INFLECTION = 60.0

DEFAULT_GROWTH_RATE_MIN = 2.0
DEFAULT_GROWTH_RATE_MAX = 60.0
DEFAULT_PE_MIN = 8.0


def quality_multiplier(
    intrinsic_score: float,
    m_min: float = DEFAULT_M_MIN,
    m_max: float = DEFAULT_M_MAX,
    k: float = DEFAULT_M_STEEPNESS,
    c: float = DEFAULT_M_INFLECTION,
) -> float:
    """M(S) = m_min + (m_max - m_min) / (1 + exp(-k*(S - c))).

    S is the 0-100 Financial Quality Score (= IntrinsicScore, Section 6.C —
    already combines growth, moat, financial quality, management, capital
    allocation, and cash flow quality, so none of those are re-applied
    here). Diminishing marginal valuation: S in [0,20] barely moves the
    multiplier (still fundamentally weak businesses); S in [20,70] drives
    rapid re-rating (the business is becoming clearly investable); S in
    [70,100] keeps earning a premium but at a decelerating rate (the market
    already prices it as high quality). Default range ~0.6-2.0.
    """
    return m_min + (m_max - m_min) / (1.0 + math.exp(-k * (intrinsic_score - c)))


def fair_peg(
    neutral_industry_peg: float,
    intrinsic_score: float,
    m_min: float = DEFAULT_M_MIN,
    m_max: float = DEFAULT_M_MAX,
    k: float = DEFAULT_M_STEEPNESS,
    c: float = DEFAULT_M_INFLECTION,
) -> float:
    """Fair PEG = NeutralIndustryPEG x M(FinancialQualityScore).

    NeutralIndustryPEG is the long-term fair PEG a normal (S~=60) business
    deserves in its industry — a configurable per-industry constant, not a
    market-observed multiple.
    """
    return neutral_industry_peg * quality_multiplier(intrinsic_score, m_min, m_max, k, c)


def fair_pe_from_peg(
    peg: float,
    long_term_growth_rate_pct: float,
    pe_min: float = DEFAULT_PE_MIN,
) -> float:
    """Fair P/E = baseline + Fair PEG x LongTermGrowthRate%, floored at pe_min.

    The PEG model breaks down at low growth rates — a company growing 2%/yr
    would get PE = 0.68 x 2.0 = 1.4x, which is nonsense. The baseline floor
    (default 8.0x) ensures existing earnings have value independent of growth.
    """
    return max(pe_min, peg * long_term_growth_rate_pct)


def growth_score_to_rate(
    growth_potential: float,
    rate_min: float = DEFAULT_GROWTH_RATE_MIN,
    rate_max: float = DEFAULT_GROWTH_RATE_MAX,
) -> float:
    """Linear map of the 0-100 growth_potential score to an estimated annual EPS growth rate (%).

    growth_potential=0 -> rate_min (~2%/yr, mature/declining); 100 ->
    rate_max (~60%/yr, best-in-class hypergrowth). This is a fallback used
    only where a company-specific, financials-and-industry-derived growth
    estimate isn't available; prefer deriving the rate directly from a
    company's own trailing fundamentals and industry context where possible
    (see docs/valuation_dry_run.py for a worked real-company example).
    """
    growth_potential = max(0.0, min(100.0, growth_potential))
    return rate_min + (rate_max - rate_min) * (growth_potential / 100.0)


def compute_growth_potential_from_financials(
    income_statements: list,
    rate_min: float = DEFAULT_GROWTH_RATE_MIN,
    rate_max: float = DEFAULT_GROWTH_RATE_MAX,
) -> float:
    """Compute growth_potential score (0-100) from a company's trailing income statements.

    Uses median per-period EPS and revenue growth rates to dampen single-period
    noise, weighted 40/60 (EPS/revenue) since revenue is more stable. Revenue
    alone produces a conservative baseline even when EPS is noisy.
    """
    if len(income_statements) < 2:
        return 50.0

    incs = sorted(income_statements, key=lambda x: x.fiscal_period)

    eps_rates = []
    rev_rates = []
    for i in range(1, len(incs)):
        eps_prev = float(incs[i - 1].eps)
        eps_curr = float(incs[i].eps)
        if eps_prev > 0 and eps_curr > 0:
            eps_rates.append(eps_curr / eps_prev - 1.0)

        rev_prev = float(incs[i - 1].revenue)
        rev_curr = float(incs[i].revenue)
        if rev_prev > 0 and rev_curr > 0:
            rev_rates.append(rev_curr / rev_prev - 1.0)

    eps_rates.sort()
    rev_rates.sort()

    eps_growth = eps_rates[len(eps_rates) // 2] if eps_rates else 0.0
    rev_growth = rev_rates[len(rev_rates) // 2] if rev_rates else 0.0

    eps_growth = max(-0.5, min(1.5, eps_growth))
    rev_growth = max(-0.5, min(1.5, rev_growth))

    growth_rate = (0.4 * eps_growth + 0.6 * rev_growth) * 100.0
    growth_rate = max(rate_min, min(rate_max, growth_rate))

    score = (growth_rate - rate_min) / (rate_max - rate_min) * 100.0
    return max(0.0, min(100.0, score))


def intrinsic_value_per_share(fair_pe: float, eps: float) -> float:
    """Section 6.E — Intrinsic Value per Share = FairPE * EPS."""
    return fair_pe * eps


def drift_iv(iv: float, expected_annual_growth: float, trading_days_per_year: int = 252) -> float:
    """Section 6.F — daily drift of intrinsic value toward its annual growth rate."""
    daily_growth = (1 + expected_annual_growth / 100.0) ** (1 / trading_days_per_year) - 1
    return iv * (1 + daily_growth)
