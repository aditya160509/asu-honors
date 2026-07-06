import math

from engine import valuation as val


def test_fair_pe_neutral_returns_pe0():
    result = val.fair_pe(
        pe0=20, intrinsic_score=50, growth_score=50, beta_pe=0.5, beta_g=0.3, pe_min=5, pe_max=40
    )
    assert math.isclose(result, 20.0)


def test_fair_pe_high_quality_and_growth_increases_pe():
    result = val.fair_pe(
        pe0=20, intrinsic_score=100, growth_score=100, beta_pe=0.5, beta_g=0.3, pe_min=5, pe_max=100
    )
    expected = 20 * (1 + 0.5) * (1 + 0.3)
    assert math.isclose(result, expected)


def test_fair_pe_clamped_to_max():
    result = val.fair_pe(
        pe0=20, intrinsic_score=100, growth_score=100, beta_pe=5.0, beta_g=5.0, pe_min=5, pe_max=40
    )
    assert result == 40


def test_fair_pe_clamped_to_min():
    result = val.fair_pe(
        pe0=20, intrinsic_score=0, growth_score=0, beta_pe=1.0, beta_g=1.0, pe_min=5, pe_max=40
    )
    assert result == 5


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
