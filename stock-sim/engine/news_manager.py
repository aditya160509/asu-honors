"""Section 6.N — Event lifecycle management and news generation."""

import random
import re
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
    market_events = session.query(MarketEvent).order_by(MarketEvent.id).all()

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
    extra_replacements: Optional[dict[str, str]] = None,
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
    ).order_by(NewsTemplate.id).all()
    if not templates:
        return None

    template = rng.choice(templates)
    severity = float(event_instance.resolved_severity)

    # MarketEvent.sentiment is the correctly-authored positive/negative/neutral
    # label for this event type (e.g. "Earnings Miss" -> "negative"). Deriving
    # sentiment from resolved_severity's sign instead was always wrong: every
    # severity_range in seed_events.py is a positive-only magnitude ("15..50"),
    # so resolved_severity is never negative and every news item was
    # unconditionally labeled "positive", even for bad news.
    sentiment = event.sentiment

    headline = template.template_text
    body = template.template_text

    replacements = {}
    if company_name:
        replacements["{company}"] = company_name
        replacements["{company_name}"] = company_name
    elif industry_name:
        replacements["{company}"] = f"a {industry_name} firm"
        replacements["{company_name}"] = f"a {industry_name} firm"
    if industry_name:
        replacements["{industry}"] = industry_name
    if extra_replacements:
        replacements.update(extra_replacements)
    for key, val in replacements.items():
        headline = headline.replace(key, val)
        body = body.replace(key, val)

    # Fill remaining unreplaced {placeholder} tokens with realistic, varied defaults
    first_names = ["James", "Sarah", "Michael", "Emma", "Robert", "Emily", "David", "Jessica",
                    "Thomas", "Amanda", "Christopher", "Laura", "Daniel", "Rachel", "Andrew"]
    last_names = ["Mitchell", "Patel", "Anderson", "Rodriguez", "Thompson", "Chen", "Williams",
                   "Kumar", "O'Brien", "Suzuki", "Johnson", "Al-Farsi", "Mueller"]
    ceo_first = rng.choice(first_names)
    ceo_last = rng.choice(last_names)
    ceo_name = f"{ceo_first} {ceo_last}"

    company_word = (company_name or "").split()[0] if company_name else "industry"
    product_name = rng.choice([
        f"{company_word}Pro", f"{company_word}Max", f"{company_word}Next",
        f"{company_word}Prime", f"{company_word}Edge",
    ]) if company_name else rng.choice(["NovaLine", "OptimaSuite", "VertexCore", "ApexFlow", "PulseSystem"])

    resignation_reasons = [
        "a strategic disagreement with the board",
        "a personal health matter",
        "a mutual decision with the board",
        "an SEC investigation into past practices",
        "pressure from activist investors",
        "a disagreement over company direction",
        "an ethics complaint filed by shareholders",
    ]
    defect_types = [
        "a potential safety hazard", "a manufacturing defect",
        "a software vulnerability", "a quality control failure",
        "a regulatory compliance issue",
    ]
    allegations = [
        "breach of fiduciary duty", "accounting irregularities",
        "insider trading allegations", "securities fraud",
        "anti-competitive practices", "violation of SEC regulations",
        "false advertising claims",
    ]
    tech_names = [
        "next-gen AI algorithms", "quantum-resistant encryption",
        "biometric authentication", "autonomous navigation",
        "blockchain verification", "edge computing infrastructure",
        "carbon-capture technology",
    ]
    indicators = [
        "the manufacturing PMI", "consumer confidence index",
        "housing starts data", "weekly jobless claims",
        "durable goods orders", "retail sales figures",
    ]
    competitor_names = [
        f"{rng.choice(first_names)} {rng.choice(last_names)}'s startup",
        f"Nex{ceo_last[:4]}", f"{ceo_last}Tech",
        rng.choice(["Apex", "Nova", "Prime", "Vertex", "Quantum"]) + rng.choice(["Works", "Corp", "Global", "Systems"]),
    ]

    pct_val = str(round(abs(severity) * rng.uniform(0.5, 1.5), 1))
    amount_val = f"${abs(severity) * rng.uniform(0.01, 0.05):.2f}"
    bps_val = str(int(abs(severity) * rng.uniform(1.0, 3.0)))

    field_def = {
        "{name}": None,
        "{product_name}": None,
        "{defect}": None,
        "{pct}": None,
        "{amount}": None,
        "{bps}": None,
        "{reason}": None,
        "{allegation}": None,
        "{technology}": None,
        "{indicator}": None,
        "{competitor}": None,
    }
    present = {k for k in field_def if k in headline or k in body}

    token_repl = {}
    if "{name}" in present:
        if event.category in ("leadership",):
            token_repl["{name}"] = ceo_name
        elif event.category in ("competition",):
            token_repl["{name}"] = rng.choice(competitor_names)
        else:
            token_repl["{name}"] = ceo_name
    if "{product_name}" in present:
        token_repl["{product_name}"] = product_name
    if "{defect}" in present:
        token_repl["{defect}"] = rng.choice(defect_types)
    if "{pct}" in present:
        token_repl["{pct}"] = pct_val
    if "{amount}" in present:
        token_repl["{amount}"] = amount_val
    if "{bps}" in present:
        token_repl["{bps}"] = bps_val
    if "{reason}" in present:
        token_repl["{reason}"] = rng.choice(resignation_reasons)
    if "{allegation}" in present:
        token_repl["{allegation}"] = rng.choice(allegations)
    if "{technology}" in present:
        token_repl["{technology}"] = rng.choice(tech_names)
    if "{indicator}" in present:
        token_repl["{indicator}"] = rng.choice(indicators)
    if "{competitor}" in present:
        token_repl["{competitor}"] = rng.choice(competitor_names)

    for key, val in token_repl.items():
        headline = headline.replace(key, val)
        body = body.replace(key, val)
    # Last resort: strip any other unknown tokens
    headline = re.sub(r"\{[a-z_]+\}", "", headline)
    body = re.sub(r"\{[a-z_]+\}", "", body)

    company_id = event_instance.scope_ref if event_instance.scope_type == "company" else None
    industry_id = event_instance.scope_ref if event_instance.scope_type == "industry" else None
    if company_id is None and industry_id is None:
        return None

    news_type = event.news_type if event else "both"

    news = NewsFeed(
        timeline_id=timeline_id,
        sim_date=sim_date,
        company_id=company_id,
        industry_id=industry_id,
        headline=headline[:300],
        body=body,
        sentiment=sentiment,
        severity=severity,
        news_type=news_type,
        source_event_instance_id=event_instance.id,
    )
    session.add(news)
    return news


def _parse_range(range_str: str) -> tuple[float, float]:
    """Parse '(-0.3, 0.3)' -> (-0.3, 0.3), or the plain '10..40' form every
    event template in db/seeds/seed_events.py actually uses -> (10.0, 40.0).

    Only handling the comma form here silently defaulted every event's
    resolved_severity to rng.uniform(0.0, 0.0) == 0.0 (the malformed-input
    fallback below), since real seed data never uses commas — meaning no
    event has ever had a nonzero severity, so none has ever affected prices,
    driver values, or company fundamentals.
    """
    cleaned = range_str.strip().strip("()").strip("[]")
    parts = cleaned.split("..") if ".." in cleaned else cleaned.split(",")
    if len(parts) < 2:
        return (0.0, 0.0)
    try:
        return float(parts[0].strip()), float(parts[1].strip())
    except ValueError:
        return (0.0, 0.0)
