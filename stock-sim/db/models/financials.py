from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin


class IncomeStatement(Base, TimestampMixin):
    __tablename__ = "income_statements"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(10), nullable=False)
    revenue: Mapped[float] = mapped_column(Numeric, nullable=False)
    cogs: Mapped[float] = mapped_column(Numeric, nullable=False)
    gross_profit: Mapped[float] = mapped_column(Numeric, nullable=False)
    operating_expenses: Mapped[float] = mapped_column(Numeric, nullable=False)
    ebitda: Mapped[float] = mapped_column(Numeric, nullable=False)
    depreciation_amortization: Mapped[float] = mapped_column(Numeric, nullable=False)
    ebit: Mapped[float] = mapped_column(Numeric, nullable=False)
    interest_expense: Mapped[float] = mapped_column(Numeric, nullable=False)
    pretax_income: Mapped[float] = mapped_column(Numeric, nullable=False)
    tax: Mapped[float] = mapped_column(Numeric, nullable=False)
    net_profit: Mapped[float] = mapped_column(Numeric, nullable=False)
    eps: Mapped[float] = mapped_column(Numeric, nullable=False)
    shares_diluted: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_period", name="uq_income_statements_company_period"),
    )


class BalanceSheet(Base, TimestampMixin):
    __tablename__ = "balance_sheets"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(10), nullable=False)
    cash_and_equivalents: Mapped[float] = mapped_column(Numeric, nullable=False)
    receivables: Mapped[float] = mapped_column(Numeric, nullable=False)
    inventory: Mapped[float] = mapped_column(Numeric, nullable=False)
    current_assets: Mapped[float] = mapped_column(Numeric, nullable=False)
    ppe: Mapped[float] = mapped_column(Numeric, nullable=False)
    intangibles: Mapped[float] = mapped_column(Numeric, nullable=False)
    total_assets: Mapped[float] = mapped_column(Numeric, nullable=False)
    payables: Mapped[float] = mapped_column(Numeric, nullable=False)
    short_term_debt: Mapped[float] = mapped_column(Numeric, nullable=False)
    current_liabilities: Mapped[float] = mapped_column(Numeric, nullable=False)
    long_term_debt: Mapped[float] = mapped_column(Numeric, nullable=False)
    total_debt: Mapped[float] = mapped_column(Numeric, nullable=False)
    total_liabilities: Mapped[float] = mapped_column(Numeric, nullable=False)
    shareholders_equity: Mapped[float] = mapped_column(Numeric, nullable=False)
    invested_capital: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_period", name="uq_balance_sheets_company_period"),
    )


class CashFlowStatement(Base, TimestampMixin):
    __tablename__ = "cash_flow_statements"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(10), nullable=False)
    operating_cash_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    capex: Mapped[float] = mapped_column(Numeric, nullable=False)
    free_cash_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    investing_cash_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    financing_cash_flow: Mapped[float] = mapped_column(Numeric, nullable=False)
    dividends_paid: Mapped[float] = mapped_column(Numeric, nullable=False)
    buybacks: Mapped[float] = mapped_column(Numeric, nullable=False)
    net_change_in_cash: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_period", name="uq_cash_flow_statements_company_period"),
    )


class ConsensusEstimate(Base, TimestampMixin):
    __tablename__ = "consensus_estimates"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(10), nullable=False)
    consensus_eps: Mapped[float] = mapped_column(Numeric, nullable=False)
    consensus_revenue: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_period", name="uq_consensus_estimates_company_period"),
    )
