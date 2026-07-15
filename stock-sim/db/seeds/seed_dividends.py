"""Seed quarterly dividend schedules per company per timeline.

Amount per share is derived from the company's seeded cash-flow statements
(dividends_paid / shares_outstanding, per quarter); companies whose financials
pay no dividends get no schedule — a legitimately common case the UI's empty
state is designed for. Ex-dates are laid out quarterly across a window around
the timeline's current sim date so both "Received" and "Upcoming" have data.
"""

import os
import random
import sys
from datetime import timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from db.models import CashFlowStatement, Company, Dividend, SimulationState, Timeline

QUARTERS_BACK = 4
QUARTERS_FORWARD = 2
QUARTER_DAYS = 91
DECLARED_LEAD_DAYS = 45  # declared ~six weeks before ex-date
PAYMENT_LAG_DAYS = 14  # paid ~two weeks after ex-date

# Per-share amounts target a plausible quarterly yield band on the company's
# current price. The financials' dividends_paid only gates WHO pays (its
# whole-company units don't divide into a sane per-share figure against the
# seeded share counts), not HOW MUCH.
MIN_QUARTERLY_YIELD = 0.004
MAX_QUARTERLY_YIELD = 0.012


def seed(session: Session) -> None:
    timelines = session.query(Timeline).all()
    companies = session.query(Company).all()

    # Per-quarter average dividends_paid per company from the seeded financials.
    paid_rows = session.query(CashFlowStatement).all()
    paid_by_company: dict[int, list[float]] = {}
    for row in paid_rows:
        paid_by_company.setdefault(row.company_id, []).append(abs(float(row.dividends_paid)))

    for timeline in timelines:
        state = session.query(SimulationState).filter_by(timeline_id=timeline.id).first()
        if state is None:
            continue
        current = state.current_sim_date

        for company in companies:
            payments = paid_by_company.get(company.id)
            if not payments:
                continue
            avg_quarterly_paid = sum(payments) / len(payments)
            if avg_quarterly_paid <= 0:
                continue
            price = float(company.current_price or 0)
            if price <= 0:
                continue

            # Stable per-company jitter so reruns are idempotent-ish in shape.
            rng = random.Random(company.id * 7919 + timeline.id)
            per_share = price * rng.uniform(MIN_QUARTERLY_YIELD, MAX_QUARTERLY_YIELD)
            if per_share < 0.0001:
                continue
            anchor = current - timedelta(days=rng.randint(0, QUARTER_DAYS - 1))

            for q in range(-QUARTERS_BACK, QUARTERS_FORWARD + 1):
                ex_date = anchor + timedelta(days=q * QUARTER_DAYS)
                exists = (
                    session.query(Dividend)
                    .filter_by(company_id=company.id, timeline_id=timeline.id, ex_date=ex_date)
                    .first()
                )
                if exists:
                    continue
                amount = round(per_share * rng.uniform(0.9, 1.1), 4)
                if amount <= 0:
                    continue
                session.add(
                    Dividend(
                        company_id=company.id,
                        timeline_id=timeline.id,
                        declared_date=ex_date - timedelta(days=DECLARED_LEAD_DAYS),
                        ex_date=ex_date,
                        payment_date=ex_date + timedelta(days=PAYMENT_LAG_DAYS),
                        amount_per_share=amount,
                    )
                )


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        seed(session)
        session.commit()
    print("seed_dividends.py done.")


if __name__ == "__main__":
    main()
