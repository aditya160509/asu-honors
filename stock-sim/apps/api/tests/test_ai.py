"""Tests for apps/api/services/ai_service.py and the /api/v1/ai router --
all 6 AI Financial Advisor capabilities (Explain Metrics, AI Chat, Portfolio
Review, Company Review, Explain News, Strategy Builder). No real Gemini API
calls are made: the client is mocked throughout, so these tests run without
GEMINI_API_KEY set and without network access."""

from datetime import date

import pytest

from google.genai import errors as genai_errors

from apps.api import config
from apps.api.exceptions import NotFoundError
from apps.api.rate_limiter import ai_rate_limiter
from apps.api.schemas import AiEvidenceItem, AiGroundedResponse
from apps.api.services import ai_service
from db.models import CompanyFactorScore, EconomicCycleState, Holding, IncomeStatement, NewsFeed


class _FakeResponse:
    def __init__(self, text: str):
        self.text = text


def _fake_upstream_error() -> genai_errors.APIError:
    """A stand-in for Gemini's real 'high demand' 503 (observed live during
    manual testing) -- no network involved, just the same exception type
    ai_service.py needs to catch and translate into a clean response."""
    return genai_errors.ServerError(503, {"error": {"message": "high demand", "status": "UNAVAILABLE"}})


class _FakeModels:
    """Mimics google.genai.Client().models -- .generate_content (used by
    explain_metric, strategy_builder, and the structured grounded-response
    calls -- Gemini has no separate .parse() method, structured output is
    just JSON text requested via config.response_schema) and
    .generate_content_stream (used by chat)."""

    def __init__(self, text: str = "A fake explanation.", stream_chunks: list[str] | None = None, raise_upstream_error: bool = False):
        self._text = text
        self._stream_chunks = stream_chunks or []
        self._raise_upstream_error = raise_upstream_error
        self.calls: list[dict] = []
        self.stream_calls: list[dict] = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self._raise_upstream_error:
            raise _fake_upstream_error()
        return _FakeResponse(self._text)

    def generate_content_stream(self, **kwargs):
        self.stream_calls.append(kwargs)
        if self._raise_upstream_error:
            def _raising_gen():
                raise _fake_upstream_error()
                yield  # pragma: no cover -- unreachable, makes this a generator function
            return _raising_gen()
        return iter(_FakeResponse(chunk) for chunk in self._stream_chunks)


class _FakeClient:
    def __init__(
        self,
        text: str = "A fake explanation.",
        stream_chunks: list[str] | None = None,
        raise_upstream_error: bool = False,
    ):
        self.models = _FakeModels(text, stream_chunks, raise_upstream_error)


@pytest.fixture(autouse=True)
def _reset_ai_service_state(monkeypatch):
    """ai_service's client/cache and ai_rate_limiter's hit log are all
    module-level singletons by design (mirrors ws_manager.py's circuit
    breaker) -- reset them around every test so tests don't leak state into
    each other."""
    ai_service._client = None
    ai_service._generic_explanation_cache.clear()
    ai_rate_limiter._hits.clear()
    yield
    ai_service._client = None
    ai_service._generic_explanation_cache.clear()
    ai_rate_limiter._hits.clear()


def test_explain_metric_raises_when_not_configured(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "")
    with pytest.raises(ai_service.AiNotConfiguredError):
        ai_service.explain_metric("Sharpe Ratio")


