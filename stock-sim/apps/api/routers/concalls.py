"""Quarterly conference-call (con-call) endpoint."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from apps.api.database import get_db
from apps.api.schemas import ConCallItem
from db.models import Company, ConCall, ConsensusEstimate, IncomeStatement

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Con-Calls"])


@router.get("/companies/{ticker}/concalls", response_model=list[ConCallItem])
def get_concalls(
    ticker: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ConCallItem]:
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if company is None:
        raise HTTPException(status_code=404, detail=f"Company '{ticker}' not found")

    rows = (
        db.query(ConCall)
        .filter(ConCall.company_id == company.id)
        .order_by(ConCall.fiscal_period.desc(), ConCall.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    fiscal_periods = [r.fiscal_period for r in rows]
    actual_eps_by_period: dict[str, float] = {
        inc.fiscal_period: float(inc.eps)
        for inc in db.query(IncomeStatement).filter(
            IncomeStatement.company_id == company.id,
            IncomeStatement.fiscal_period.in_(fiscal_periods),
        )
    }
    consensus_eps_by_period: dict[str, float] = {
        ce.fiscal_period: float(ce.consensus_eps)
        for ce in db.query(ConsensusEstimate).filter(
            ConsensusEstimate.company_id == company.id,
            ConsensusEstimate.fiscal_period.in_(fiscal_periods),
        )
    }

    return [
        ConCallItem(
            id=r.id,
            company_id=r.company_id,
            fiscal_period=r.fiscal_period,
            call_date=r.call_date,
            performance_bucket=r.performance_bucket,
            tone=r.tone,
            tone_score=float(r.tone_score),
            guidance_revenue_growth=float(r.guidance_revenue_growth),
            statements=r.statements,
            actual_eps=actual_eps_by_period.get(r.fiscal_period),
            consensus_eps=consensus_eps_by_period.get(r.fiscal_period),
        )
        for r in rows
    ]
