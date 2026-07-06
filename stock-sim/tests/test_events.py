import math

from engine import events as evt


def test_decay_zero_elapsed():
    assert math.isclose(evt.decay(rho=0.1, days_elapsed=0), 1.0)


def test_decay_positive_elapsed():
    result = evt.decay(rho=0.1, days_elapsed=10)
    assert math.isclose(result, math.exp(-1.0))


def test_decay_high_rho_decays_faster():
    fast = evt.decay(rho=1.0, days_elapsed=5)
    slow = evt.decay(rho=0.1, days_elapsed=5)
    assert fast < slow


def test_apply_effect_to_drivers_adds_and_decays():
    drivers = {"news_severity": 0.0, "guidance": 0.0}
    profile = {"news_severity": -0.5, "guidance": -1.0}
    result = evt.apply_effect_to_drivers(drivers, profile, severity=1.0, rho=0.1, days_elapsed=0)
    assert math.isclose(result["news_severity"], -0.5)
    assert math.isclose(result["guidance"], -1.0)


def test_apply_effect_to_drivers_does_not_mutate_input():
    drivers = {"news_severity": 0.0}
    profile = {"news_severity": -0.5}
    evt.apply_effect_to_drivers(drivers, profile, severity=1.0, rho=0.1, days_elapsed=0)
    assert drivers["news_severity"] == 0.0  # unchanged


def test_apply_effect_to_drivers_decays_with_time():
    fresh = evt.apply_effect_to_drivers(
        {"news_severity": 0.0}, {"news_severity": -1.0}, severity=1.0, rho=0.1, days_elapsed=0
    )
    stale = evt.apply_effect_to_drivers(
        {"news_severity": 0.0}, {"news_severity": -1.0}, severity=1.0, rho=0.1, days_elapsed=10
    )
    assert abs(stale["news_severity"]) < abs(fresh["news_severity"])


def test_apply_effect_to_drivers_clamps_to_negative_one():
    result = evt.apply_effect_to_drivers(
        {"news_severity": 0.0}, {"news_severity": -10.0}, severity=1.0, rho=0.0, days_elapsed=0
    )
    assert result["news_severity"] >= -1.0


def test_apply_effect_to_drivers_clamps_to_positive_one():
    result = evt.apply_effect_to_drivers(
        {"news_severity": 0.0}, {"news_severity": 10.0}, severity=1.0, rho=0.0, days_elapsed=0
    )
    assert result["news_severity"] <= 1.0


def test_apply_effect_to_factor_scores_clamps_to_100():
    result = evt.apply_effect_to_factor_scores(
        {"moat_score": 50.0}, {"moat_score": 100.0}, severity=1.0, rho=0.0, days_elapsed=0
    )
    assert result["moat_score"] <= 100.0


def test_apply_effect_to_factor_scores_clamps_to_0():
    result = evt.apply_effect_to_factor_scores(
        {"moat_score": 50.0}, {"moat_score": -100.0}, severity=1.0, rho=0.0, days_elapsed=0
    )
    assert result["moat_score"] >= 0.0


def test_apply_effect_to_factor_scores_scales_by_severity():
    half = evt.apply_effect_to_factor_scores(
        {"moat_score": 50.0}, {"moat_score": 20.0}, severity=0.5, rho=0.0, days_elapsed=0
    )
    full = evt.apply_effect_to_factor_scores(
        {"moat_score": 50.0}, {"moat_score": 20.0}, severity=1.0, rho=0.0, days_elapsed=0
    )
    assert half["moat_score"] == 60.0
    assert full["moat_score"] == 70.0
