"""One-off backfill: populate companies.usp/employee_count/founded_year/headquarters/ceo.

Safe to run against a live dev DB — it only UPDATEs those five columns on
`companies`, matched by ticker/id from the existing COMPANIES list in
seed_companies.py. Does not touch any other table.

Usage:
    python db/seeds/backfill_company_profiles.py
"""

import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(__file__), "../..")))

from db.models import Company  # noqa: E402
from db.seeds.company_profiles import COMPANY_USPS, derive_profile  # noqa: E402
from db.seeds.seed_companies import COMPANIES  # noqa: E402


def backfill(session: Session) -> int:
    updated = 0
    for idx, row in enumerate(COMPANIES, start=1):
        industry_id, _name, ticker, shares, _float_pct, _beta_m, _beta_s = row
        company = session.query(Company).filter_by(ticker=ticker).first()
        if company is None:
            print(f"WARNING: no company found for ticker {ticker!r}, skipping.")
            continue

        profile = derive_profile(ticker, idx, industry_id, shares)
        usp = COMPANY_USPS.get(ticker)

        changed = (
            company.usp != usp
            or company.employee_count != profile["employee_count"]
            or company.founded_year != profile["founded_year"]
            or company.headquarters != profile["headquarters"]
            or company.ceo != profile["ceo"]
        )
        if changed:
            company.usp = usp
            company.employee_count = profile["employee_count"]
            company.founded_year = profile["founded_year"]
            company.headquarters = profile["headquarters"]
            company.ceo = profile["ceo"]
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
    print(f"backfill_company_profiles.py done. {updated} companies updated.")


if __name__ == "__main__":
    main()
