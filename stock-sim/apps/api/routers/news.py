"""News feed endpoint."""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from apps.api.database import get_db
from apps.api.schemas import NewsItem
from db.models import Company, Industry, NewsFeed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/news", tags=["News"])


@router.get("/", response_model=list[NewsItem])
def get_news(
    timeline_id: int = 1,
    sim_date: Optional[date] = Query(default=None),
    company_id: Optional[int] = Query(default=None),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> list[NewsItem]:
    query = db.query(NewsFeed).filter_by(timeline_id=timeline_id)
    if sim_date is not None:
        query = query.filter(NewsFeed.sim_date == sim_date)
    if company_id is not None:
        query = query.filter(NewsFeed.company_id == company_id)

    rows = query.order_by(NewsFeed.sim_date.desc(), NewsFeed.id.desc()).offset(offset).limit(limit).all()

    items = []
    for r in rows:
        company_name = None
        industry_name = None
        if r.company_id:
            company = db.query(Company).filter_by(id=r.company_id).first()
            company_name = company.name if company else None
        if r.industry_id:
            industry = db.query(Industry).filter_by(id=r.industry_id).first()
            industry_name = industry.name if industry else None
        items.append(
            NewsItem(
                id=r.id,
                sim_date=r.sim_date,
                headline=r.headline,
                body=r.body,
                sentiment=r.sentiment,
                severity=float(r.severity),
                company_name=company_name,
                industry_name=industry_name,
            )
        )
    return items
