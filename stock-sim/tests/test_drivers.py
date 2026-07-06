import math

from engine import drivers as drv


def test_value_opportunity_basic():
    result = drv.value_opportunity(iv=110, price=100)
    assert math.isclose(result, 0.1)


def test_value_opportunity_clamps_above_one():
    result = drv.value_opportunity(iv=1000, price=100)
    assert result == 1.0


def test_value_opportunity_approaches_negative_one_as_iv_shrinks():
    result = drv.value_opportunity(iv=0.0, price=100)
    assert result == -1.0


def test_earnings_surprise_positive_beat_decays_over_time():
    fresh = drv.earnings_surprise(actual_eps=1.1, consensus_eps=1.0, days_since=0, decay_rate=0.1)
    stale = drv.earnings_surprise(actual_eps=1.1, consensus_eps=1.0, days_since=10, decay_rate=0.1)
    assert fresh > stale > 0


def test_earnings_surprise_zero_consensus_is_zero():
    assert drv.earnings_surprise(actual_eps=1.0, consensus_eps=0.0, days_since=0, decay_rate=0.1) == 0.0


def test_news_severity_sums_and_decays():
    events = [{"start_day": 5, "severity": 0.5}, {"start_day": 5, "severity": -0.2}]
    result = drv.news_severity(events, sim_day=5, decay_rate=0.1)
    assert math.isclose(result, 0.3)


def test_news_severity_clamps():
    events = [{"start_day": 0, "severity": 5.0}]
    result = drv.news_severity(events, sim_day=0, decay_rate=0.0)
    assert result == 1.0


def test_economic_outlook_clamps():
    assert drv.economic_outlook(2.0) == 1.0
    assert drv.economic_outlook(-2.0) == -1.0
    assert drv.economic_outlook(0.3) == 0.3


def test_guidance_raised_is_positive():
    result = drv.guidance("raised", jump_size=0.5, days_since=0, decay_rate=0.1)
    assert result > 0


def test_guidance_cut_is_negative():
    result = drv.guidance("cut", jump_size=0.5, days_since=0, decay_rate=0.1)
    assert result < 0


def test_guidance_maintained_is_zero():
    result = drv.guidance("maintained", jump_size=0.5, days_since=0, decay_rate=0.1)
    assert result == 0.0


def test_technical_momentum_positive_when_above_average():
    result = drv.technical_momentum(price=110, moving_average=100, k_m=1.0)
    assert result > 0


def test_technical_momentum_zero_at_average():
    result = drv.technical_momentum(price=100, moving_average=100, k_m=1.0)
    assert math.isclose(result, 0.0)


def test_institutional_buying_clamps():
    assert drv.institutional_buying(5.0) == 1.0
    assert drv.institutional_buying(-5.0) == -1.0


def test_composite_price_pressure_default_weights():
    values = {
        "value_opportunity": 1.0,
        "earnings_surprise": 1.0,
        "news_severity": 1.0,
        "economic_outlook": 1.0,
        "guidance": 1.0,
        "technical_momentum": 1.0,
        "institutional_buying": 1.0,
    }
    result = drv.composite_price_pressure(values)
    assert math.isclose(result, 1.0)
