"""Contract tests for the server-backed Market Explorer screener."""

from datetime import date

from db.models import CompanyFactorScore, PriceHistory


def test_screener_metrics_and_query_include_lineage(client, test_company, test_timeline):
    metrics = client.get("/api/v1/screener/metrics")
    assert metrics.status_code == 200
    keys = {item["key"] for item in metrics.json()}
    assert {"iv_gap_pct", "rsi_14", "financial_quality"}.issubset(keys)

    response = client.post(
        "/api/v1/screener/query",
        json={
            "timeline_id": 1,
            "clauses": [{"metric": "price", "operator": ">=", "value": 90}],
            "columns": ["ticker", "price", "iv_gap_pct", "rsi_14"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["query_fingerprint"]
    row = body["rows"][0]
    assert row["company"]["ticker"] == "TST"
    assert row["metrics"]["price"] == 100.0
    assert row["provenance"]["price"]["source"] == "market_service.get_market_grid"
    assert row["provenance"]["rsi_14"]["missing_reason"] == "No observation for this company/date"


def test_screener_factor_and_historical_technical_filters(client, test_db, test_company, test_timeline):
    test_db.add(
        CompanyFactorScore(
            company_id=1,
            timeline_id=1,
            fiscal_period="2026Q1",
            management_quality=75,
            moat_score=80,
            financial_quality=72,
            fcf_quality=68,
            growth_potential=85,
            intrinsic_score=78,
            fair_pe=18,
            intrinsic_value=120,
        )
    )
    for index in range(1, 25):
        sim_date = date(2026, 1, index + 1)
        close = 90 + index
        test_db.add(
            PriceHistory(
                timeline_id=1,
                company_id=1,
                sim_date=sim_date,
                open=close,
                high=close + 1,
                low=close - 1,
                close=close,
                volume=10000,
                intrinsic_value=120,
                order_imbalance=0,
            )
        )
    test_db.commit()

    response = client.post(
        "/api/v1/screener/query",
        json={
            "timeline_id": 1,
            "as_of_date": "2026-01-25",
            "clauses": [
                {"metric": "financial_quality", "operator": ">=", "value": 70},
                {"metric": "growth", "operator": ">=", "value": 80},
                {"metric": "return_1m_pct", "operator": ">", "value": 0},
            ],
            "columns": ["ticker", "financial_quality", "growth_potential", "return_1m_pct"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["rows"][0]["metrics"]["financial_quality"] == 72.0
    assert body["rows"][0]["metrics"]["return_1m_pct"] is not None


def test_saved_screen_crud_is_user_owned(client, auth_headers, test_company, test_timeline):
    payload = {
        "name": "Quality watch",
        "query": {
            "timeline_id": 1,
            "clauses": [{"metric": "financial_quality", "operator": ">=", "value": 60}],
            "columns": ["ticker", "financial_quality"],
        },
        "view_mode": "rank",
    }
    created = client.post("/api/v1/screener/saved-screens", json=payload, headers=auth_headers)
    assert created.status_code == 201
    saved = created.json()
    assert saved["name"] == "Quality watch"
    assert saved["view_mode"] == "rank"
    assert saved["fingerprint"]

    listed = client.get("/api/v1/screener/saved-screens", headers=auth_headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [saved["id"]]

    run = client.post(f"/api/v1/screener/saved-screens/{saved['id']}/run", headers=auth_headers)
    assert run.status_code == 200
    assert run.json()["query"]["clauses"][0]["metric"] == "financial_quality"

    updated = client.patch(
        f"/api/v1/screener/saved-screens/{saved['id']}",
        json={"name": "Quality + research"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["version"] == 2

    deleted = client.delete(f"/api/v1/screener/saved-screens/{saved['id']}", headers=auth_headers)
    assert deleted.status_code == 204


def test_screener_dcf_correlation_breadth_and_safe_formula(client, test_db, test_company, test_timeline):
    from db.models import IncomeStatement

    test_db.add(
        IncomeStatement(
            company_id=1,
            timeline_id=1,
            fiscal_period="2026Q1",
            revenue=1_000_000,
            cogs=600_000,
            gross_profit=400_000,
            operating_expenses=200_000,
            ebitda=200_000,
            depreciation_amortization=50_000,
            ebit=150_000,
            interest_expense=20_000,
            pretax_income=130_000,
            tax=32_500,
            net_profit=97_500,
            eps=0.975,
            shares_diluted=100_000_000,
        )
    )
    for index in range(1, 30):
        test_db.add(
            PriceHistory(
                timeline_id=1,
                company_id=1,
                sim_date=date(2026, 1, index + 1),
                open=100 + index,
                high=101 + index,
                low=99 + index,
                close=100 + index,
                volume=10_000,
                intrinsic_value=100,
                order_imbalance=0,
            )
        )
    test_db.commit()

    dcf = client.post("/api/v1/screener/dcf/TST", json={"wacc": 0.1, "terminal_growth": 0.02})
    assert dcf.status_code == 200
    assert dcf.json()["per_share_value"] is not None
    assert len(dcf.json()["sensitivity"]) == 25

    correlation = client.get("/api/v1/screener/correlation?tickers=TST&lookback=20")
    assert correlation.status_code == 200
    assert correlation.json()["matrix"] == [[1.0]]

    breadth = client.get("/api/v1/screener/breadth?lookback=20")
    assert breadth.status_code == 200
    assert breadth.json()["points"]

    formula = client.post(
        "/api/v1/screener/formulas/evaluate",
        json={"formula": "price / intrinsic_value * 100", "query": {"columns": ["ticker", "price", "intrinsic_value"]}},
    )
    assert formula.status_code == 200
    assert formula.json()["values"][0]["value"] == 129.0

    blocked = client.post(
        "/api/v1/screener/formulas/evaluate",
        json={"formula": "__import__('os').system('echo bad')", "query": {"columns": ["ticker", "price"]}},
    )
    assert blocked.status_code == 200
    assert blocked.json()["values"][0]["value"] is None
    assert "disallowed" in blocked.json()["values"][0]["missing_reason"]


def test_research_notebook_and_chart_annotation_crud(client, auth_headers, test_company, test_timeline):
    notebook = client.post(
        "/api/v1/screener/notebooks",
        json={"title": "TST thesis", "query": {"version": 1, "clauses": []}},
        headers=auth_headers,
    )
    assert notebook.status_code == 201
    notebook_id = notebook.json()["id"]
    block = client.post(
        f"/api/v1/screener/notebooks/{notebook_id}/blocks",
        json={"block_type": "evidence", "position": 0, "payload": {"text": "Check FCF"}, "provenance": {"source": "test"}},
        headers=auth_headers,
    )
    assert block.status_code == 201
    listed = client.get("/api/v1/screener/notebooks", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["blocks"][0]["provenance"]["source"] == "test"

    annotation = client.post(
        "/api/v1/screener/annotations",
        json={"ticker": "TST", "tool": "trendline", "anchors": [{"date": "2026-01-01", "value": 100}], "evidence": {"query_fingerprint": "abc"}},
        headers=auth_headers,
    )
    assert annotation.status_code == 201
    annotations = client.get("/api/v1/screener/annotations?ticker=TST", headers=auth_headers)
    assert annotations.status_code == 200
    assert annotations.json()[0]["evidence"]["query_fingerprint"] == "abc"
    updated_annotation = client.patch(
        f"/api/v1/screener/annotations/{annotation.json()['id']}",
        json={"anchors": [{"date": "2026-01-02", "value": 101}], "evidence": {"query_fingerprint": "updated"}},
        headers=auth_headers,
    )
    assert updated_annotation.status_code == 200
    assert updated_annotation.json()["version"] == 2
    assert updated_annotation.json()["evidence"]["query_fingerprint"] == "updated"


def test_active_research_endpoints_use_the_shared_query(client, test_db, test_company, test_timeline):
    test_db.add(
        CompanyFactorScore(
            company_id=1,
            timeline_id=1,
            fiscal_period="2026Q1",
            management_quality=75,
            moat_score=80,
            financial_quality=72,
            fcf_quality=68,
            growth_potential=85,
            intrinsic_score=78,
            fair_pe=18,
            intrinsic_value=120,
        )
    )
    test_db.commit()
    query = {
        "timeline_id": 1,
        "clauses": [{"metric": "financial_quality", "operator": ">=", "value": 70}],
        "columns": ["ticker", "financial_quality"],
    }
    heatmap = client.post("/api/v1/screener/heatmap", json={"query": query})
    assert heatmap.status_code == 200
    assert heatmap.json()[0]["count"] == 1
    rankings = client.post("/api/v1/screener/rankings", json={"query": query, "metric": "financial_quality"})
    assert rankings.status_code == 200
    assert rankings.json()[0]["ticker"] == "TST"
    exposure = client.post("/api/v1/screener/exposure", json={"query": query})
    assert exposure.status_code == 200
    assert exposure.json()[0]["exposures"]["growth_potential"] == 85.0
    clusters = client.get("/api/v1/screener/news-clusters?ticker=TST")
    assert clusters.status_code == 200
    assert clusters.json()["provenance"]["source"] == "NewsFeed"
    impacts = client.get("/api/v1/screener/event-impacts/TST")
    assert impacts.status_code == 200
    assert impacts.json()["events"] == []
    invalid = client.post("/api/v1/screener/query", json={"clauses": [{"metric": "not_a_metric", "operator": ">", "value": 1}]})
    assert invalid.status_code == 422


def test_watchlist_universe_is_user_scoped(client, test_db, test_company, test_timeline, test_user, auth_headers):
    from db.models import Watchlist, WatchlistGroup

    group = WatchlistGroup(user_id=test_user.id, name="Research")
    test_db.add(group)
    test_db.flush()
    test_db.add(Watchlist(user_id=test_user.id, company_id=test_company.id, group_id=group.id, sort_order=0))
    test_db.commit()
    response = client.post(
        "/api/v1/screener/query",
        json={"universe": {"type": "watchlist", "watchlist_id": group.id}, "columns": ["ticker", "price"]},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert [row["company"]["ticker"] for row in response.json()["rows"]] == ["TST"]
