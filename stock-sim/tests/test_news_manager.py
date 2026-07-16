"""Tests for engine/news_manager.py — event selection, news generation, and helpers."""

import os
import random
from datetime import date

from sqlalchemy import create_engine, event as sa_event
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from db.models import Base
from db.models.events import EventInstance, MarketEvent, NewsFeed, NewsTemplate
from db.models.simulation import Timeline
from engine.news_manager import (
    _parse_range,
    generate_news,
    get_active_events_for_company,
    select_and_fire_events,
)


def _session():
    engine = create_engine("sqlite:///:memory:", echo=False)

    from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

    SQLiteTypeCompiler.visit_JSONB = SQLiteTypeCompiler.visit_JSON

    @sa_event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    s = Session(engine)
    return s


def _add_timeline(s: Session, timeline_id: int = 1):
    s.add(Timeline(id=timeline_id, name="test", rng_seed=42, is_live=False))
    s.commit()


# ── _parse_range ───────────────────────────────────────────────────────


def test_parse_range_standard():
    lo, hi = _parse_range("(-0.3, 0.3)")
    assert lo == -0.3
    assert hi == 0.3


def test_parse_range_brackets():
    lo, hi = _parse_range("[0.1, 0.5]")
    assert lo == 0.1
    assert hi == 0.5


def test_parse_range_malformed_returns_default():
    assert _parse_range("") == (0.0, 0.0)
    assert _parse_range("1.0") == (0.0, 0.0)


def test_parse_range_double_dot_form():
    # The actual format every event template in db/seeds/seed_events.py uses —
    # regression test for the bug where only the comma form was recognized,
    # silently zeroing every event's resolved_severity.
    lo, hi = _parse_range("10..40")
    assert lo == 10.0
    assert hi == 40.0


# ── select_and_fire_events ─────────────────────────────────────────────


def test_select_and_fire_skipped_when_roll_ge_probability():
    """Event with probability_weight=0 is always skipped (line 37 continue)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Skip", category="t", scope="market",
        severity_range="(0.1,0.3)", sentiment="neutral",
        effect_profile="{}", duration_days=5, decay_rate=0.1,
        probability_weight=0.0,
    ))
    s.commit()

    rng = random.Random(42)
    selected = select_and_fire_events(s, 1, date(2026, 1, 2), rng, [1], [1])
    assert selected == []
    s.close()


def test_select_and_fire_industry_scope():
    """Industry-scope event creates an EventInstance with scope_type='industry' (lines 54-68)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Ind Event", category="t", scope="industry",
        severity_range="(0.1,0.3)", sentiment="neutral",
        effect_profile="{}", duration_days=5, decay_rate=0.1,
        probability_weight=1.0,
    ))
    s.commit()

    rng = random.Random(42)
    selected = select_and_fire_events(s, 1, date(2026, 1, 2), rng, [1], [10])
    assert len(selected) == 1

    instances = s.query(EventInstance).all()
    assert len(instances) == 1
    assert instances[0].scope_type == "industry"
    assert instances[0].scope_ref == 10
    s.close()


def test_select_and_fire_company_empty_ids_skips():
    """Company-scope event with empty company_ids skips (line 72 continue)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Comp Event", category="t", scope="company",
        severity_range="(-0.2,0.2)", sentiment="neutral",
        effect_profile="{}", duration_days=3, decay_rate=0.1,
        probability_weight=1.0,
    ))
    s.commit()

    rng = random.Random(42)
    selected = select_and_fire_events(s, 1, date(2026, 1, 2), rng, [], [1])
    # Event is added to selected_events before scope check; only instance creation is skipped
    assert len(selected) == 1
    assert s.query(EventInstance).count() == 0
    s.close()


def test_select_and_fire_industry_empty_ids_skips():
    """Industry-scope event with empty industry_ids skips (line 55 continue)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Ind Event", category="t", scope="industry",
        severity_range="(-0.2,0.2)", sentiment="neutral",
        effect_profile="{}", duration_days=3, decay_rate=0.1,
        probability_weight=1.0,
    ))
    s.commit()

    rng = random.Random(42)
    selected = select_and_fire_events(s, 1, date(2026, 1, 2), rng, [1], [])
    assert len(selected) == 1
    assert s.query(EventInstance).count() == 0
    s.close()


# ── get_active_events_for_company ──────────────────────────────────────


