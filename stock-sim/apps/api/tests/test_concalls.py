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
