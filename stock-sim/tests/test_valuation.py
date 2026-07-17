import math

from engine import valuation as val


def test_quality_multiplier_at_inflection_is_midpoint():
    result = val.quality_multiplier(intrinsic_score=60, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert math.isclose(result, (0.6 + 2.0) / 2)


def test_quality_multiplier_low_score_approaches_q_min():
    result = val.quality_multiplier(intrinsic_score=0, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert math.isclose(result, 0.6, abs_tol=0.05)


def test_quality_multiplier_high_score_approaches_q_max():
    result = val.quality_multiplier(intrinsic_score=100, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert math.isclose(result, 2.0, abs_tol=0.15)


def test_quality_multiplier_is_monotonically_increasing():
    scores = [0, 20, 40, 60, 80, 100]
    values = [val.quality_multiplier(s) for s in scores]
    assert values == sorted(values)


def test_quality_multiplier_default_params_match_spec_formula():
    # M(S) = 0.6 + 1.4 / (1 + exp(-0.11*(S-60))) using the module defaults.
    s = 72.0
    expected = 0.6 + 1.4 / (1 + math.exp(-0.11 * (s - 60)))
    assert math.isclose(val.quality_multiplier(s), expected)


def test_quality_multiplier_k_zero_returns_midpoint():
    result = val.quality_multiplier(intrinsic_score=50, m_min=0.6, m_max=2.0, k=0, c=60)
    assert math.isclose(result, (0.6 + 2.0) / 2)


def test_quality_multiplier_k_negative_inverts_curve():
    low_at_high = val.quality_multiplier(intrinsic_score=0, m_min=0.6, m_max=2.0, k=-0.11, c=60)
    high_at_low = val.quality_multiplier(intrinsic_score=100, m_min=0.6, m_max=2.0, k=-0.11, c=60)
    assert low_at_high > high_at_low


def test_quality_multiplier_score_out_of_range():
    result_neg = val.quality_multiplier(intrinsic_score=-50, m_min=0.6, m_max=2.0, k=0.11, c=60)
    result_big = val.quality_multiplier(intrinsic_score=200, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert result_neg >= 0.6
    assert result_big <= 2.0


def test_fair_peg_neutral_industry_peg_at_inflection_is_midpoint_multiplier():
    result = val.fair_peg(neutral_industry_peg=1.4, intrinsic_score=60, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert math.isclose(result, 1.4 * (0.6 + 2.0) / 2)


def test_fair_peg_weak_company_stays_near_floor():
    result = val.fair_peg(neutral_industry_peg=1.4, intrinsic_score=10, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert result < 1.4 * 0.7


def test_fair_peg_strong_company_approaches_ceiling():
    result = val.fair_peg(neutral_industry_peg=1.4, intrinsic_score=95, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert result > 1.4 * 1.8


def test_fair_pe_from_peg_multiplies_peg_by_growth_rate_percent():
    # Fair P/E = Fair PEG * LongTermGrowthRate (growth entered as e.g. 18.0 for 18%).
    result = val.fair_pe_from_peg(peg=1.5, long_term_growth_rate_pct=18.0)
    assert math.isclose(result, 27.0)


def test_growth_score_to_rate_endpoints():
    assert math.isclose(val.growth_score_to_rate(0, rate_min=2.0, rate_max=60.0), 2.0)
    assert math.isclose(val.growth_score_to_rate(100, rate_min=2.0, rate_max=60.0), 60.0)


def test_growth_score_to_rate_midpoint():
    result = val.growth_score_to_rate(50, rate_min=2.0, rate_max=60.0)
    assert math.isclose(result, 2.0 + (60.0 - 2.0) * 0.5)


def test_growth_score_to_rate_clamps_out_of_range_input():
    assert math.isclose(val.growth_score_to_rate(-20, rate_min=2.0, rate_max=60.0), 2.0)
    assert math.isclose(val.growth_score_to_rate(150, rate_min=2.0, rate_max=60.0), 60.0)


def test_full_peg_pipeline_matches_manual_computation():
    # Financial Quality Score -> M(S) -> Fair PEG -> Fair P/E -> Intrinsic Value,
    # cross-checked against hand computation for one set of inputs.
    s = 65.0
    neutral_peg = 1.5  # Pharma & Healthcare
    growth_rate_pct = 15.0
    eps = 20.0

    m = val.quality_multiplier(s, m_min=0.6, m_max=2.0, k=0.11, c=60)
    expected_m = 0.6 + 1.4 / (1 + math.exp(-0.11 * (s - 60)))
    assert math.isclose(m, expected_m)

    peg = val.fair_peg(neutral_peg, s, m_min=0.6, m_max=2.0, k=0.11, c=60)
    assert math.isclose(peg, neutral_peg * m)

    fpe = val.fair_pe_from_peg(peg, growth_rate_pct)
    assert math.isclose(fpe, peg * growth_rate_pct)

    iv = val.intrinsic_value_per_share(fpe, eps)
    assert math.isclose(iv, fpe * eps)


def test_intrinsic_value_per_share():
    assert val.intrinsic_value_per_share(fair_pe=15, eps=2.0) == 30.0


def test_drift_iv_positive_growth_increases_value():
    result = val.drift_iv(iv=100, expected_annual_growth=0.10, trading_days_per_year=252)
    assert result > 100


def test_drift_iv_zero_growth_is_noop():
    result = val.drift_iv(iv=100, expected_annual_growth=0.0, trading_days_per_year=252)
    assert math.isclose(result, 100.0)


def test_drift_iv_matches_daily_compounding_formula():
    iv = 100.0
    growth = 8.0
    days = 252
    result = val.drift_iv(iv, growth, days)
    expected = iv * (1 + growth / 100.0) ** (1 / days)
    assert math.isclose(result, expected)
