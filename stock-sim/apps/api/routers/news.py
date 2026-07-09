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

    company_ids = {r.company_id for r in rows if r.company_id}
    industry_ids = {r.industry_id for r in rows if r.industry_id}
    companies = {c.id: c.name for c in db.query(Company).filter(Company.id.in_(company_ids)).all()} if company_ids else {}
    industries = {i.id: i.name for i in db.query(Industry).filter(Industry.id.in_(industry_ids)).all()} if industry_ids else {}

    items = []
    for r in rows:
        items.append(
            NewsItem(
                id=r.id,
                sim_date=r.sim_date,
                headline=r.headline,
                body=r.body,
                sentiment=r.sentiment,
                severity=float(r.severity) if r.severity is not None else 0.0,
                company_name=companies.get(r.company_id) if r.company_id else None,
                industry_name=industries.get(r.industry_id) if r.industry_id else None,
            )
        )
    return items
