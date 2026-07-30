"""Tests for /api/v1/companies/{ticker}/concalls endpoint."""
from datetime import date

from db.models import ConCall


def test_get_concalls_unknown_ticker(client, test_db, test_timeline):
    resp = client.get("/api/v1/companies/NOPE/concalls")
    assert resp.status_code == 404


def test_get_concalls_empty(client, test_db, test_timeline, test_company):
    resp = client.get(f"/api/v1/companies/{test_company.ticker}/concalls")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_concalls_with_items(client, test_db, test_timeline, test_company):
    call = ConCall(
        company_id=test_company.id,
        fiscal_period="2026Q1",
        call_date=date(2026, 1, 2),
        performance_bucket="beat",
        tone="confident",
        tone_score=1.0,
        guidance_revenue_growth=0.05,
        statements={"opening": "Great quarter.", "revenue": "Revenue grew +5.0%."},
        driver_deltas={"guidance": 0.15},
    )
    test_db.add(call)
    test_db.commit()

    resp = client.get(f"/api/v1/companies/{test_company.ticker}/concalls")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["fiscal_period"] == "2026Q1"
    assert data[0]["tone"] == "confident"
    assert data[0]["performance_bucket"] == "beat"
    assert data[0]["statements"]["opening"] == "Great quarter."


def test_get_concalls_most_recent_first(client, test_db, test_timeline, test_company):
    for period in ["2026Q1", "2026Q2", "2026Q3"]:
        test_db.add(ConCall(
            company_id=test_company.id,
            fiscal_period=period,
            call_date=date(2026, 1, 2),
            performance_bucket="inline",
            tone="measured",
            tone_score=0.35,
            guidance_revenue_growth=0.01,
            statements={"opening": f"Call for {period}"},
            driver_deltas={},
        ))
    test_db.commit()

    resp = client.get(f"/api/v1/companies/{test_company.ticker}/concalls")
    assert resp.status_code == 200
    data = resp.json()
    assert [d["fiscal_period"] for d in data] == ["2026Q3", "2026Q2", "2026Q1"]


def test_get_concalls_includes_comprehensive_fields(client, test_db, test_timeline, test_company):
    call = ConCall(
        company_id=test_company.id,
        fiscal_period="2026Q1",
        call_date=date(2026, 1, 2),
        performance_bucket="beat",
        tone="confident",
        tone_score=1.0,
        guidance_revenue_growth=0.05,
        statements={"opening": "Great quarter.", "capex_debt": "Leaning into capex."},
        driver_deltas={"guidance": 0.15, "margin_bias": 0.01, "capex_bias": 0.02, "debt_bias": 0.0},
        segment_guidance={"Core": 0.04, "Emerging Markets": 0.06},
        qa_transcript=[{"analyst_name": "Ananya Rao", "analyst_firm": "Kotak", "question": "Q?", "answer": "A."}],
        trend_context={"beat_miss_streak": 1, "margin_streak": 1, "price_streak": 0, "guided_vs_actual_streak": 1},
        applied_deltas={"management_quality_delta": 0.9, "moat_score_delta": 0.5, "news_feed_id": 1},
    )
    test_db.add(call)
    test_db.commit()

    resp = client.get(f"/api/v1/companies/{test_company.ticker}/concalls")
    assert resp.status_code == 200
    data = resp.json()[0]
    assert data["statements"]["capex_debt"] == "Leaning into capex."
    assert data["segment_guidance"]["Core"] == 0.04
    assert data["qa_transcript"][0]["analyst_name"] == "Ananya Rao"
    assert data["trend_context"]["beat_miss_streak"] == 1
    assert data["applied_deltas"]["management_quality_delta"] == 0.9
