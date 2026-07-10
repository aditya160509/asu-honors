"""Standalone dry-run of the PEG-based Q(S)/M(S) valuation pipeline (Section
6.D, revised 2026-07-10) with hand-picked sample companies (no database),
plus a real-world sanity check against three real NSE-listed companies:
Sun Pharma, Avenue Supermarts (DMart), and TCS.

Financial Statements -> Financial Quality Score (0-100) -> Quality Multiplier
M(S) -> Neutral Industry PEG -> Fair PEG -> Long-Term Growth Rate -> Fair
P/E -> Current EPS -> Intrinsic Value.

Run: python docs/valuation_dry_run.py
"""

from engine.scoring import intrinsic_score
from engine.valuation import fair_pe_from_peg, fair_peg, intrinsic_value_per_share, quality_multiplier

# Neutral Industry PEG values as specified (Section 6.D).
NEUTRAL_INDUSTRY_PEGS = {
    "Banking & Financial Services": 0.90,
    "Information Technology / Software": 1.40,
    "Pharmaceuticals & Healthcare": 1.50,
    "FMCG / Consumer Staples": 1.60,
    "Automobiles & Auto Components": 1.00,
    "Energy (Oil & Gas)": 0.70,
    "Utilities (Power/Gas/Water)": 0.80,
    "Metals & Mining": 0.60,
    "Construction & Infrastructure": 0.90,
    "Real Estate": 0.80,
    "Telecommunications": 1.00,
    "Retail & E-commerce": 1.40,
    "Industrials & Capital Goods": 1.10,
    "Chemicals": 1.20,
    "Media & Entertainment": 1.20,
}

# Archetype companies spanning the quality spectrum. Sub-scores are
# hand-picked (not computed from statements) purely to exercise the
# M(S)-based valuation step in isolation.
COMPANIES = [
    {
        "name": "Weak Co (commodity, indebted, no moat)",
        "management_quality": 35, "moat_score": 20, "financial_quality": 30,
        "fcf_quality": 25, "growth_potential": 40,
        "industry": "Metals & Mining", "growth_rate_pct": 6.0, "eps": 2.0,
    },
    {
        "name": "Average Co (decent, unremarkable)",
        "management_quality": 55, "moat_score": 50, "financial_quality": 55,
        "fcf_quality": 50, "growth_potential": 60,
        "industry": "Industrials & Capital Goods", "growth_rate_pct": 12.0, "eps": 5.0,
    },
    {
        "name": "Compounder Co (strong moat, high ROCE, low debt)",
        "management_quality": 85, "moat_score": 90, "financial_quality": 88,
        "fcf_quality": 85, "growth_potential": 75,
        "industry": "FMCG / Consumer Staples", "growth_rate_pct": 16.0, "eps": 10.0,
    },
]


def _valuation_row(name: str, s: float, industry: str, growth_rate_pct: float, eps: float) -> dict:
    neutral_peg = NEUTRAL_INDUSTRY_PEGS[industry]
    m = quality_multiplier(s)
    peg = fair_peg(neutral_peg, s)
    fpe = fair_pe_from_peg(peg, growth_rate_pct)
    iv = intrinsic_value_per_share(fpe, eps)
    return dict(name=name, s=s, industry=industry, neutral_peg=neutral_peg, m=m,
                peg=peg, growth_rate_pct=growth_rate_pct, fpe=fpe, eps=eps, iv=iv)


def _print_row(r: dict) -> None:
    print(f"{r['name']}")
    print(f"  Industry: {r['industry']}  (Neutral PEG {r['neutral_peg']:.2f})")
    print(f"  Financial Quality Score S = {r['s']:.2f}")
    print(f"  Quality Multiplier M(S)   = {r['m']:.4f}")
    print(f"  Fair PEG                  = {r['peg']:.4f}")
    print(f"  Long-Term Growth Rate     = {r['growth_rate_pct']:.1f}%")
    print(f"  Fair P/E                  = {r['fpe']:.2f}")
    print(f"  EPS                       = {r['eps']:.2f}")
    print(f"  Intrinsic Value           = {r['iv']:.2f}")
    print()


