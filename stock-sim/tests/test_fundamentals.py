import math

from engine import fundamentals as fnd


def test_operating_margin_basic():
    assert fnd.operating_margin(ebit=200, revenue=1000) == 0.2


def test_operating_margin_zero_ebit():
    assert fnd.operating_margin(ebit=0, revenue=500) == 0.0


def test_roic_basic():
    result = fnd.roic(ebit=100, tax_rate=0.25, invested_capital=500)
    assert math.isclose(result, 100 * 0.75 / 500)


def test_roe_basic():
    assert fnd.roe(net_profit=50, shareholders_equity=250) == 0.2


def test_asset_turnover_basic():
    assert fnd.asset_turnover(revenue=800, total_assets=400) == 2.0


def test_asset_turnover_zero_assets_returns_inf():
    assert fnd.asset_turnover(revenue=800, total_assets=0) == float("inf")


def test_cash_conversion_cycle():
    dso = fnd.days_sales_outstanding(receivables=100, revenue=1000, period_days=365)
    dio = fnd.days_inventory_outstanding(inventory=50, cogs=600, period_days=365)
    dpo = fnd.days_payables_outstanding(payables=80, cogs=600, period_days=365)
    ccc = fnd.cash_conversion_cycle(dso, dio, dpo)
    assert math.isclose(ccc, dso + dio - dpo)


def test_net_debt_to_ebitda():
    assert fnd.net_debt_to_ebitda(total_debt=300, cash_and_equivalents=100, ebitda=100) == 2.0


def test_interest_coverage():
    assert fnd.interest_coverage(ebit=400, interest_expense=100) == 4.0


def test_current_ratio():
    assert fnd.current_ratio(current_assets=200, current_liabilities=100) == 2.0


def test_accruals_ratio():
    result = fnd.accruals_ratio(net_profit=100, operating_cash_flow=80, total_assets=1000)
    assert math.isclose(result, 0.02)


def test_gross_margin():
    assert fnd.gross_margin(gross_profit=400, revenue=1000) == 0.4


def test_free_cash_flow_margin():
    assert fnd.free_cash_flow_margin(free_cash_flow=150, revenue=1000) == 0.15


def test_operating_margin_zero_revenue_returns_inf():
    result = fnd.operating_margin(ebit=100, revenue=0)
    assert result == float("inf") or math.isinf(result)


def test_roic_zero_invested_capital():
    result = fnd.roic(ebit=100, tax_rate=0.25, invested_capital=0)
    assert result == float("inf") or math.isinf(result)


def test_roe_zero_equity():
    result = fnd.roe(net_profit=50, shareholders_equity=0)
    assert result == float("inf") or math.isinf(result)


def test_net_debt_to_ebitda_zero_ebitda():
    result = fnd.net_debt_to_ebitda(total_debt=100, cash_and_equivalents=50, ebitda=0)
    assert result == float("inf") or math.isinf(result)


def test_interest_coverage_zero_interest():
    result = fnd.interest_coverage(ebit=100, interest_expense=0)
    assert result == float("inf") or math.isinf(result)


def test_current_ratio_zero_liabilities():
    result = fnd.current_ratio(current_assets=100, current_liabilities=0)
    assert result == float("inf") or math.isinf(result)


# ── earnings_stability ──────────────────────────────────────────────────


def test_earnings_stability_less_than_two():
    assert fnd.earnings_stability([1.0]) == 50.0


def test_earnings_stability_zero_stdev():
    assert fnd.earnings_stability([2.0, 2.0, 2.0]) == 50.0


def test_earnings_stability_zero_mean_eps():
    assert fnd.earnings_stability([-1.0, 0.0, 1.0]) == 50.0


def test_earnings_stability_normal():
    result = fnd.earnings_stability([1.0, 1.5, 2.0, 2.5])
    assert 0.0 <= result <= 100.0


# ── revenue_consistency ────────────────────────────────────────────────


def test_revenue_consistency_less_than_two():
    assert fnd.revenue_consistency([100.0]) == 50.0


def test_revenue_consistency_single_growth_rate():
    assert fnd.revenue_consistency([100.0, 200.0]) == 50.0


def test_revenue_consistency_normal():
    result = fnd.revenue_consistency([100.0, 110.0, 121.0, 133.1])
    assert 0.0 <= result <= 100.0


def test_revenue_consistency_skip_zero_prev():
    result = fnd.revenue_consistency([100.0, 0.0, 110.0, 121.0])
    assert 0.0 <= result <= 100.0


# ── payout_sustainability ──────────────────────────────────────────────


def test_payout_sustainability_net_income_zero():
    assert fnd.payout_sustainability(10, 0, 100) == 50.0


def test_payout_sustainability_ocf_zero():
    assert fnd.payout_sustainability(10, 100, 0) == 50.0


def test_payout_sustainability_negative_payout():
    assert fnd.payout_sustainability(-10, 100, 100) == 0.0


def test_payout_sustainability_above_08():
    assert fnd.payout_sustainability(90, 100, 100) == 0.0


def test_payout_sustainability_at_or_below_02():
    result = fnd.payout_sustainability(10, 100, 100)
    assert math.isclose(result, 50.0)


def test_payout_sustainability_at_or_below_06():
    result = fnd.payout_sustainability(40, 100, 100)
    assert math.isclose(result, 100.0)


def test_payout_sustainability_below_08_above_06():
    result = fnd.payout_sustainability(70, 100, 100)
    assert math.isclose(result, 50.0)


# ── Banking-specific metrics ──────────────────────────────────────────


def test_net_interest_margin_zero_assets():
    assert fnd.net_interest_margin(100, 30, 0) == float("inf")


def test_net_interest_margin_normal():
    result = fnd.net_interest_margin(100, 30, 1000)
    assert math.isclose(result, 0.07)


def test_cost_to_income_zero_income():
    assert fnd.cost_to_income(50, 0) == float("inf")


def test_cost_to_income_normal():
    assert fnd.cost_to_income(50, 200) == 0.25


def test_roa_zero_assets():
    assert fnd.roa(100, 0) == float("inf")


def test_roa_normal():
    assert fnd.roa(50, 1000) == 0.05


def test_capital_adequacy_ratio_zero_rwa():
    assert fnd.capital_adequacy_ratio(100, 0) == float("inf")


def test_capital_adequacy_ratio_normal():
    assert fnd.capital_adequacy_ratio(100, 500) == 0.2


def test_npa_ratio_zero_loans():
    assert fnd.npa_ratio(50, 0) == float("inf")


def test_npa_ratio_normal():
    assert fnd.npa_ratio(10, 200) == 0.05
