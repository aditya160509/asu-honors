"""Recompute Fair P/E and Intrinsic Value for all existing CompanyFactorScore rows
using the current PEG-based formulas (Section 6.D). Existing DB values were
computed with the old `max(8.0, peg * growth%)` formula and are stale."""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from db.models import Company, CompanyFactorScore, ConfigParameter, IncomeStatement
from engine.valuation import (
    fair_peg, growth_score_to_rate, fair_pe_from_peg,
    DEFAULT_GROWTH_RATE_MIN, DEFAULT_GROWTH_RATE_MAX,
    DEFAULT_BASELINE_PE, DEFAULT_M_MIN, DEFAULT_M_MAX,
    DEFAULT_M_STEEPNESS, DEFAULT_M_INFLECTION,
)

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///stocksim.db')


def _load_params(session: Session) -> dict[str, float]:
    rows = session.query(ConfigParameter).filter_by(scope='global').all()
    return {r.key: float(r.value) for r in rows}


def _load_neutral_pegs(session: Session) -> dict[int, float]:
    rows = session.query(ConfigParameter).filter_by(key='neutral_industry_peg', scope='industry').all()
    return {r.scope_id: float(r.value) for r in rows}


def _load_latest_eps(session: Session) -> dict[int, float]:
    """Latest EPS per company."""
    eps_by_company: dict[int, float] = {}
    for c in session.query(Company).all():
        inc = (
            session.query(IncomeStatement)
            .filter_by(company_id=c.id)
            .order_by(IncomeStatement.fiscal_period.desc())
            .first()
        )
        if inc and inc.eps:
            eps_by_company[c.id] = float(inc.eps)
    return eps_by_company


def main() -> None:
    engine = create_engine(DATABASE_URL)
    with Session(engine) as session:
        params = _load_params(session)
        neutral_pegs = _load_neutral_pegs(session)
        eps_by_company = _load_latest_eps(session)

        m_min = float(params.get('quality_mult_min', DEFAULT_M_MIN))
        m_max = float(params.get('quality_mult_max', DEFAULT_M_MAX))
        m_k = float(params.get('quality_mult_k', DEFAULT_M_STEEPNESS))
        m_c = float(params.get('quality_mult_inflection', DEFAULT_M_INFLECTION))
        growth_min = float(params.get('growth_rate_min', DEFAULT_GROWTH_RATE_MIN))
        growth_max = float(params.get('growth_rate_max', DEFAULT_GROWTH_RATE_MAX))
        baseline_pe = float(params.get('fair_pe_baseline', DEFAULT_BASELINE_PE))

        company_map: dict[int, Company] = {c.id: c for c in session.query(Company).all()}

        cfs_updated = 0
        for cfs in session.query(CompanyFactorScore).order_by(CompanyFactorScore.id).all():
            ind_id = company_map[cfs.company_id].industry_id
            neutral_peg = neutral_pegs.get(ind_id, 1.0)
            growth_rate_pct = growth_score_to_rate(
                float(cfs.growth_potential), growth_min, growth_max,
            )
            peg = fair_peg(neutral_peg, float(cfs.intrinsic_score), m_min, m_max, m_k, m_c)
            fpe = fair_pe_from_peg(peg, growth_rate_pct, baseline_pe)
            eps = eps_by_company.get(cfs.company_id, 0.0)
            iv = fpe * eps

            cfs.fair_pe = round(fpe, 4)
            cfs.intrinsic_value = round(iv, 4)
            cfs_updated += 1

            if cfs.company_id in company_map:
                company_map[cfs.company_id].fair_pe = round(fpe, 4)
                company_map[cfs.company_id].intrinsic_value = round(iv, 4)

        session.commit()
        print(f'{cfs_updated} CompanyFactorScore rows updated (includes stale historical periods).')


if __name__ == '__main__':
    main()
