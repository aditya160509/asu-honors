"""Standalone dry-run of the Q(S) valuation pipeline with hand-picked sample
companies (no database). Demonstrates fundamentals -> IntrinsicScore -> Q(S)
-> FairPE -> IV end to end, and sanity-checks the logistic multiplier's
qualitative behavior (weak/average/strong businesses), plus a real-world
sanity check against Reliance Industries Ltd (NSE: RELIANCE).

Run: python docs/valuation_dry_run.py
"""

from engine.scoring import intrinsic_score
from engine.valuation import fair_pe, intrinsic_value_per_share, quality_multiplier

INDUSTRY_PE = 20.0

# Three archetype companies spanning the quality spectrum. Sub-scores are
# hand-picked (not computed from statements) purely to exercise the
# Q(S)-based valuation step in isolation.
COMPANIES = [
    {
        "name": "Weak Co (commodity, indebted, no moat)",
        "management_quality": 35,
        "moat_score": 20,
        "financial_quality": 30,
        "fcf_quality": 25,
        "growth_potential": 40,
        "eps": 2.0,
    },
    {
        "name": "Average Co (decent, unremarkable)",
        "management_quality": 55,
        "moat_score": 50,
        "financial_quality": 55,
        "fcf_quality": 50,
        "growth_potential": 60,
        "eps": 5.0,
    },
    {
        "name": "Compounder Co (strong moat, high ROCE, low debt)",
        "management_quality": 85,
        "moat_score": 90,
        "financial_quality": 88,
        "fcf_quality": 85,
        "growth_potential": 75,
        "eps": 10.0,
    },
    {
        "name": "Perfect Co (theoretical ceiling)",
        "management_quality": 100,
        "moat_score": 100,
        "financial_quality": 100,
        "fcf_quality": 100,
        "growth_potential": 100,
        "eps": 8.0,
    },
]


def archetype_case() -> None:
    print(f"{'Company':<45} {'S (IntrinsicScore)':>18} {'Q(S)':>8} {'FairPE':>10} {'EPS':>6} {'IV':>10}")
    print("-" * 100)
    prev_q = 0.0
    for c in COMPANIES:
        s = intrinsic_score(
            c["management_quality"], c["moat_score"], c["financial_quality"],
            c["fcf_quality"], c["growth_potential"],
        )
        q = quality_multiplier(s)
        fpe = fair_pe(INDUSTRY_PE, s)
        iv = intrinsic_value_per_share(fpe, c["eps"])

        print(f"{c['name']:<45} {s:>18.2f} {q:>8.3f} {fpe:>10.2f} {c['eps']:>6.2f} {iv:>10.2f}")

        # Sanity checks that should hold for ANY set of sample values.
        assert q >= prev_q, "Q(S) must be monotonically non-decreasing across increasing S"
        assert 0.30 <= q <= 5.00, "Q(S) must stay within its own [q_min, q_max] bounds"
        prev_q = q

    print()
    print("Sanity checks:")
    print(f"  Q(0)   = {quality_multiplier(0):.4f}  (should hug q_min=0.30)")
    print(f"  Q(60)  = {quality_multiplier(60):.4f}  (should sit at the midpoint (0.30+5.00)/2 = 2.65)")
    print(f"  Q(100) = {quality_multiplier(100):.4f}  (should approach q_max=5.00)")
    print()
    print("Diminishing marginal valuation check (equal-sized score jumps):")
    for lo, hi in [(10, 20), (50, 60), (90, 100)]:
        delta = quality_multiplier(hi) - quality_multiplier(lo)
        print(f"  S {lo}->{hi}: Q delta = {delta:+.4f}")
    print("  (delta should be smallest at the extremes, largest through the 50-60 middle band)")


