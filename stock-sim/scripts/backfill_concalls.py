"""Backfill ConCall rows for fiscal periods that already have IncomeStatement
data but predate engine.orchestrator._generate_concalls_for_quarter's
introduction (see commit 41ec929) -- i.e. quarters that closed before the
con_calls table existed.

Idempotent: skips any (company_id, fiscal_period) pair that already has a
ConCall row, so it's safe to rerun after a fresh `Advance` crosses a new
quarter boundary (that boundary's calls are generated live by the
orchestrator and this script will just see them as already-existing).

Usage:
    python scripts/backfill_concalls.py [--timeline-id 1]
"""
import argparse
import os
import random
import sys
from datetime import timedelta

os.environ.setdefault("DATABASE_URL", "sqlite:///stocksim.db")

from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    CompanyFactorScore,
    ConCall,
    ConsensusEstimate,
    IncomeStatement,
    SimulationState,
)
from engine.concalls import generate_concall
from engine.orchestrator import QUARTER_LENGTH, _quarter_market_performance


def _quarter_call_date(timeline_id: int, fiscal_period: str, session: Session):
    """Approximate the sim_date a quarter boundary landed on, from
    FIRST_SIM_DATE + QUARTER_LENGTH * (how many quarters into the sim this
    fiscal_period is). Matches the tick-count -> fiscal_period mapping in
    engine.orchestrator._compute_fiscal_period, run in reverse.
    """
    from db.seeds.seed_initial_prices import FIRST_SIM_DATE

    year_str, q_str = fiscal_period.split("Q")
    year, quarter = int(year_str), int(q_str)
    quarters_elapsed = (year - 2026) * 4 + (quarter - 1)
    if quarters_elapsed <= 0:
        return FIRST_SIM_DATE
    return FIRST_SIM_DATE + timedelta(days=QUARTER_LENGTH * quarters_elapsed)


def backfill(session: Session, timeline_id: int) -> int:
    sim_state = session.query(SimulationState).filter_by(timeline_id=timeline_id).first()
    if sim_state is None:
        raise ValueError(f"No SimulationState for timeline {timeline_id}")

    companies = session.query(Company).all()
    company_by_id = {c.id: c for c in companies}
    company_ids = list(company_by_id.keys())

    periods = [
        row[0] for row in
        session.query(IncomeStatement.fiscal_period).distinct().order_by(IncomeStatement.fiscal_period).all()
    ]

    rng = random.Random(sim_state.id)  # deterministic per timeline, independent of live sim rng
    created = 0

    for period in periods:
        existing_calls = {
            row.company_id
            for row in session.query(ConCall.company_id).filter_by(fiscal_period=period).all()
        }

        income_by_company = {
            row.company_id: row
            for row in session.query(IncomeStatement).filter_by(fiscal_period=period).all()
        }
        cfs_by_company = {
            row.company_id: row
            for row in session.query(CompanyFactorScore).filter_by(fiscal_period=period).all()
        }
        consensus_by_company = {
            row.company_id: row
            for row in session.query(ConsensusEstimate).filter_by(fiscal_period=period).all()
        }
        balance_sheet_by_company = {
            row.company_id: row
            for row in session.query(BalanceSheet).filter_by(fiscal_period=period).all()
        }
        cash_flow_by_company = {
            row.company_id: row
            for row in session.query(CashFlowStatement).filter_by(fiscal_period=period).all()
        }

        call_date = _quarter_call_date(timeline_id, period, session)
        quarter_start = call_date - timedelta(days=QUARTER_LENGTH)
        market_performance_by_company = _quarter_market_performance(
            session, timeline_id, company_ids, quarter_start, call_date,
        )

        for company_id, company in company_by_id.items():
            if company_id in existing_calls:
                continue
            income_stmt = income_by_company.get(company_id)
            if income_stmt is None:
                continue  # this company had no financials refreshed this period

            prior_income_stmt = session.query(IncomeStatement).filter(
                IncomeStatement.company_id == company_id,
                IncomeStatement.fiscal_period < period,
            ).order_by(IncomeStatement.fiscal_period.desc()).first()

            cfs = cfs_by_company.get(company_id)
            management_quality = float(cfs.management_quality) if cfs else 50.0
            growth_potential = float(cfs.growth_potential) if cfs else 50.0
            moat_score = float(cfs.moat_score) if cfs else None

            concall = generate_concall(
                company=company,
                income_stmt=income_stmt,
                prior_income_stmt=prior_income_stmt,
                consensus=consensus_by_company.get(company_id),
                management_quality=management_quality,
                growth_potential=growth_potential,
                fiscal_period=period,
                call_date=call_date,
                rng=rng,
                balance_sheet=balance_sheet_by_company.get(company_id),
                cash_flow=cash_flow_by_company.get(company_id),
                moat_score=moat_score,
                market_performance=market_performance_by_company.get(company_id),
            )
            session.add(concall)
            created += 1

        session.flush()
        print(f"{period}: {len(income_by_company) - len(existing_calls)} con-calls generated "
              f"({len(existing_calls)} already existed)")

    return created


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeline-id", type=int, default=1)
    args = parser.parse_args()

    engine = create_engine("sqlite:///stocksim.db", connect_args={"check_same_thread": False})
    with Session(engine) as session:
        created = backfill(session, args.timeline_id)
        session.commit()
        print(f"\nDone. {created} ConCall rows created.")


if __name__ == "__main__":
    main()
