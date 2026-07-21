import math

import numpy as np

from engine import scoring


def test_percentile_rank_scores_higher_is_better():
    values = np.array([1, 2, 3, 4, 5])
    scores = scoring.percentile_rank_scores(values, lower_is_better=False)
    expected = np.array([0, 25, 50, 75, 100])
    assert np.allclose(scores, expected)


def test_percentile_rank_scores_lower_is_better_reverses():
    values = np.array([1, 2, 3, 4, 5])
    scores = scoring.percentile_rank_scores(values, lower_is_better=True)
    expected = np.array([100, 75, 50, 25, 0])
    assert np.allclose(scores, expected)


def test_percentile_rank_scores_single_value():
    scores = scoring.percentile_rank_scores(np.array([42]))
    assert np.allclose(scores, [50.0])


def test_percentile_rank_scores_ties_get_average_rank():
    values = np.array([1, 2, 2, 4])
    scores = scoring.percentile_rank_scores(values, lower_is_better=False)
    assert math.isclose(scores[1], scores[2])


def test_financial_quality_composite_single_pillar():
    subscores = {"roic": 80.0, "roe": 60.0}
    pillar_weights = {"profitability": 1.0}
    subfactor_pillar_map = {"roic": "profitability", "roe": "profitability"}
    result = scoring.financial_quality_composite(subscores, pillar_weights, subfactor_pillar_map)
    assert math.isclose(result, 70.0)


def test_financial_quality_composite_multi_pillar():
    subscores = {"roic": 100.0, "current_ratio": 0.0}
    pillar_weights = {"profitability": 0.6, "liquidity": 0.4}
    subfactor_pillar_map = {"roic": "profitability", "current_ratio": "liquidity"}
    result = scoring.financial_quality_composite(subscores, pillar_weights, subfactor_pillar_map)
    assert math.isclose(result, 0.6 * 100.0 + 0.4 * 0.0)


def test_moat_composite_weighted_average():
    subscores = {"brand": 80.0, "network_effect": 40.0}
    weights = {"brand": 0.5, "network_effect": 0.5}
    assert math.isclose(scoring.moat_composite(subscores, weights), 60.0)


def test_intrinsic_score_default_weights():
    result = scoring.intrinsic_score(mgmt=80, moat=60, fq=70, fcfq=50, growth=90)
    expected = 0.25 * 80 + 0.25 * 60 + 0.20 * 70 + 0.10 * 50 + 0.20 * 90
    assert math.isclose(result, expected)


def test_intrinsic_score_all_equal_returns_same_value():
    assert math.isclose(scoring.intrinsic_score(50, 50, 50, 50, 50), 50.0)


def test_percentile_rank_scores_empty_array():
    result = scoring.percentile_rank_scores(np.array([]))
    assert result.shape == (0,)
    assert result.dtype == float


def test_financial_quality_composite_missing_pillar_skips():
    subscores = {"roic": 80.0}
    pillar_weights = {"profitability": 0.7, "liquidity": 0.3}
    subfactor_pillar_map = {"roic": "profitability"}
    result = scoring.financial_quality_composite(subscores, pillar_weights, subfactor_pillar_map)
    assert math.isclose(result, 0.7 * 80.0)


def test_moat_composite_empty_subscores_returns_zero():
    weights = {"brand": 0.5, "network_effect": 0.5}
    assert scoring.moat_composite({}, weights) == 0.0