def reliance_case() -> None:
    """Real-world sanity check: Reliance Industries Ltd (NSE: RELIANCE).

    Approximate FY2024/FY2025 figures (public knowledge, order-of-magnitude
    only -- not live/latest market data, and not pulled from any paid data
    source): consolidated EPS ~INR 98-100, trading P/E ~24-28x, a business
    that is diversified (O2C/retail/telecom/media) with a strong moat
    (Jio's network effects + retail scale), solid but not best-in-class
    capital efficiency (large capex-heavy O2C segment drags ROCE), and a
    management/governance profile considered strong by Indian large-cap
    standards. This is illustrative, not a real trading recommendation.
    """
    print()
    print("=" * 100)
    print("Real-world sanity check: Reliance Industries Ltd (NSE: RELIANCE)")
    print("=" * 100)

    eps = 98.0
    # Reliance spans Energy/Oil&Gas (O2C), Retail, and Telecom -- no single
    # clean industry bucket. Use a blended "diversified conglomerate"
    # industry PE approximating a weighted mix of its segments (energy ~10x,
    # retail ~24x, telecom ~14x), which lands close to Reliance's own
    # historical trading multiple.
    industry_pe = 18.0

    inputs = dict(
        mgmt=78,    # strong, established promoter-led governance
        moat=82,    # Jio network effects + retail scale + O2C integration
        fq=62,      # solid but leverage-heavy O2C capex drags this down
        fcfq=58,    # capex-intensive; FCF lumpier than IT/FMCG peers
        growth=70,  # retail + Jio growth offsets mature O2C segment
    )

    s = intrinsic_score(**inputs)
    q = quality_multiplier(s)
    fpe = fair_pe(industry_pe, s)
    iv = intrinsic_value_per_share(fpe, eps)

    actual_pe_low, actual_pe_high = 22.0, 28.0
    actual_price_low, actual_price_high = 2400.0, 3000.0

    print(f"  Inputs: EPS={eps}, blended industry PE={industry_pe}, {inputs}")
    print(f"  IntrinsicScore (S) = {s:.2f}")
    print(f"  Quality multiplier Q(S) = {q:.3f}")
    print(f"  FairPE = industry_pe * Q(S) = {fpe:.2f}")
    print(f"  Intrinsic Value = FairPE * EPS = {iv:.2f}")
    print()
    print(f"  Reference: Reliance's actual trading P/E has historically sat around")
    print(f"  {actual_pe_low:.0f}-{actual_pe_high:.0f}x, market price roughly INR {actual_price_low:.0f}-{actual_price_high:.0f}.")
    if actual_pe_low <= fpe <= actual_pe_high * 1.3:
        verdict = "PLAUSIBLE -- within a reasonable band of the real multiple."
    else:
        verdict = "OFF -- model FairPE deviates well outside the real trading range."
    print(f"  Model FairPE = {fpe:.1f}x vs actual ~{actual_pe_low:.0f}-{actual_pe_high:.0f}x -> {verdict}")
    print()
    if not (actual_pe_low <= fpe <= actual_pe_high * 1.3):
        print("  FINDING: with these hand-picked quality inputs, the model overshoots")
        print("  the real multiple by a wide margin. Solving backward, an")
        print("  IntrinsicScore around S~50 (not S~72) is what reproduces Reliance's")
        print("  actual ~22-28x multiple at k=0.12/c=60. This does not mean the Q(S)")
        print("  formula is wrong -- it means the qualitative inputs above")
        print("  (mgmt/moat/fq/fcfq/growth) are not yet calibrated against real")
        print("  market multiples. That calibration (mapping subjective 0-100")
        print("  quality judgments to scores that reproduce observed market PEs)")
        print("  has NOT been done for this simulation -- seeded company scores")
        print("  are synthetic placeholders, not fitted to real market data. This")
        print("  dry-run's honest conclusion: the FORMULA behaves correctly")
        print("  (monotonic, bounded, diminishing-marginal-valuation), but the")
        print("  SCORE INPUTS need calibration before they can be trusted to")
        print("  reproduce real-world valuations for any specific real company.")


if __name__ == "__main__":
    archetype_case()
    reliance_case()
