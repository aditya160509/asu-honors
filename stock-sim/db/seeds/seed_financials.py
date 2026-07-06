"""Seed 4 quarters of placeholder financial statements for all 150 companies."""

import os
import random
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from db.models import BalanceSheet, CashFlowStatement, Company, ConsensusEstimate, IncomeStatement

INDUSTRY_BASE_REVENUE = {
    1: 2000,
    2: 1500,
    3: 1200,
    4: 3000,
    5: 2500,
    6: 5000,
    7: 1800,
    8: 1500,
    9: 1200,
    10: 800,
    11: 2500,
    12: 3500,
    13: 2000,
    14: 1500,
    15: 1000,
}

FISCAL_PERIODS = ["2026Q1", "2026Q2", "2026Q3", "2026Q4"]

NO_INVENTORY_INDUSTRIES = {1, 10}


def seed(session: Session) -> None:
    companies = session.query(Company).all()

    for company in companies:
        base_revenue = INDUSTRY_BASE_REVENUE.get(company.industry_id, 1000)

        for qi, period in enumerate(FISCAL_PERIODS):
            rng = random.Random(company.id * 100 + qi)

            # ── Income Statement (partial, before interest) ──────────
            revenue = base_revenue * rng.uniform(0.9, 1.1)
            cogs = revenue * rng.uniform(0.40, 0.70)
            gross_profit = revenue - cogs
            operating_expenses = revenue * rng.uniform(0.10, 0.30)
            ebitda = gross_profit - operating_expenses
            depreciation_amortization = ebitda * rng.uniform(0.10, 0.30)
            ebit = ebitda - depreciation_amortization

            # ── Balance Sheet (needed for interest expense) ──────────
            cash = revenue * rng.uniform(0.05, 0.20)
            receivables = revenue * rng.uniform(0.08, 0.15)
            if company.industry_id in NO_INVENTORY_INDUSTRIES:
                inventory = 0
            else:
                inventory = cogs * rng.uniform(0.10, 0.25)
            current_assets = cash + receivables + inventory

            ppe = revenue * rng.uniform(0.30, 0.80)

            if company.industry_id in (2, 3):
                intangibles = revenue * rng.uniform(0.20, 0.50)
            else:
                intangibles = revenue * rng.uniform(0.10, 0.40)

            total_assets = current_assets + ppe + intangibles

            payables = cogs * rng.uniform(0.05, 0.15)
            short_term_debt = total_assets * rng.uniform(0.05, 0.20)
            current_liabilities = payables + short_term_debt
            long_term_debt = total_assets * rng.uniform(0.10, 0.35)
            total_debt = short_term_debt + long_term_debt
            total_liabilities = current_liabilities + long_term_debt
            shareholders_equity = max(total_assets - total_liabilities, total_assets * 0.05)
            invested_capital = total_debt + shareholders_equity

            # ── Complete Income Statement ────────────────────────────
            interest_expense = total_debt * rng.uniform(0.03, 0.06) / 4
            pretax_income = ebit - interest_expense
            tax = pretax_income * 0.25 if pretax_income > 0 else 0
            net_profit = pretax_income - tax
            eps = net_profit / company.shares_outstanding if company.shares_outstanding > 0 else 0
            shares_diluted = company.shares_outstanding * rng.uniform(1.0, 1.05)

            # ── Cash Flow Statement ──────────────────────────────────
            operating_cash_flow = net_profit * rng.uniform(0.80, 1.50)
            capex = revenue * rng.uniform(0.03, 0.10)
            free_cash_flow = operating_cash_flow - capex
            investing_cash_flow = -capex - rng.uniform(0, revenue * 0.02)
            financing_cash_flow = rng.uniform(-revenue * 0.05, revenue * 0.02)
            dividends_paid = net_profit * rng.uniform(0, 0.50) if net_profit > 0 else 0
            buybacks = net_profit * rng.uniform(0, 0.10) if net_profit > 0 else 0
            net_change_in_cash = operating_cash_flow + investing_cash_flow + financing_cash_flow

            # ── Consensus Estimates ──────────────────────────────────
            consensus_eps = eps * rng.uniform(0.90, 1.10)
            consensus_revenue = revenue * rng.uniform(0.95, 1.05)

            # ── Insert with idempotency ──────────────────────────────
            if not session.query(IncomeStatement).filter_by(company_id=company.id, fiscal_period=period).first():
                session.add(IncomeStatement(
                    company_id=company.id, fiscal_period=period,
                    revenue=revenue, cogs=cogs, gross_profit=gross_profit,
                    operating_expenses=operating_expenses, ebitda=ebitda,
                    depreciation_amortization=depreciation_amortization, ebit=ebit,
                    interest_expense=interest_expense, pretax_income=pretax_income,
                    tax=tax, net_profit=net_profit, eps=eps, shares_diluted=shares_diluted,
                ))

            if not session.query(BalanceSheet).filter_by(company_id=company.id, fiscal_period=period).first():
                session.add(BalanceSheet(
                    company_id=company.id, fiscal_period=period,
                    cash_and_equivalents=cash, receivables=receivables,
                    inventory=inventory, current_assets=current_assets,
                    ppe=ppe, intangibles=intangibles, total_assets=total_assets,
                    payables=payables, short_term_debt=short_term_debt,
                    current_liabilities=current_liabilities, long_term_debt=long_term_debt,
                    total_debt=total_debt, total_liabilities=total_liabilities,
                    shareholders_equity=shareholders_equity, invested_capital=invested_capital,
                ))

            if not session.query(CashFlowStatement).filter_by(company_id=company.id, fiscal_period=period).first():
                session.add(CashFlowStatement(
                    company_id=company.id, fiscal_period=period,
                    operating_cash_flow=operating_cash_flow, capex=capex,
                    free_cash_flow=free_cash_flow, investing_cash_flow=investing_cash_flow,
                    financing_cash_flow=financing_cash_flow, dividends_paid=dividends_paid,
                    buybacks=buybacks, net_change_in_cash=net_change_in_cash,
                ))

            if not session.query(ConsensusEstimate).filter_by(company_id=company.id, fiscal_period=period).first():
                session.add(ConsensusEstimate(
                    company_id=company.id, fiscal_period=period,
                    consensus_eps=consensus_eps, consensus_revenue=consensus_revenue,
                ))


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_financials.py done.")


if __name__ == "__main__":
    main()
