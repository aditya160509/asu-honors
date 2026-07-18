"""One-off backfill: populate companies.description for existing rows by ticker.

Safe to run against a live dev DB that already has companies/financials/ticks —
it only UPDATEs the `description` column on `companies`, matched by `ticker`.
It does not touch any other table and never truncates or deletes.

Usage:
    python db/seeds/backfill_company_descriptions.py
"""

import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "../..")))

from db.models import Company  # noqa: E402
from db.seeds.company_descriptions import COMPANY_DESCRIPTIONS  # noqa: E402


def backfill(session: Session) -> int:
    updated = 0
    for ticker, description in COMPANY_DESCRIPTIONS.items():
        company = session.query(Company).filter_by(ticker=ticker).first()
        if company is None:
            print(f"WARNING: no company found for ticker {ticker!r}, skipping.")
            continue
        if company.description != description:
            company.description = description
            updated += 1
    return updated


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://stocksim:stocksim@localhost:5432/stocksim",
    )
    engine = create_engine(database_url)
    with Session(engine) as session:
        updated = backfill(session)
        session.commit()
    print(f"backfill_company_descriptions.py done. {updated} companies updated.")


if __name__ == "__main__":
    main()
