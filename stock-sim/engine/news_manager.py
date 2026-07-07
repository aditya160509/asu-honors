"""Section 6.N — Event lifecycle management and news generation."""

import random
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from db.models.events import EventInstance, MarketEvent, NewsFeed, NewsTemplate


def select_and_fire_events(
    session: Session,
    timeline_id: int,
    sim_date: date,
    rng: random.Random,
    company_ids: list[int],
    industry_ids: list[int],
    company_industry_map: Optional[dict[int, int]] = None,
) -> list[MarketEvent]:
    """Section 6.N — probabilistically fire events based on their probability_weight.

    For each MarketEvent, draws a random roll. If roll < probability_weight and the
    event's scope matches a target (company/industry/market), creates an EventInstance.
    Market-level events always fire if selected (scope_ref = 0).
    Industry-level events affect a random company in that industry.
    """
    market_events = session.query(MarketEvent).all()

    new_instances: list[EventInstance] = []
    selected_events: list[MarketEvent] = []

    for me in market_events:
        roll = rng.random()
        if roll >= float(me.probability_weight):
            continue
        selected_events.append(me)
        if me.scope == "market":
            instance = EventInstance(
                event_id=me.id,
                timeline_id=timeline_id,
                scope_ref=0,
                scope_type="market",
                sim_date=sim_date,
                resolved_severity=rng.uniform(*_parse_range(me.severity_range)),
                applied_effects=me.effect_profile,
                expires_on=sim_date + timedelta(days=me.duration_days),
            )
            session.add(instance)
            new_instances.append(instance)

        elif me.scope == "industry":
            if not industry_ids:
                continue
            target_ind_id = rng.choice(industry_ids)
            instance = EventInstance(
                event_id=me.id,
                timeline_id=timeline_id,
                scope_ref=target_ind_id,
                scope_type="industry",
                sim_date=sim_date,
                resolved_severity=rng.uniform(*_parse_range(me.severity_range)),
                applied_effects=me.effect_profile,
                expires_on=sim_date + timedelta(days=me.duration_days),
            )
            session.add(instance)
            new_instances.append(instance)

        elif me.scope == "company":
            if not company_ids:
                continue
            target_cid = rng.choice(company_ids)
            instance = EventInstance(
                event_id=me.id,
                timeline_id=timeline_id,
                scope_ref=target_cid,
                scope_type="company",
                sim_date=sim_date,
                resolved_severity=rng.uniform(*_parse_range(me.severity_range)),
                applied_effects=me.effect_profile,
                expires_on=sim_date + timedelta(days=me.duration_days),
            )
            session.add(instance)
            new_instances.append(instance)

    return selected_events


def get_active_events_for_company(
    session: Session,
    timeline_id: int,
    company_id: int,
    industry_id: Optional[int],
    sim_date: date,
) -> list[EventInstance]:
    """Section 6.N — return all active (non-expired) EventInstance rows for a company.

    Includes market-level, industry-level (matching company's industry), and
    company-level events.
    """
    filters = [
        EventInstance.timeline_id == timeline_id,
        EventInstance.expires_on >= sim_date,
    ]
    scope_filters = [
        EventInstance.scope_type == "market",
    ]
    if industry_id is not None:
        scope_filters.append(
            and_(EventInstance.scope_type == "industry", EventInstance.scope_ref == industry_id)
        )
    else:
        scope_filters.append(
            and_(EventInstance.scope_type == "industry", EventInstance.scope_ref.is_(None))
        )
    return session.query(EventInstance).filter(
        *filters,
        or_(
            EventInstance.scope_type == "market",
            and_(EventInstance.scope_type == "company", EventInstance.scope_ref == company_id),
            *scope_filters,
        ),
    ).all()


def generate_news(
    session: Session,
    timeline_id: int,
    sim_date: date,
    event_instance: EventInstance,
    rng: random.Random,
    company_name: Optional[str] = None,
    industry_name: Optional[str] = None,
) -> Optional[NewsFeed]:
    """Section 6.N — generate a NewsFeed row from an EventInstance + NewsTemplate.

    Picks a matching template, substitutes placeholders, creates the NewsFeed record.
    Returns None for market-scope events (no company/industry target).
    """
    event = session.query(MarketEvent).filter_by(id=event_instance.event_id).first()
    if event is None:
        return None

    templates = session.query(NewsTemplate).filter_by(
        category=event.category,
    ).all()
    if not templates:
        return None

    template = rng.choice(templates)
    severity = float(event_instance.resolved_severity)

    sentiment = "positive" if severity > 0 else "negative" if severity < 0 else "neutral"

    headline = template.template_text
    body = template.template_text

    replacements = {}
    if company_name:
        replacements["{company}"] = company_name
        replacements["{company_name}"] = company_name
    if industry_name:
        replacements["{industry}"] = industry_name
    for key, val in replacements.items():
        headline = headline.replace(key, val)
        body = body.replace(key, val)

    company_id = event_instance.scope_ref if event_instance.scope_type == "company" else None
    industry_id = event_instance.scope_ref if event_instance.scope_type == "industry" else None
    if company_id is None and industry_id is None:
        return None

    news = NewsFeed(
        timeline_id=timeline_id,
        sim_date=sim_date,
        company_id=company_id,
        industry_id=industry_id,
        headline=headline[:300],
        body=body,
        sentiment=sentiment,
        severity=severity,
        source_event_instance_id=event_instance.id,
    )
    session.add(news)
    return news


def _parse_range(range_str: str) -> tuple[float, float]:
    """Parse '(-0.3, 0.3)' -> (-0.3, 0.3)."""
    cleaned = range_str.strip().strip("()").strip("[]")
    parts = cleaned.split(",")
    if len(parts) < 2:
        return (0.0, 0.0)
    return float(parts[0].strip()), float(parts[1].strip())
