"""Tests for apps/api/services/portfolio_service.compute_risk_metrics --
beta, Sharpe, volatility, max drawdown, and historical VaR. Pure-function
tests against hand-built PortfolioHistoryResponse fixtures, no DB needed."""

from datetime import date, timedelta

from apps.api.schemas import BenchmarkPoint, PortfolioHistoryPoint, PortfolioHistoryResponse
from apps.api.services.portfolio_service import MIN_RETURN_OBSERVATIONS, compute_risk_metrics


def _history(values: list[float], bench: list[float] | None = None) -> PortfolioHistoryResponse:
    start = date(2026, 1, 1)
    points = [
        PortfolioHistoryPoint(sim_date=start + timedelta(days=i), total_value=v, cash=0, holdings_value=v)
        for i, v in enumerate(values)
    ]
    bench_points = [
        BenchmarkPoint(sim_date=start + timedelta(days=i), value=v)
        for i, v in enumerate(bench or values)
    ]
    return PortfolioHistoryResponse(range="MAX", points=points, benchmark=bench_points)


def test_all_metrics_none_with_too_short_a_series():
    metrics = compute_risk_metrics(_history([100.0]))
    assert metrics == {
        "beta": None, "sharpe_ratio": None, "volatility_pct": None,
        "max_drawdown_pct": None, "value_at_risk_pct": None,
    }


def test_max_drawdown_only_needs_two_points():
    # Peaks at 120, troughs at 90 -- a 25% drawdown from peak.
    metrics = compute_risk_metrics(_history([100.0, 120.0, 90.0, 110.0]))
    assert metrics["max_drawdown_pct"] is not None
    assert round(metrics["max_drawdown_pct"], 1) == -25.0
    # Too few return observations (< MIN_RETURN_OBSERVATIONS) for vol/Sharpe/VaR.
    assert metrics["volatility_pct"] is None
    assert metrics["sharpe_ratio"] is None
    assert metrics["value_at_risk_pct"] is None


def test_volatility_sharpe_and_var_populate_with_enough_history():
    assert MIN_RETURN_OBSERVATIONS == 10
    # Steady uptrend -- positive Sharpe, some volatility, small VaR.
    values = [100.0 * (1.01 ** i) for i in range(15)]
    metrics = compute_risk_metrics(_history(values))

    assert metrics["volatility_pct"] is not None and metrics["volatility_pct"] > 0
    assert metrics["sharpe_ratio"] is not None and metrics["sharpe_ratio"] > 0
    assert metrics["value_at_risk_pct"] is not None
    assert metrics["value_at_risk_pct"] >= 0


def test_var_is_zero_for_a_monotonic_uptrend_with_no_losing_days():
    values = [100.0 * (1.01 ** i) for i in range(15)]
    metrics = compute_risk_metrics(_history(values))
    # Every daily return is +1% -- the 5th-percentile return is still positive,
    # so the reported VaR (a loss magnitude) clamps to 0, not a negative number.
    assert metrics["value_at_risk_pct"] == 0.0


def test_var_reflects_a_known_worst_day():
    # 14 days of +1%, then one -20% day -- the worst historical day.
    values = [100.0]
    for _ in range(13):
        values.append(values[-1] * 1.01)
    values.append(values[-1] * 0.80)
    metrics = compute_risk_metrics(_history(values))

    assert metrics["value_at_risk_pct"] is not None
    # Nearest-rank 5th percentile of 14 sorted returns (13 up days + 1 down
    # day) lands on the single -20% day at this sample size.
    assert metrics["value_at_risk_pct"] > 15.0


def test_beta_requires_matching_benchmark_history():
    values = [100.0 * (1.01 ** i) for i in range(15)]
    bench = [100.0 * (1.005 ** i) for i in range(15)]
    metrics = compute_risk_metrics(_history(values, bench))
    assert metrics["beta"] is not None