def archetype_case() -> None:
    print("=" * 100)
    print("Archetype companies (hand-picked scores)")
    print("=" * 100)
    prev_m = 0.0
    for c in COMPANIES:
        s = intrinsic_score(
            c["management_quality"], c["moat_score"], c["financial_quality"],
            c["fcf_quality"], c["growth_potential"],
        )
        row = _valuation_row(c["name"], s, c["industry"], c["growth_rate_pct"], c["eps"])
        _print_row(row)
        assert row["m"] >= prev_m, "M(S) must be monotonically non-decreasing"
        assert 0.6 <= row["m"] <= 2.0, "M(S) must stay within [0.6, 2.0]"
        prev_m = row["m"]

    print("Sanity checks:")
    print(f"  M(0)   = {quality_multiplier(0):.4f}  (should hug M_min=0.6)")
    print(f"  M(60)  = {quality_multiplier(60):.4f}  (should sit at midpoint (0.6+2.0)/2 = 1.3)")
    print(f"  M(100) = {quality_multiplier(100):.4f}  (should approach M_max=2.0)")


def real_company_case(name: str, industry: str, inputs: dict, growth_rate_pct: float, eps: float) -> dict:
    """Dry-run one real company through the full PEG pipeline."""
    s = intrinsic_score(
        inputs["mgmt"], inputs["moat"], inputs["fq"], inputs["fcfq"], inputs["growth"],
    )
    row = _valuation_row(name, s, industry, growth_rate_pct, eps)
    _print_row(row)
    return row


def real_companies_case(eps_values: dict[str, float]) -> None:
    """Sun Pharma, Avenue Supermarts (DMart), TCS -- real-world sanity check.

    Quality inputs (management/moat/financial-quality/FCF-quality/growth,
    each 0-100) and long-term growth rate estimates below are hand-estimated
    from each company's known business characteristics and recent
    fundamentals (order-of-magnitude judgment calls, not pulled from any
    paid data source) -- NOT computed from seeded/synthetic company data in
    this repo. EPS values are supplied by the user (real, latest reported
    figures) via eps_values.
    """
    print()
    print("=" * 100)
    print("Real-company sanity check: Sun Pharma, Avenue Supermarts (DMart), TCS")
    print("=" * 100)

    real_companies_case.results = {}

    # Sun Pharma -- Pharmaceuticals & Healthcare. Strong domestic + US generics
    # franchise, growing specialty portfolio, solid but not best-in-class
    # capital efficiency (generics pricing pressure), decent moat from
    # scale + specialty pipeline, steady double-digit growth outlook.
    r = real_company_case(
        "Sun Pharmaceutical Industries Ltd", "Pharmaceuticals & Healthcare",
        dict(mgmt=75, moat=72, fq=68, fcfq=65, growth=68),
        growth_rate_pct=13.0, eps=eps_values["SUNPHARMA"],
    )
    real_companies_case.results["SUNPHARMA"] = r

    # Avenue Supermarts (DMart) -- Retail & E-commerce. Exceptional
    # execution (low-cost EDLP model), high moat from owned-store real
    # estate + supply chain efficiency, very strong balance sheet (near-zero
    # debt), high growth via store expansion, best-in-class capital
    # discipline -- one of the highest-quality names in Indian retail.
    r = real_company_case(
        "Avenue Supermarts Ltd (DMart)", "Retail & E-commerce",
        dict(mgmt=88, moat=85, fq=82, fcfq=78, growth=78),
        growth_rate_pct=20.0, eps=eps_values["DMART"],
    )
    real_companies_case.results["DMART"] = r

    # TCS -- Information Technology / Software. Best-in-class IT services
    # major: high ROCE, asset-light, industry-leading margins, strong
    # governance, deep moat from scale/client-stickiness, but growth has
    # matured relative to smaller/mid-cap IT peers.
    r = real_company_case(
        "Tata Consultancy Services Ltd", "Information Technology / Software",
        dict(mgmt=90, moat=88, fq=90, fcfq=88, growth=55),
        growth_rate_pct=10.0, eps=eps_values["TCS"],
    )
    real_companies_case.results["TCS"] = r


if __name__ == "__main__":
    archetype_case()
    # EPS values supplied by the user (real, latest reported figures).
    _eps = {
        "SUNPHARMA": 47.84,
        "DMART": 45.56,
        "TCS": 136.01,
    }
    real_companies_case(_eps)
