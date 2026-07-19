"""One-time recompute of Company.volatility for every existing company.

Company.volatility was historically frozen at seed time from
`industry.base_volatility / 100.0` -- identical for every company in an
industry and off by two orders of magnitude vs. how the field is displayed
(a percent-scale annualized figure, e.g. 25.00 for 25%/yr). The engine
(engine/orchestrator.py::_compute_drivers / _update_denormalized_fields) now
computes and persists a real per-company, per-tick figure going forward, but
that only self-corrects as new ticks run. This script recomputes the same
deterministic (non-random) part of that formula -- industry base vol scaled
by company size and balance-sheet leverage -- from each company's *current*
market_cap and latest balance sheet, so the fix is visible immediately.
"""

import math
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.models import BalanceSheet, Company, ConfigParameter, Industry

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///stocksim.db')

TRADING_DAYS_PER_YEAR = 252


def _load_params(session: Session) -> dict[str, float]:
    rows = session.query(ConfigParameter).filter_by(scope='global').all()
    return {r.key: float(r.value) for r in rows}


def _load_latest_balance_sheets(session: Session) -> dict[int, BalanceSheet]:
    latest_bal: dict[int, BalanceSheet] = {}
    for bal in session.query(BalanceSheet).order_by(BalanceSheet.fiscal_period.desc()).all():
        if bal.company_id not in latest_bal:
            latest_bal[bal.company_id] = bal
    return latest_bal


def main() -> None:
    engine = create_engine(DATABASE_URL)
    with Session(engine) as session:
        params = _load_params(session)
        max_lev = float(params.get('vol_max_leverage', 5.0))
        lev_factor = float(params.get('vol_leverage_factor', 0.2))

        industries = {ind.id: ind for ind in session.query(Industry).all()}
        latest_bal = _load_latest_balance_sheets(session)

        updated = 0
        for company in session.query(Company).order_by(Company.id).all():
            industry = industries[company.industry_id]

            mcap = max(float(company.market_cap or 1e9), 1e6)
            log_mcap = math.log(mcap / 1e9)
            f_size = 1.3 - 0.3 * math.tanh(log_mcap / 1.5)

            f_lev = 1.0
            bal = latest_bal.get(company.id)
            if bal:
                td = float(bal.total_debt)
                se = float(bal.shareholders_equity)
                if se > 0:
                    leverage = td / se
                    f_lev = 1.0 + lev_factor * min(leverage, max_lev)

            # Same as engine/orchestrator.py::_update_denormalized_fields:
            # ind_base_vol (daily) * f_size * f_lev, annualized back to a
            # percent-scale figure via * sqrt(252) * 100 -- which simplifies
            # to base_volatility (already an annualized fraction) * f_size *
            # f_lev * 100, since the sqrt(252) division/multiplication cancel.
            annualized_pct = float(industry.base_volatility) * f_size * f_lev * 100.0
            company.volatility = round(annualized_pct, 4)
            updated += 1

        session.commit()
        print(f'{updated} Company rows updated.')


if __name__ == '__main__':
    main()
