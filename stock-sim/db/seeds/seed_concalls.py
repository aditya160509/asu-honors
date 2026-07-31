"""Seed one deterministic, financially grounded concall per company."""

import os
import random
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.models import (
    BalanceSheet, CashFlowStatement, Company, CompanyFactorScore,
    ConCall, ConsensusEstimate, IncomeStatement,
)
from engine.concalls import generate_concall


def seed(session: Session) -> None:
    for company in session.query(Company).order_by(Company.id).all():
        statements = (
            session.query(IncomeStatement)
            .filter_by(company_id=company.id, timeline_id=1)
            .order_by(IncomeStatement.fiscal_period.desc())
            .limit(2).all()
        )
        if not statements:
            continue
        latest = statements[0]
        if session.query(ConCall).filter_by(company_id=company.id, fiscal_period=latest.fiscal_period).first():
            continue
        prior = statements[1] if len(statements) > 1 else None
        consensus = session.query(ConsensusEstimate).filter_by(
            company_id=company.id, timeline_id=1, fiscal_period=latest.fiscal_period,
        ).first()
        factors = session.query(CompanyFactorScore).filter_by(company_id=company.id, timeline_id=1).order_by(
            CompanyFactorScore.fiscal_period.desc()
        ).first()
        balance = session.query(BalanceSheet).filter_by(
            company_id=company.id, timeline_id=1, fiscal_period=latest.fiscal_period,
        ).first()
        cash_flow = session.query(CashFlowStatement).filter_by(
            company_id=company.id, timeline_id=1, fiscal_period=latest.fiscal_period,
        ).first()
        session.add(generate_concall(
            company=company,
            income_stmt=latest,
            prior_income_stmt=prior,
            consensus=consensus,
            management_quality=float(factors.management_quality) if factors else 50.0,
            growth_potential=float(factors.growth_potential) if factors else 50.0,
            fiscal_period=latest.fiscal_period,
            call_date=date.today(),
            rng=random.Random(42_000 + company.id),
            balance_sheet=balance,
            cash_flow=cash_flow,
            moat_score=float(factors.moat_score) if factors and factors.moat_score is not None else None,
        ))


def main() -> None:
    url = os.environ.get("DATABASE_URL", "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim")
    with Session(create_engine(url)) as session:
        seed(session)
        session.commit()
    print("seed_concalls.py done.")


if __name__ == "__main__":
    main()
