import math

import numpy as np

from engine import market as mkt


def test_update_log_gap_fixed_point_at_zero():
    result = mkt.update_log_gap(
        y_t=0, theta=0.05, price_pressure=0, beta_m=0.3, f_m=0, beta_s=0.2, f_s=0, sigma=0.1, epsilon=0
    )
    assert result == 0


def test_update_log_gap_mean_reverts_toward_zero():
    result = mkt.update_log_gap(
        y_t=1.0, theta=0.05, price_pressure=0, beta_m=0.3, f_m=0, beta_s=0.2, f_s=0, sigma=0.1, epsilon=0
    )
    assert result < 1.0


def test_update_log_gap_positive_pressure_increases_gap():
    baseline = mkt.update_log_gap(
        y_t=0, theta=0.05, price_pressure=0, beta_m=0.3, f_m=0, beta_s=0.2, f_s=0, sigma=0.1, epsilon=0
    )
    with_pressure = mkt.update_log_gap(
        y_t=0, theta=0.05, price_pressure=0.1, beta_m=0.3, f_m=0, beta_s=0.2, f_s=0, sigma=0.1, epsilon=0
    )
    assert with_pressure > baseline


def test_price_from_gap_zero_gap_returns_iv():
    assert math.isclose(mkt.price_from_gap(iv=100, y=0), 100.0)


def test_price_from_gap_positive_gap_above_iv():
    result = mkt.price_from_gap(iv=100, y=math.log(1.1))
    assert math.isclose(result, 110.0)


def test_company_volatility_smaller_cap_more_volatile():
    small = mkt.company_volatility(sigma_ind=0.2, market_cap=100, leverage=0)
    large = mkt.company_volatility(sigma_ind=0.2, market_cap=10000, leverage=0)
    assert small > large


def test_company_volatility_higher_leverage_more_volatile():
    low_lev = mkt.company_volatility(sigma_ind=0.2, market_cap=1000, leverage=0.0)
    high_lev = mkt.company_volatility(sigma_ind=0.2, market_cap=1000, leverage=1.0)
    assert high_lev > low_lev


def test_update_market_tick_vectorized_matches_scalar():
    y = np.array([0.0, 1.0])
    theta = np.array([0.05, 0.05])
    pressure = np.array([0.0, 0.0])
    beta_m = np.array([0.3, 0.3])
    beta_s = np.array([0.2, 0.2])
    f_s = np.array([0.0, 0.0])
    sigma = np.array([0.1, 0.1])
    epsilon = np.array([0.0, 0.0])

    result = mkt.update_market_tick(y, theta, pressure, beta_m, 0.0, beta_s, f_s, sigma, epsilon)

    expected_0 = mkt.update_log_gap(0.0, 0.05, 0.0, 0.3, 0.0, 0.2, 0.0, 0.1, 0.0)
    expected_1 = mkt.update_log_gap(1.0, 0.05, 0.0, 0.3, 0.0, 0.2, 0.0, 0.1, 0.0)
    assert np.allclose(result, [expected_0, expected_1])
