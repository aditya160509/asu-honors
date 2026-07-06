"""Section 4.4 — raw fundamental metrics computed from statement line items."""


def operating_margin(ebit: float, revenue: float) -> float:
    """Section 4.4 — Operating Margin = EBIT / Revenue."""
    if revenue == 0:
        return float("inf")
    return ebit / revenue


def roic(ebit: float, tax_rate: float, invested_capital: float) -> float:
    """Section 4.4 — ROIC = EBIT * (1 - tax_rate) / Invested Capital."""
    if invested_capital == 0:
        return float("inf")
    return ebit * (1 - tax_rate) / invested_capital


def roe(net_profit: float, shareholders_equity: float) -> float:
    """Section 4.4 — ROE = Net Profit / Shareholders' Equity."""
    if shareholders_equity == 0:
        return float("inf")
    return net_profit / shareholders_equity


def asset_turnover(revenue: float, total_assets: float) -> float:
    """Section 4.4 — Asset Turnover = Revenue / Total Assets."""
    if total_assets == 0:
        return float("inf")
    return revenue / total_assets


def days_sales_outstanding(receivables: float, revenue: float, period_days: float = 365) -> float:
    """Section 4.4 — DSO = Receivables / Revenue * period_days."""
    return receivables / revenue * period_days


def days_inventory_outstanding(inventory: float, cogs: float, period_days: float = 365) -> float:
    """Section 4.4 — DIO = Inventory / COGS * period_days."""
    return inventory / cogs * period_days


def days_payables_outstanding(payables: float, cogs: float, period_days: float = 365) -> float:
    """Section 4.4 — DPO = Payables / COGS * period_days."""
    return payables / cogs * period_days


def cash_conversion_cycle(dso: float, dio: float, dpo: float) -> float:
    """Section 4.4 — CCC = DSO + DIO - DPO."""
    return dso + dio - dpo


def net_debt_to_ebitda(total_debt: float, cash_and_equivalents: float, ebitda: float) -> float:
    """Section 4.4 — Net Debt / EBITDA = (Total Debt - Cash) / EBITDA."""
    if ebitda == 0:
        return float("inf")
    return (total_debt - cash_and_equivalents) / ebitda


def interest_coverage(ebit: float, interest_expense: float) -> float:
    """Section 4.4 — Interest Coverage = EBIT / Interest Expense."""
    if interest_expense == 0:
        return float("inf")
    return ebit / interest_expense


def current_ratio(current_assets: float, current_liabilities: float) -> float:
    """Section 4.4 — Current Ratio = Current Assets / Current Liabilities."""
    if current_liabilities == 0:
        return float("inf")
    return current_assets / current_liabilities


def accruals_ratio(net_profit: float, operating_cash_flow: float, total_assets: float) -> float:
    """Section 4.4 — Accruals Ratio = (Net Profit - Operating Cash Flow) / Total Assets."""
    return (net_profit - operating_cash_flow) / total_assets


def free_cash_flow_margin(free_cash_flow: float, revenue: float) -> float:
    """Section 4.4 — FCF Margin = Free Cash Flow / Revenue."""
    return free_cash_flow / revenue


def gross_margin(gross_profit: float, revenue: float) -> float:
    """Section 4.4 — Gross Margin = Gross Profit / Revenue."""
    return gross_profit / revenue


def earnings_stability(eps_history: list[float]) -> float:
    """Section 4.4 (FQ-1) — Inverse of stdev of historical EPS scores stability.

    max(0, 100 - stdev * 100 / abs(mean_eps)) when mean_eps != 0,
    else 50.0.  Returns 50.0 (neutral) for series < 2 values or zero stdev.
    """
    if len(eps_history) < 2:
        return 50.0
    mean_eps = sum(eps_history) / len(eps_history)
    var = sum((x - mean_eps) ** 2 for x in eps_history) / len(eps_history)
    stdev = var ** 0.5
    if stdev == 0:
        return 50.0
    if mean_eps == 0:
        return 50.0
    return max(0.0, 100.0 - stdev * 100.0 / abs(mean_eps))


def revenue_consistency(revenue_history: list[float]) -> float:
    """Section 4.4 (FQ-2) — Inverse of volatility of historical revenue growth.

    Computes year-over-year growth rates, then max(0, 100 - stdev_of_growth * 100).
    Returns 50.0 (neutral) for series < 2 values.
    """
    if len(revenue_history) < 2:
        return 50.0
    growth_rates = []
    for i in range(1, len(revenue_history)):
        prev = revenue_history[i - 1]
        if prev == 0:
            continue
        growth_rates.append((revenue_history[i] - prev) / prev)
    if len(growth_rates) < 2:
        return 50.0
    mean_g = sum(growth_rates) / len(growth_rates)
    var_g = sum((x - mean_g) ** 2 for x in growth_rates) / len(growth_rates)
    stdev_g = var_g ** 0.5
    return max(0.0, 100.0 - stdev_g * 100.0)


def payout_sustainability(
    dividends: float,
    net_income: float,
    operating_cash_flow: float,
) -> float:
    """Section 4.4 (FQ-3) — Mid-band best payout sustainability score.

    If net_income <= 0 or operating_cash_flow <= 0, returns 50.0 (neutral).
    Payout ratio = dividends / max(net_income, operating_cash_flow).
    Score: [0, 0.2) linear 0→100, [0.2, 0.6] → 100, (0.6, 0.8] linear 100→0,
    0 elsewhere.
    """
    if net_income <= 0 or operating_cash_flow <= 0:
        return 50.0
    payout = dividends / max(net_income, operating_cash_flow)
    if payout < 0.0 or payout > 0.8:
        return 0.0
    if payout <= 0.2:
        return payout / 0.2 * 100.0
    if payout <= 0.6:
        return 100.0
    # 0.6 < payout <= 0.8
    return (0.8 - payout) / 0.2 * 100.0


# ── Banking-specific metrics (Section 4.4.1) ──────────────────────


def net_interest_margin(
    interest_income: float,
    interest_expense: float,
    avg_earning_assets: float,
) -> float:
    """Section 4.4.1 — NIM = (Interest Income - Interest Expense) / Average Earning Assets."""
    if avg_earning_assets == 0:
        return float("inf")
    return (interest_income - interest_expense) / avg_earning_assets


def cost_to_income(operating_expenses: float, total_income: float) -> float:
    """Section 4.4.1 — Cost-to-Income Ratio = Operating Expenses / Total Income (lower better)."""
    if total_income == 0:
        return float("inf")
    return operating_expenses / total_income


def roa(net_profit: float, total_assets: float) -> float:
    """Section 4.4.1 — ROA = Net Profit / Total Assets."""
    if total_assets == 0:
        return float("inf")
    return net_profit / total_assets


def capital_adequacy_ratio(equity: float, risk_weighted_assets: float) -> float:
    """Section 4.4.1 — CAR = Equity / Risk-Weighted Assets (regulatory minimum ~8%)."""
    if risk_weighted_assets == 0:
        return float("inf")
    return equity / risk_weighted_assets


def npa_ratio(non_performing_loans: float, total_loans: float) -> float:
    """Section 4.4.1 — NPA Ratio = Non-Performing Loans / Total Loans (lower better)."""
    if total_loans == 0:
        return float("inf")
    return non_performing_loans / total_loans