def test_get_active_events_industry_id_none():
    """When industry_id is None, the industry filter uses is_(None) (lines 113-116)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Mkt", category="t", scope="market",
        severity_range="(0.1,0.3)", sentiment="neutral",
        effect_profile="{}", duration_days=5, decay_rate=0.1,
        probability_weight=1.0,
    ))
    s.commit()
    s.add(EventInstance(
        event_id=1, timeline_id=1, scope_ref=0, scope_type="market",
        sim_date=date(2026, 1, 2), resolved_severity=0.2,
        applied_effects={}, expires_on=date(2026, 1, 10),
    ))
    s.commit()

    events = get_active_events_for_company(s, 1, 1, None, date(2026, 1, 3))
    assert len(events) == 1
    s.close()


def test_get_active_events_with_industry_id():
    """When industry_id is not None, the industry filter uses scope_ref match (line 110)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Ind", category="t", scope="industry",
        severity_range="(0.1,0.3)", sentiment="neutral",
        effect_profile="{}", duration_days=5, decay_rate=0.1,
        probability_weight=1.0,
    ))
    s.commit()
    s.add(EventInstance(
        event_id=1, timeline_id=1, scope_ref=5, scope_type="industry",
        sim_date=date(2026, 1, 2), resolved_severity=0.2,
        applied_effects={}, expires_on=date(2026, 1, 10),
    ))
    s.add(EventInstance(
        event_id=1, timeline_id=1, scope_ref=99, scope_type="industry",
        sim_date=date(2026, 1, 2), resolved_severity=0.2,
        applied_effects={}, expires_on=date(2026, 1, 10),
    ))
    s.commit()

    events = get_active_events_for_company(s, 1, 1, 5, date(2026, 1, 3))
    assert len(events) >= 1
    s.close()


# ── generate_news ──────────────────────────────────────────────────────


def test_generate_news_event_not_found():
    """When MarketEvent is missing, generate_news returns None (line 143)."""
    s = _session()
    _add_timeline(s)
    ei = EventInstance(
        event_id=999, timeline_id=1, scope_ref=1, scope_type="company",
        sim_date=date(2026, 1, 2), resolved_severity=0.2,
        applied_effects={}, expires_on=date(2026, 1, 10),
    )
    # Don't persist ei — generate_news reads event_id from the in-memory object
    rng = random.Random(42)
    result = generate_news(s, 1, date(2026, 1, 2), ei, rng, company_name="Test Corp")
    assert result is None
    s.close()


def test_generate_news_with_industry_name():
    """Industry name replacement in news headline/body (line 164)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Ind Evt", category="test_cat", scope="industry",
        severity_range="(0.1,0.3)", sentiment="positive",
        effect_profile="{}", duration_days=5, decay_rate=0.1,
        probability_weight=1.0,
    ))
    s.add(NewsTemplate(
        category="test_cat", template_text="{industry} shows strength",
        sentiment="positive", severity_band="low",
        linked_event_category="test_cat", linked_driver="value_opportunity",
    ))
    s.commit()
    ei = EventInstance(
        event_id=1, timeline_id=1, scope_ref=5, scope_type="industry",
        sim_date=date(2026, 1, 2), resolved_severity=0.2,
        applied_effects={}, expires_on=date(2026, 1, 10),
    )
    s.add(ei)
    s.commit()

    rng = random.Random(42)
    result = generate_news(s, 1, date(2026, 1, 2), ei, rng, industry_name="Tech")
    assert result is not None
    assert "Tech" in result.headline
    s.close()


def test_generate_news_uses_event_sentiment_not_severity_sign():
    """Regression: sentiment must come from MarketEvent.sentiment, not from
    resolved_severity's sign. Every real severity_range in seed_events.py is a
    positive-only magnitude ("15..50"), so resolved_severity is never
    negative — deriving sentiment from its sign meant bad-news events (e.g.
    "Earnings Miss", sentiment="negative") were always mislabeled "positive"."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Earnings Miss", category="earnings", scope="company",
        severity_range="15..50", sentiment="negative",
        effect_profile="{}", duration_days=12, decay_rate=0.18,
        probability_weight=1.0,
    ))
    s.add(NewsTemplate(
        category="earnings", template_text="{company} misses estimates.",
        sentiment="negative", severity_band="high",
        linked_event_category="earnings", linked_driver="earnings_surprise",
    ))
    s.commit()
    ei = EventInstance(
        event_id=1, timeline_id=1, scope_ref=5, scope_type="company",
        sim_date=date(2026, 1, 2), resolved_severity=32.0,  # positive magnitude
        applied_effects={}, expires_on=date(2026, 1, 14),
    )
    s.add(ei)
    s.commit()

    rng = random.Random(42)
    result = generate_news(s, 1, date(2026, 1, 2), ei, rng, company_name="Test Corp")
    assert result is not None
    assert result.sentiment == "negative"
    s.close()


def test_generate_news_market_scope_returns_none():
    """Market-scope events return None because company_id and industry_id are both None (line 172)."""
    s = _session()
    _add_timeline(s)
    s.add(MarketEvent(
        id=1, name="Mkt Evt", category="test_cat", scope="market",
        severity_range="(0.1,0.3)", sentiment="positive",
        effect_profile="{}", duration_days=5, decay_rate=0.1,
        probability_weight=1.0,
    ))
    s.add(NewsTemplate(
        category="test_cat", template_text="Market news",
        sentiment="positive", severity_band="low",
        linked_event_category="test_cat", linked_driver="value_opportunity",
    ))
    s.commit()
    ei = EventInstance(
        event_id=1, timeline_id=1, scope_ref=0, scope_type="market",
        sim_date=date(2026, 1, 2), resolved_severity=0.2,
        applied_effects={}, expires_on=date(2026, 1, 10),
    )
    s.add(ei)
    s.commit()

    rng = random.Random(42)
    result = generate_news(s, 1, date(2026, 1, 2), ei, rng)
    assert result is None
    s.close()
