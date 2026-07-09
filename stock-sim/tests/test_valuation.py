import math

from engine import valuation as val


def test_quality_multiplier_at_inflection_is_midpoint():
    result = val.quality_multiplier(intrinsic_score=60, q_min=0.30, q_max=5.00, k=0.12, c=60)
    assert math.isclose(result, (0.30 + 5.00) / 2)


def test_quality_multiplier_low_score_approaches_q_min():
    result = val.quality_multiplier(intrinsic_score=0, q_min=0.30, q_max=5.00, k=0.12, c=60)
    assert math.isclose(result, 0.30, abs_tol=0.05)


def test_quality_multiplier_high_score_approaches_q_max():
    result = val.quality_multiplier(intrinsic_score=100, q_min=0.30, q_max=5.00, k=0.12, c=60)
    assert math.isclose(result, 5.00, abs_tol=0.35)


def test_quality_multiplier_is_monotonically_increasing():
    scores = [0, 20, 40, 60, 80, 100]
    values = [val.quality_multiplier(s) for s in scores]
    assert values == sorted(values)


def test_fair_pe_matches_worked_example_from_spec():
    # Spec's worked example (Qmax=3.5 illustration): PE_industry=20,
    # IntrinsicScore=78 -> Q(S)~=2.8 -> FairPE~=56.
    result = val.fair_pe(
        pe0=20, intrinsic_score=78, pe_min=5, pe_max=100,
        q_min=0.30, q_max=3.5, k=0.0707, c=60,
    )
    assert math.isclose(result, 56.0, abs_tol=1.0)


def test_fair_pe_at_inflection_is_pe0_times_midpoint_multiplier():
    result = val.fair_pe(
        pe0=20, intrinsic_score=60, pe_min=1, pe_max=200,
        q_min=0.30, q_max=5.00, k=0.12, c=60,
    )
    assert math.isclose(result, 20 * (0.30 + 5.00) / 2)


def test_fair_pe_clamped_to_max():
    result = val.fair_pe(
        pe0=20, intrinsic_score=100, pe_min=5, pe_max=40,
        q_min=0.30, q_max=5.00, k=0.12, c=60,
    )
    assert result == 40


def test_fair_pe_clamped_to_min():
    result = val.fair_pe(
        pe0=20, intrinsic_score=0, pe_min=15, pe_max=40,
        q_min=0.30, q_max=5.00, k=0.12, c=60,
    )
    assert result == 15


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
    growth = 0.08
    days = 252
    result = val.drift_iv(iv, growth, days)
    expected = iv * (1 + growth) ** (1 / days)
    assert math.isclose(result, expected)