def test_explain_metric_returns_generated_text(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient("Sharpe Ratio measures risk-adjusted return.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    result = ai_service.explain_metric("Sharpe Ratio")
    assert result == "Sharpe Ratio measures risk-adjusted return."
    assert len(fake_client.models.calls) == 1


def test_explain_metric_caches_generic_explanations(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient("Cached explanation.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    first = ai_service.explain_metric("Beta")
    second = ai_service.explain_metric("Beta")
    assert first == second == "Cached explanation."
    # Second call must be served from the cache, not a second API call.
    assert len(fake_client.models.calls) == 1


def test_explain_metric_cache_is_case_and_whitespace_insensitive(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient("Cached explanation.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    ai_service.explain_metric("Beta")
    ai_service.explain_metric("  beta  ")
    assert len(fake_client.models.calls) == 1


def test_explain_metric_does_not_cache_value_specific_explanations(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient("Value-specific explanation.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    ai_service.explain_metric("P/E ratio", value=47.3)
    ai_service.explain_metric("P/E ratio", value=47.3)
    # Every value-specific call re-queries the model -- these aren't
    # generic term definitions, so caching them would risk staleness.
    assert len(fake_client.models.calls) == 2


def test_explain_metric_passes_value_and_context_into_the_prompt(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient("...")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    ai_service.explain_metric("P/E ratio", value=47.3, context="tech sector")
    call = fake_client.models.calls[0]
    prompt = call["contents"]
    assert "47.3" in prompt
    assert "tech sector" in prompt


# ── Router ────────────────────────────────────────────────────────────────


def test_explain_metric_endpoint_no_auth(client):
    resp = client.post("/api/v1/ai/explain-metric", json={"metric_name": "Sharpe Ratio"})
    assert resp.status_code == 401


def test_explain_metric_endpoint_not_configured_returns_503(client, test_db, auth_headers, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "")
    resp = client.post(
        "/api/v1/ai/explain-metric", json={"metric_name": "Sharpe Ratio"}, headers=auth_headers,
    )
    assert resp.status_code == 503


def test_explain_metric_endpoint_success(client, test_db, auth_headers, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient("Sharpe Ratio measures risk-adjusted return.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    resp = client.post(
        "/api/v1/ai/explain-metric", json={"metric_name": "Sharpe Ratio"}, headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["explanation"] == "Sharpe Ratio measures risk-adjusted return."


def test_explain_metric_endpoint_rate_limited(client, test_db, auth_headers, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient("...")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    for _ in range(30):
        resp = client.post(
            "/api/v1/ai/explain-metric", json={"metric_name": "Sharpe Ratio"}, headers=auth_headers,
        )
        assert resp.status_code == 200

    resp = client.post(
        "/api/v1/ai/explain-metric", json={"metric_name": "Sharpe Ratio"}, headers=auth_headers,
    )
    assert resp.status_code == 429


# ── Portfolio Review + shared context builder ──────────────────────────────


def test_build_portfolio_context_returns_none_without_portfolio(test_db, test_user, test_timeline):
    assert ai_service.build_portfolio_context(test_db, test_user, 1) is None


def test_build_portfolio_context_includes_holdings(test_db, test_user, test_timeline, test_company, test_portfolio):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=test_company.id, quantity=10, avg_cost_basis=90.0))
    test_db.commit()

    context = ai_service.build_portfolio_context(test_db, test_user, 1)
    assert context is not None
    assert context["num_positions"] == 1
    assert context["holdings"][0]["ticker"] == "TST"
    assert context["holdings"][0]["market_value"] == 1000.0


def test_portfolio_review_no_portfolio(test_db, test_user, test_timeline):
    # No GEMINI_API_KEY needed: the no-portfolio guard returns before any
    # client is touched.
    result = ai_service.portfolio_review(test_db, test_user, 1)
    assert result.text == "No portfolio found for this timeline yet."
    assert result.evidence == []


def test_portfolio_review_empty_portfolio(test_db, test_user, test_timeline, test_portfolio):
    result = ai_service.portfolio_review(test_db, test_user, 1)
    assert "no positions yet" in result.text
    assert result.evidence == []


def test_portfolio_review_generates_grounded_response(
    test_db, test_user, test_timeline, test_company, test_portfolio, monkeypatch,
):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=test_company.id, quantity=10, avg_cost_basis=90.0))
    test_db.commit()

    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    parsed = AiGroundedResponse(text="Great portfolio.", evidence=[AiEvidenceItem(type="holding", ref_id="TST", label="TST position")])
    fake_client = _FakeClient(text=parsed.model_dump_json())
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    result = ai_service.portfolio_review(test_db, test_user, 1)
    assert result.text == "Great portfolio."
    assert len(fake_client.models.calls) == 1
    call = fake_client.models.calls[0]
    assert call["config"].response_schema is AiGroundedResponse
    assert "TST" in call["contents"]


# ── Company Review ──────────────────────────────────────────────────────────


def test_company_review_not_found(test_db, test_timeline):
    with pytest.raises(NotFoundError):
        ai_service.company_review(test_db, "NOPE", 1)


def test_company_review_no_data_guard(test_db, test_timeline, test_company_bare):
    result = ai_service.company_review(test_db, "BARE", 1)
    assert "Not enough data" in result.text
    assert result.evidence == []


def test_company_review_generates_grounded_response(test_db, test_timeline, test_company, monkeypatch):
    test_db.add(CompanyFactorScore(
        company_id=test_company.id, timeline_id=1, fiscal_period="Q1-2026",
        management_quality=70.0, moat_score=60.0, financial_quality=65.0,
        fcf_quality=55.0, growth_potential=50.0, intrinsic_score=72.0,
        fair_pe=15.0, intrinsic_value=105.0,
    ))
    test_db.add(IncomeStatement(
        company_id=test_company.id, timeline_id=1, fiscal_period="Q1-2026",
        revenue=1_000_000.0, cogs=600_000.0, gross_profit=400_000.0,
        operating_expenses=150_000.0, ebitda=250_000.0, depreciation_amortization=20_000.0,
        ebit=230_000.0, interest_expense=5_000.0, pretax_income=225_000.0,
        tax=45_000.0, net_profit=180_000.0, eps=1.8, shares_diluted=100_000_000.0,
    ))
    test_db.commit()

    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    parsed = AiGroundedResponse(text="Solid fundamentals.", evidence=[])
    fake_client = _FakeClient(text=parsed.model_dump_json())
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    result = ai_service.company_review(test_db, "tst", 1)
    assert result.text == "Solid fundamentals."
    assert "TST" in fake_client.models.calls[0]["contents"]


# ── Explain News ─────────────────────────────────────────────────────────────


def test_explain_news_not_found(test_db, test_timeline):
    with pytest.raises(NotFoundError):
        ai_service.explain_news(test_db, 999, 1)


def test_explain_news_generates_grounded_response(test_db, test_timeline, test_company, monkeypatch):
    news = NewsFeed(
        timeline_id=1, sim_date=date(2026, 1, 2), company_id=test_company.id,
        headline="Test Corp beats earnings estimates", body="Strong quarter.",
        sentiment="positive", severity=3.0, news_type="both",
    )
    test_db.add(news)
    test_db.commit()
    test_db.refresh(news)

    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    parsed = AiGroundedResponse(text="Company beat earnings.", evidence=[])
    fake_client = _FakeClient(text=parsed.model_dump_json())
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    result = ai_service.explain_news(test_db, news.id, 1)
    assert result.text == "Company beat earnings."
    assert "beats earnings estimates" in fake_client.models.calls[0]["contents"]


# ── Strategy Builder ─────────────────────────────────────────────────────────


def test_strategy_builder_disclaimer_is_always_the_hardcoded_string(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(text="A narrative that never mentions any disclaimer itself.")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    result = ai_service.strategy_builder("moderate", "grow wealth", "5yr+")
    assert result["narrative"] == "A narrative that never mentions any disclaimer itself."
    assert result["disclaimer"] == ai_service.STRATEGY_BUILDER_DISCLAIMER


def test_strategy_builder_includes_portfolio_context_in_prompt(monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(text="...")
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    ai_service.strategy_builder("aggressive", "grow", "1-5yr", portfolio_context={"total_value": 5000})
    call = fake_client.models.calls[0]
    assert "5000" in call["contents"]


# ── AI Chat (streaming) ──────────────────────────────────────────────────────


def test_stream_chat_yields_chunks(test_db, test_user, test_timeline, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(stream_chunks=["Hello", " there", "!"])
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    chunks = list(ai_service.stream_chat(test_db, test_user, [{"role": "user", "content": "hi"}], "market", False, 1))
    assert chunks == ["Hello", " there", "!"]


def test_stream_chat_maps_assistant_role_to_model(test_db, test_user, test_timeline, monkeypatch):
    # Gemini has no "assistant" role -- prior model turns must be sent as "model".
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(stream_chunks=["ok"])
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    messages = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
        {"role": "user", "content": "how are you"},
    ]
    list(ai_service.stream_chat(test_db, test_user, messages, "market", False, 1))
    contents = fake_client.models.stream_calls[0]["contents"]
    assert [c.role for c in contents] == ["user", "model", "user"]


def test_stream_chat_injects_portfolio_context_when_requested(
    test_db, test_user, test_timeline, test_company, test_portfolio, monkeypatch,
):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=test_company.id, quantity=10, avg_cost_basis=90.0))
    test_db.commit()

    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(stream_chunks=["ok"])
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    list(ai_service.stream_chat(test_db, test_user, [{"role": "user", "content": "how am I doing?"}], "portfolio", True, 1))
    assert "TST" in fake_client.models.stream_calls[0]["config"].system_instruction


def test_stream_chat_does_not_inject_context_when_not_requested(
    test_db, test_user, test_timeline, test_company, test_portfolio, monkeypatch,
):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=test_company.id, quantity=10, avg_cost_basis=90.0))
    test_db.commit()

    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(stream_chunks=["ok"])
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    list(ai_service.stream_chat(test_db, test_user, [{"role": "user", "content": "hi"}], "portfolio", False, 1))
    assert "TST" not in fake_client.models.stream_calls[0]["config"].system_instruction


def test_stream_chat_market_scope_injects_cycle_context(test_db, test_user, test_timeline, monkeypatch):
    test_db.add(EconomicCycleState(
        timeline_id=1, sim_date=date(2026, 1, 2), cycle_phase="expansion",
        market_factor_return=0.01, gdp_growth=2.5, interest_rate=0.04, market_sentiment=0.6,
    ))
    test_db.commit()

    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(stream_chunks=["ok"])
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    list(ai_service.stream_chat(test_db, test_user, [{"role": "user", "content": "how's the market?"}], "market", True, 1))
    assert "expansion" in fake_client.models.stream_calls[0]["config"].system_instruction


def test_stream_chat_raises_when_not_configured(test_db, test_user, test_timeline, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "")
    with pytest.raises(ai_service.AiNotConfiguredError):
        list(ai_service.stream_chat(test_db, test_user, [{"role": "user", "content": "hi"}], "market", False, 1))


# ── Router: Portfolio Review ─────────────────────────────────────────────────


def test_portfolio_review_endpoint_no_auth(client):
    resp = client.post("/api/v1/ai/portfolio-review")
    assert resp.status_code == 401


def test_portfolio_review_endpoint_not_configured_returns_503(
    client, test_db, test_timeline, test_company, test_portfolio, auth_headers, monkeypatch,
):
    # The not-configured error only surfaces once there's an actual holding
    # to review -- an empty/missing portfolio short-circuits before ever
    # touching the client (see test_portfolio_review_no_portfolio).
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=test_company.id, quantity=10, avg_cost_basis=90.0))
    test_db.commit()
    monkeypatch.setattr(config.settings, "gemini_api_key", "")
    resp = client.post("/api/v1/ai/portfolio-review", headers=auth_headers)
    assert resp.status_code == 503


def test_portfolio_review_endpoint_success(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(
        ai_service, "portfolio_review",
        lambda db, user, timeline_id: AiGroundedResponse(text="Looking good.", evidence=[]),
    )
    resp = client.post("/api/v1/ai/portfolio-review", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["text"] == "Looking good."


def test_portfolio_review_endpoint_rate_limited(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(
        ai_service, "portfolio_review",
        lambda db, user, timeline_id: AiGroundedResponse(text="...", evidence=[]),
    )
    for _ in range(10):
        resp = client.post("/api/v1/ai/portfolio-review", headers=auth_headers)
        assert resp.status_code == 200
    resp = client.post("/api/v1/ai/portfolio-review", headers=auth_headers)
    assert resp.status_code == 429


# ── Router: Company Review ───────────────────────────────────────────────────


def test_company_review_endpoint_not_found_returns_404(client, test_db, test_timeline, auth_headers, monkeypatch):
    def _raise(db, ticker, timeline_id):
        raise NotFoundError(f"Company '{ticker}' not found")
    monkeypatch.setattr(ai_service, "company_review", _raise)

    resp = client.post("/api/v1/ai/company-review", json={"ticker": "NOPE"}, headers=auth_headers)
    assert resp.status_code == 404


def test_company_review_endpoint_success(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(
        ai_service, "company_review",
        lambda db, ticker, timeline_id: AiGroundedResponse(text=f"Analysis of {ticker}.", evidence=[]),
    )
    resp = client.post("/api/v1/ai/company-review", json={"ticker": "TST"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["text"] == "Analysis of TST."


# ── Router: Explain News ─────────────────────────────────────────────────────


def test_explain_news_endpoint_not_found_returns_404(client, test_db, test_timeline, auth_headers, monkeypatch):
    def _raise(db, news_id, timeline_id):
        raise NotFoundError(f"News item {news_id} not found")
    monkeypatch.setattr(ai_service, "explain_news", _raise)

    resp = client.post("/api/v1/ai/explain-news", json={"news_id": 999}, headers=auth_headers)
    assert resp.status_code == 404


def test_explain_news_endpoint_success(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(
        ai_service, "explain_news",
        lambda db, news_id, timeline_id: AiGroundedResponse(text="What happened...", evidence=[]),
    )
    resp = client.post("/api/v1/ai/explain-news", json={"news_id": 1}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["text"] == "What happened..."


# ── Router: Strategy Builder ─────────────────────────────────────────────────


def test_strategy_builder_endpoint_validates_risk_tolerance(client, test_db, test_timeline, auth_headers):
    resp = client.post(
        "/api/v1/ai/strategy-builder",
        json={"risk_tolerance": "yolo", "goal": "moon", "time_horizon": "1-5yr"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_strategy_builder_endpoint_success(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(
        ai_service, "strategy_builder",
        lambda risk_tolerance, goal, time_horizon, portfolio_context=None: {
            "narrative": "Diversify broadly.", "disclaimer": ai_service.STRATEGY_BUILDER_DISCLAIMER,
        },
    )
    resp = client.post(
        "/api/v1/ai/strategy-builder",
        json={"risk_tolerance": "moderate", "goal": "retirement", "time_horizon": "5yr+"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["narrative"] == "Diversify broadly."
    assert body["disclaimer"] == ai_service.STRATEGY_BUILDER_DISCLAIMER


def test_strategy_builder_endpoint_builds_portfolio_context_only_when_requested(
    client, test_db, test_timeline, auth_headers, monkeypatch,
):
    build_calls = []
    monkeypatch.setattr(
        ai_service, "build_portfolio_context",
        lambda db, user, timeline_id: build_calls.append(1) or None,
    )
    monkeypatch.setattr(
        ai_service, "strategy_builder",
        lambda risk_tolerance, goal, time_horizon, portfolio_context=None: {
            "narrative": "...", "disclaimer": ai_service.STRATEGY_BUILDER_DISCLAIMER,
        },
    )
    client.post(
        "/api/v1/ai/strategy-builder",
        json={"risk_tolerance": "moderate", "goal": "retirement", "time_horizon": "5yr+", "use_context": False},
        headers=auth_headers,
    )
    assert len(build_calls) == 0

    client.post(
        "/api/v1/ai/strategy-builder",
        json={"risk_tolerance": "moderate", "goal": "retirement", "time_horizon": "5yr+", "use_context": True},
        headers=auth_headers,
    )
    assert len(build_calls) == 1


# ── Router: Chat ──────────────────────────────────────────────────────────────


def test_chat_endpoint_no_auth(client):
    resp = client.post("/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 401


def test_chat_endpoint_not_configured_returns_503(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "")
    resp = client.post(
        "/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers=auth_headers,
    )
    assert resp.status_code == 503


def test_chat_endpoint_validates_scope(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    resp = client.post(
        "/api/v1/ai/chat",
        json={"messages": [{"role": "user", "content": "hi"}], "scope": "not-a-real-scope"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_chat_endpoint_streams_text(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")

    def _fake_stream_chat(db, user, messages, scope, use_context, timeline_id):
        yield "Hel"
        yield "lo!"
    monkeypatch.setattr(ai_service, "stream_chat", _fake_stream_chat)

    resp = client.post(
        "/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "hi"}], "scope": "market"}, headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.text == "Hello!"


def test_chat_endpoint_rate_limited(client, test_db, test_timeline, auth_headers, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(ai_service, "stream_chat", lambda *a, **kw: iter(["ok"]))

    for _ in range(30):
        resp = client.post(
            "/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers=auth_headers,
        )
        assert resp.status_code == 200
    resp = client.post(
        "/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers=auth_headers,
    )
    assert resp.status_code == 429


# ── Upstream (Gemini-side) errors -- distinct from our own "not configured" ─


def test_explain_metric_endpoint_upstream_error_returns_502(client, test_db, auth_headers, monkeypatch):
    # 502, not 503 -- 503 is already used for "not configured"; reusing it
    # here would make a transient Gemini outage indistinguishable from a
    # missing API key on the frontend (which only branches on the status
    # code, not the detail message). Confirmed live: this exact collision
    # made a real Gemini "high demand" error render as "set GEMINI_API_KEY".
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(raise_upstream_error=True)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    resp = client.post(
        "/api/v1/ai/explain-metric", json={"metric_name": "Sharpe Ratio"}, headers=auth_headers,
    )
    assert resp.status_code == 502
    assert "temporarily unavailable" in resp.json()["detail"]


def test_portfolio_review_endpoint_upstream_error_returns_502(
    client, test_db, test_timeline, test_company, test_portfolio, auth_headers, monkeypatch,
):
    test_db.add(Holding(portfolio_id=test_portfolio.id, company_id=test_company.id, quantity=10, avg_cost_basis=90.0))
    test_db.commit()
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(raise_upstream_error=True)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    resp = client.post("/api/v1/ai/portfolio-review", headers=auth_headers)
    assert resp.status_code == 502
    assert "temporarily unavailable" in resp.json()["detail"]


def test_stream_chat_yields_friendly_message_on_upstream_error(test_db, test_user, test_timeline, monkeypatch):
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(raise_upstream_error=True)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    chunks = list(ai_service.stream_chat(test_db, test_user, [{"role": "user", "content": "hi"}], "market", False, 1))
    assert len(chunks) == 1
    assert "temporarily unavailable" in chunks[0]


def test_chat_endpoint_upstream_error_still_returns_200_with_friendly_message(
    client, test_db, test_timeline, auth_headers, monkeypatch,
):
    # Can't downgrade to a 503 mid-stream (headers/200 are already
    # committed) -- the friendly message is delivered as stream content
    # instead, verified at the service layer above; this just confirms the
    # endpoint doesn't crash into a raw 500 when that happens.
    monkeypatch.setattr(config.settings, "gemini_api_key", "test-key")
    fake_client = _FakeClient(raise_upstream_error=True)
    monkeypatch.setattr(ai_service, "_get_client", lambda: fake_client)

    resp = client.post(
        "/api/v1/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]}, headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "temporarily unavailable" in resp.text
