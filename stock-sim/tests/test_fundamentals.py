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
