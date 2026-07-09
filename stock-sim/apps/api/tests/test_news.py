"""Tests for /api/v1/news endpoint."""
from datetime import date

from db.models import NewsFeed, SimulationState

SIM_DATE = date(2026, 1, 2)


def test_get_news_no_auth(client, test_db, test_timeline):
    resp = client.get("/api/v1/news/")
    assert resp.status_code == 200


def test_get_news_empty(client, test_db, test_timeline, auth_headers):
    resp = client.get("/api/v1/news/", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_news_with_items(client, test_db, test_timeline, test_company, auth_headers):
    feed = NewsFeed(
        timeline_id=test_timeline.id,
        sim_date=SIM_DATE,
        headline="Test Headline",
        body="Test body",
        sentiment="positive",
        severity=0.5,
        company_id=test_company.id,
    )
    test_db.add(feed)
    test_db.commit()

    resp = client.get("/api/v1/news/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["headline"] == "Test Headline"
    assert data[0]["sentiment"] == "positive"
    assert data[0]["company_name"] == test_company.name


def test_get_news_filter_by_company(client, test_db, test_timeline, test_company, auth_headers):
    feed = NewsFeed(
        timeline_id=test_timeline.id,
        sim_date=SIM_DATE,
        headline="Filtered News",
        body="Body",
        sentiment="neutral",
        severity=0.3,
        company_id=test_company.id,
    )
    test_db.add(feed)
    test_db.commit()

    resp = client.get(f"/api/v1/news/?company_id={test_company.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["company_name"] == test_company.name


def test_get_news_pagination(client, test_db, test_timeline, test_company, auth_headers):
    for i in range(5):
        test_db.add(NewsFeed(
            timeline_id=test_timeline.id,
            sim_date=SIM_DATE,
            headline=f"News {i}",
            body="Body",
            sentiment="positive",
            severity=0.1,
            company_id=test_company.id,
        ))
    test_db.commit()

    resp = client.get("/api/v1/news/?limit=2", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_news_filter_by_sim_date(client, test_db, test_timeline, test_company, auth_headers):
    from datetime import date
    from db.models import NewsFeed

    test_db.add(NewsFeed(
        timeline_id=test_timeline.id,
        sim_date=date(2026, 1, 2),
        headline="Dated News",
        body="Body",
        sentiment="positive",
        severity=0.5,
        company_id=test_company.id,
    ))
    test_db.commit()

    resp = client.get("/api/v1/news/?sim_date=2026-01-02", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["sim_date"] == "2026-01-02"

    resp = client.get("/api/v1/news/?sim_date=2025-01-01", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []
