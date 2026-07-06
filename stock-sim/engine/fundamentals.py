"""Section 4.4 — raw fundamental metrics computed from statement line items."""


def operating_margin(ebit: float, revenue: float) -> float:
    """Section 4.4 — Operating Margin = EBIT / Revenue."""
    return ebit / revenue


def roic(ebit: float, tax_rate: float, invested_capital: float) -> float:
    """Section 4.4 — ROIC = EBIT * (1 - tax_rate) / Invested Capital."""
    return ebit * (1 - tax_rate) / invested_capital


def roe(net_profit: float, shareholders_equity: float) -> float:
    """Section 4.4 — ROE = Net Profit / Shareholders' Equity."""
    return net_profit / shareholders_equity


def asset_turnover(revenue: float, total_assets: float) -> float:
    """Section 4.4 — Asset Turnover = Revenue / Total Assets."""
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
    return (total_debt - cash_and_equivalents) / ebitda


def interest_coverage(ebit: float, interest_expense: float) -> float:
    """Section 4.4 — Interest Coverage = EBIT / Interest Expense."""
    return ebit / interest_expense


def current_ratio(current_assets: float, current_liabilities: float) -> float:
    """Section 4.4 — Current Ratio = Current Assets / Current Liabilities."""
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
