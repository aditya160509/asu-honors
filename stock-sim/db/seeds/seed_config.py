"""Seed config_parameters, factor_definitions. Run before industries are seeded."""

import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from db.models import ConfigParameter, FactorDefinition


def seed(session: Session) -> None:
    """Insert config params and factor definitions."""

    # ── config_parameters ──────────────────────────────────────────────
    config_params = [
        # Engine coefficients
        ConfigParameter(
            key="k_drift",
            value="0.10",
            scope="global",
            description="Scales price pressure into daily return",
        ),
        # PEG-based valuation (Section 6.D, revised 2026-07-10): M(S) logistic
        # quality multiplier applied to each industry's Neutral Industry PEG
        # (seeded per-industry in seed_industries.py as
        # neutral_industry_peg), not to a market PE anchor.
        ConfigParameter(
            key="quality_mult_min",
            value="0.6",
            scope="global",
            description="M(S) logistic quality multiplier: minimum multiplier for the weakest businesses",
        ),
        ConfigParameter(
            key="quality_mult_max",
            value="2.0",
            scope="global",
            description="M(S) logistic quality multiplier: maximum multiplier for the strongest businesses",
        ),
        ConfigParameter(
            key="quality_mult_k",
            value="0.11",
            scope="global",
            description="M(S) logistic quality multiplier: steepness of the re-rating around the inflection point",
        ),
        ConfigParameter(
            key="quality_mult_inflection",
            value="60",
            scope="global",
            description="M(S) logistic quality multiplier: Financial Quality Score inflection point where valuation premiums begin",
        ),
        ConfigParameter(
            key="growth_rate_min",
            value="1.0",
            scope="global",
            description="growth_potential=0 maps to this estimated long-term annual EPS growth rate (%)",
        ),
        ConfigParameter(
            key="growth_rate_max",
            value="60.0",
            scope="global",
            description="growth_potential=100 maps to this estimated long-term annual EPS growth rate (%)",
        ),
        ConfigParameter(
            key="fair_pe_baseline",
            value="10.0",
            scope="global",
            description="Zero-growth perpetuity PE (1/discount_rate) — the additive baseline for Fair P/E = baseline + PEG * growth%",
        ),
        ConfigParameter(
            key="trading_days_per_year",
            value="252",
            scope="global",
            description="Number of trading days in a calendar year",
        ),
        ConfigParameter(
            key="quarter_length",
            value="63",
            scope="global",
            description="Number of trading days in a quarter",
        ),
        ConfigParameter(
            key="starting_cash",
            value="1000000",
            scope="global",
            description="Starting cash balance for new portfolios",
        ),
        ConfigParameter(
            key="circuit_breaker_cap",
            value="0.20",
            scope="global",
            description="Maximum single-day price change fraction",
        ),
        ConfigParameter(
            key="news_decay_rate",
            value="0.15",
            scope="global",
            description="Decay rate for news impact on prices",
        ),
        ConfigParameter(
            key="earnings_surprise_decay_rate",
            value="0.10",
            scope="global",
            description="Decay rate for earnings surprise impact",
        ),
        ConfigParameter(
            key="guidance_decay_rate",
            value="0.10",
            scope="global",
            description="Decay rate for guidance impact",
        ),
        ConfigParameter(
            key="k_m",
            value="2.0",
            scope="global",
            description="Technical momentum sensitivity",
        ),
        ConfigParameter(
            key="k_flow",
            value="0.5",
            scope="global",
            description="Demand/supply flow sensitivity",
        ),
        ConfigParameter(
            key="base_spread_bps",
            value="10",
            scope="global",
            description="Base bid-ask spread in basis points",
        ),
        ConfigParameter(
            key="kyle_lambda_scale",
            value="0.00005",
            scope="global",
            description="Kyle's lambda scaling factor for market impact (fractional price impact per share, before the 1/(1+liquidity) liquidity discount)",
        ),
        ConfigParameter(
            key="r_cap",
            value="0.20",
            scope="global",
            description="Daily return cap",
        ),
        # Mean-reversion speeds
        ConfigParameter(
            key="theta_default",
            value="0.05",
            scope="global",
            description="Default mean-reversion speed",
        ),
        ConfigParameter(
            key="theta_stable",
            value="0.08",
            scope="global",
            description="Mean-reversion speed for stable industries",
        ),
        ConfigParameter(
            key="theta_speculative",
            value="0.03",
            scope="global",
            description="Mean-reversion speed for speculative industries",
        ),
        # ── Price driver weights ──────────────────────────────────────
        ConfigParameter(
            key="w_vo",
            value="0.10",
            scope="global",
            description="Value opportunity driver weight",
        ),
        ConfigParameter(
            key="w_es",
            value="0.15",
            scope="global",
            description="Earnings surprise driver weight",
        ),
        ConfigParameter(
            key="w_ns",
            value="0.25",
            scope="global",
            description="News severity driver weight",
        ),
        ConfigParameter(
            key="w_eo",
            value="0.25",
            scope="global",
            description="Economic outlook driver weight",
        ),
        ConfigParameter(
            key="w_g",
            value="0.15",
            scope="global",
            description="Guidance driver weight",
        ),
        ConfigParameter(
            key="w_tm",
            value="0.10",
            scope="global",
            description="Technical momentum driver weight",
        ),
        ConfigParameter(
            key="w_ib",
            value="0.15",
            scope="global",
            description="Institutional buying driver weight",
        ),
        # ── Volume formula (PRD 6.L) ──────────────────────────────────
        ConfigParameter(
            key="vol_turnover_rate",
            value="0.001",
            scope="global",
            description="Base turnover as fraction of market cap for volume",
        ),
        ConfigParameter(
            key="vol_coeff_return",
            value="0.5",
            scope="global",
            description="Volume sensitivity to absolute daily return",
        ),
        ConfigParameter(
            key="vol_coeff_news",
            value="0.3",
            scope="global",
            description="Volume sensitivity to news severity change",
        ),
        ConfigParameter(
            key="vol_coeff_earnings",
            value="0.2",
            scope="global",
            description="Additional volume multiplier on earnings days",
        ),
        ConfigParameter(
            key="vol_noise_sigma",
            value="0.1",
            scope="global",
            description="LogNormal noise sigma for volume stochasticity",
        ),
        ConfigParameter(
            key="vol_leverage_factor",
            value="0.2",
            scope="global",
            description="How much financial leverage multiplies stock volatility",
        ),
        ConfigParameter(
            key="vol_max_leverage",
            value="5.0",
            scope="global",
            description="Max leverage ratio used in volatility computation",
        ),
    ]

    for cp in config_params:
        exists = (
            session.query(ConfigParameter)
            .filter_by(key=cp.key, scope=cp.scope, scope_id=cp.scope_id)
            .first()
        )
        if not exists:
            session.add(cp)

    # ── factor_definitions ─────────────────────────────────────────────

    factor_defs = [
        # ── Intrinsic top-level factors ────────────────────────────
        FactorDefinition(
            key="management_quality",
            display_name="Management Quality",
            factor_type="intrinsic_top",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.25,
        ),
        FactorDefinition(
            key="moat_score",
            display_name="Moat",
            factor_type="intrinsic_top",
            direction="higher_better",
            formula_ref="moat_composite",
            default_weight=0.25,
        ),
        FactorDefinition(
            key="financial_quality",
            display_name="Financial Quality",
            factor_type="intrinsic_top",
            direction="higher_better",
            formula_ref="fq_composite",
            default_weight=0.20,
        ),
        FactorDefinition(
            key="fcf_quality",
            display_name="FCF Quality",
            factor_type="intrinsic_top",
            direction="higher_better",
            formula_ref="free_cash_flow_margin",
            default_weight=0.10,
        ),
        FactorDefinition(
            key="growth_potential",
            display_name="Growth Potential",
            factor_type="intrinsic_top",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.20,
        ),
        # ── MOAT sub-factors ───────────────────────────────────────
        FactorDefinition(
            key="market_share",
            display_name="Market Share",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.18,
        ),
        FactorDefinition(
            key="brand_strength",
            display_name="Brand Strength",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.15,
        ),
        FactorDefinition(
            key="customer_loyalty",
            display_name="Customer Loyalty / Switching Costs",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.15,
        ),
        FactorDefinition(
            key="cost_advantage",
            display_name="Cost Advantage",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.12,
        ),
        FactorDefinition(
            key="network_effects",
            display_name="Network Effects",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.10,
        ),
        FactorDefinition(
            key="intangibles",
            display_name="Intangibles / Patents / IP",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.10,
        ),
        FactorDefinition(
            key="innovation",
            display_name="Innovation / R&D Intensity",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.10,
        ),
        FactorDefinition(
            key="competitive_intensity",
            display_name="Competitive Intensity (inverse)",
            factor_type="moat_sub",
            pillar="moat",
            direction="lower_better",
            formula_ref="seeded",
            default_weight=0.05,
        ),
        FactorDefinition(
            key="geographic_diversification",
            display_name="Geographic Diversification",
            factor_type="moat_sub",
            pillar="moat",
            direction="higher_better",
            formula_ref="seeded",
            default_weight=0.05,
        ),
        # ── FQ sub-factors: Profitability ──────────────────────────
        FactorDefinition(
            key="operating_margin",
            display_name="Operating Margin",
            factor_type="fq_sub",
            pillar="profitability",
            direction="higher_better",
            formula_ref="operating_margin",
        ),
        FactorDefinition(
            key="roic",
            display_name="ROIC",
            factor_type="fq_sub",
            pillar="profitability",
            direction="higher_better",
            formula_ref="roic",
        ),
        FactorDefinition(
            key="roe",
            display_name="ROE",
            factor_type="fq_sub",
            pillar="profitability",
            direction="higher_better",
            formula_ref="roe",
        ),
        # ── FQ sub-factors: Efficiency ─────────────────────────────
        FactorDefinition(
            key="asset_turnover",
            display_name="Asset Turnover",
            factor_type="fq_sub",
            pillar="efficiency",
            direction="higher_better",
            formula_ref="asset_turnover",
        ),
        FactorDefinition(
            key="cash_conversion_cycle",
            display_name="Cash Conversion Cycle",
            factor_type="fq_sub",
            pillar="efficiency",
            direction="lower_better",
            formula_ref="cash_conversion_cycle",
        ),
        # ── FQ sub-factors: Leverage / Solvency ────────────────────
        FactorDefinition(
            key="net_debt_to_ebitda",
            display_name="Net Debt / EBITDA",
            factor_type="fq_sub",
            pillar="leverage_solvency",
            direction="lower_better",
            formula_ref="net_debt_to_ebitda",
        ),
        FactorDefinition(
            key="interest_coverage",
            display_name="Interest Coverage",
            factor_type="fq_sub",
            pillar="leverage_solvency",
            direction="higher_better",
            formula_ref="interest_coverage",
        ),
        FactorDefinition(
            key="current_ratio",
            display_name="Current Ratio",
            factor_type="fq_sub",
            pillar="leverage_solvency",
            direction="higher_better",
            formula_ref="current_ratio",
        ),
        # ── FQ sub-factors: Stability ──────────────────────────────
        FactorDefinition(
            key="earnings_stability",
            display_name="Earnings Stability",
            factor_type="fq_sub",
            pillar="stability",
            direction="higher_better",
            formula_ref="earnings_stability",
        ),
        FactorDefinition(
            key="revenue_consistency",
            display_name="Revenue Consistency",
            factor_type="fq_sub",
            pillar="stability",
            direction="higher_better",
            formula_ref="revenue_consistency",
        ),
        # ── FQ sub-factors: Earnings Quality ───────────────────────
        FactorDefinition(
            key="accruals_ratio",
            display_name="Accruals Ratio",
            factor_type="fq_sub",
            pillar="earnings_quality",
            direction="lower_better",
            formula_ref="accruals_ratio",
        ),
        FactorDefinition(
            key="payout_sustainability",
            display_name="Payout Sustainability",
            factor_type="fq_sub",
            pillar="earnings_quality",
            direction="mid_band",
            formula_ref="payout_sustainability",
        ),
        # ── Banking-specific FQ sub-factors (subfactor_set='financials') ──
        FactorDefinition(
            key="net_interest_margin",
            display_name="Net Interest Margin",
            factor_type="fq_sub",
            pillar="profitability",
            direction="higher_better",
            formula_ref="net_interest_margin",
        ),
        FactorDefinition(
            key="cost_to_income",
            display_name="Cost-to-Income Ratio",
            factor_type="fq_sub",
            pillar="efficiency",
            direction="lower_better",
            formula_ref="cost_to_income",
        ),
        FactorDefinition(
            key="roa",
            display_name="Return on Assets",
            factor_type="fq_sub",
            pillar="profitability",
            direction="higher_better",
            formula_ref="roa",
        ),
        FactorDefinition(
            key="capital_adequacy_ratio",
            display_name="Capital Adequacy Ratio",
            factor_type="fq_sub",
            pillar="leverage_solvency",
            direction="higher_better",
            formula_ref="capital_adequacy_ratio",
        ),
        FactorDefinition(
            key="npa_ratio",
            display_name="NPA Ratio",
            factor_type="fq_sub",
            pillar="leverage_solvency",
            direction="lower_better",
            formula_ref="npa_ratio",
        ),
        # ── Price Drivers ──────────────────────────────────────────
        FactorDefinition(
            key="value_opportunity",
            display_name="Value Opportunity",
            factor_type="price_driver",
            direction="higher_better",
            formula_ref="value_opportunity",
            default_weight=0.20,
            value_range="-1..1",
        ),
        FactorDefinition(
            key="earnings_surprise",
            display_name="Earnings Surprise",
            factor_type="price_driver",
            direction="higher_better",
            formula_ref="earnings_surprise",
            default_weight=0.15,
            value_range="-1..1",
        ),
        FactorDefinition(
            key="news_severity",
            display_name="News Severity",
            factor_type="price_driver",
            direction="higher_better",
            formula_ref="news_severity",
            default_weight=0.15,
            value_range="-1..1",
        ),
        FactorDefinition(
            key="economic_outlook",
            display_name="Economic Outlook",
            factor_type="price_driver",
            direction="higher_better",
            formula_ref="economic_outlook",
            default_weight=0.10,
            value_range="-1..1",
        ),
        FactorDefinition(
            key="guidance",
            display_name="Guidance",
            factor_type="price_driver",
            direction="higher_better",
            formula_ref="guidance",
            default_weight=0.15,
            value_range="-1..1",
        ),
        FactorDefinition(
            key="technical_momentum",
            display_name="Technical Momentum",
            factor_type="price_driver",
            direction="higher_better",
            formula_ref="technical_momentum",
            default_weight=0.10,
            value_range="-1..1",
        ),
        FactorDefinition(
            key="institutional_buying",
            display_name="Institutional Buying",
            factor_type="price_driver",
            direction="higher_better",
            formula_ref="institutional_buying",
            default_weight=0.15,
            value_range="-1..1",
        ),
    ]

    for fd in factor_defs:
        exists = (
            session.query(FactorDefinition).filter_by(key=fd.key).first()
        )
        if not exists:
            session.add(fd)


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_config.py done.")


if __name__ == "__main__":
    main()
