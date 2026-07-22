"""AI Financial Advisor (apps/web/PHASE_5_AI_WORKSPACE.md) -- all 6
capabilities: Explain Metrics, AI Chat, Portfolio Review, Company Review,
Explain News, Strategy Builder.

Never fabricates a response when unconfigured: every capability here checks
settings.gemini_api_key at call time and raises AiNotConfiguredError
immediately if it's empty, rather than returning a placeholder/fake
explanation (the same anti-fabrication rule the app's existing rule-based
"AI Insight Panel" already follows for a different reason -- see
apps/web/components/dashboard/AiInsightSection.tsx).

Portfolio Review, Company Review, and Explain News share one response
contract (AiGroundedResponse: narrative + evidence citations) and one
generation helper (_generate_grounded_response) -- structurally the same
problem (grounded narrative over a server-assembled JSON payload) applied to
three different data sources, per the design doc's own note that these
should stay consistent rather than each inventing its own shape.

Uses Google's Gemini API (google-genai SDK), not Anthropic -- picked
specifically for its free tier (no billing-credit purchase required), see
config.py's gemini_api_key. The google-genai SDK has no `.parsed` response
convenience (confirmed against the installed package, not assumed) --
structured output is requested via response_schema and parsed manually with
Pydantic's model_validate_json against response.text.
"""

import json
import logging
from typing import Any, Iterator, Optional

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from sqlalchemy.orm import Session

from apps.api.config import settings
from apps.api.exceptions import NotFoundError
from apps.api.schemas import AiGroundedResponse
from db.models import (
    Company,
    CompanyFactorScore,
    EconomicCycleState,
    Holding,
    IncomeStatement,
    Industry,
    NewsFeed,
    Portfolio,
    User,
)
from db.timeline_resolver import get_latest_price

logger = logging.getLogger(__name__)


class AiNotConfiguredError(RuntimeError):
    """Raised when an AI capability is called but GEMINI_API_KEY isn't set."""


_client: Optional[genai.Client] = None

# Every capability here is a short narrative over data the caller already
# assembled -- not a task that benefits from Gemini's extended "thinking"
# step. Worse than just wasted tokens/latency: thinking tokens count against
# max_output_tokens, so a verbose thinking pass can eat the whole budget and
# truncate the actual (JSON) output mid-string -- confirmed via
# response.usage_metadata.thoughts_token_count during debugging. Disabling
# it outright is more robust than just raising max_output_tokens, since the
# thinking budget the model chooses to spend isn't bounded otherwise.
_NO_THINKING = types.ThinkingConfig(thinking_budget=0)


def _r(value: Optional[float]) -> Optional[float]:
    """Round a context figure to 2dp before it ever reaches the model --
    the model faithfully reproduces whatever precision it's given (e.g. a
    raw '2510.357149268488%' from an unrounded DB value), so the fix
    belongs here, not as post-hoc regex cleanup of generated text."""
    return None if value is None else round(float(value), 2)

# Generic (no value/context) metric explanations don't vary per user or per
# request -- cached in-memory after the first generation instead of
# re-calling the LLM on every tooltip hover across every user. A tooltip
# that takes seconds to populate because it re-calls an LLM every time
# defeats the "quiet, quick" feel a Definition tooltip needs. Only
# value-specific explanations (a real number that varies) skip the cache.
_generic_explanation_cache: dict[str, str] = {}


def _get_client() -> genai.Client:
    global _client
    if not settings.gemini_api_key:
        raise AiNotConfiguredError(
            "AI advisor is not configured -- set GEMINI_API_KEY in .env (repo root)"
        )
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# ---------------------------------------------------------------------------
# Explain Metrics
# ---------------------------------------------------------------------------

_EXPLAIN_METRIC_SYSTEM_PROMPT = (
    "You are a financial terminology assistant embedded in a fictional "
    "stock market simulation app. Explain the given metric or term in "
    "plain language, in 2-3 sentences maximum. Be precise and educational, "
    "not chatty -- this renders inside a small tooltip. Never fabricate or "
    "assume specific numeric values beyond what's explicitly given to you "
    "in the request. This app is a simulation; never present anything as "
    "real financial advice."
)


def explain_metric(
    metric_name: str, value: Optional[float] = None, context: Optional[str] = None,
) -> str:
    """Plain-language explanation of a financial metric/term, for the
    Definition tooltip component (dotted-underline terms throughout the
    app -- see e.g. AnalyticsMetricsPanel.tsx's metric cards).
    """
    cache_key = metric_name.strip().lower()
    if value is None and context is None and cache_key in _generic_explanation_cache:
        return _generic_explanation_cache[cache_key]

    client = _get_client()
    prompt = f"Explain the financial term/metric: {metric_name}"
    if value is not None:
        prompt += f"\nIts current value here is: {value}"
    if context is not None:
        prompt += f"\nAdditional context: {context}"

    response = client.models.generate_content(
        model=settings.ai_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_EXPLAIN_METRIC_SYSTEM_PROMPT,
            max_output_tokens=512,
            thinking_config=_NO_THINKING,
        ),
    )
    text = (response.text or "").strip()

    if value is None and context is None:
        _generic_explanation_cache[cache_key] = text
    return text


# ---------------------------------------------------------------------------
# Shared grounded-response generation (Portfolio/Company Review, Explain News)
# ---------------------------------------------------------------------------


def _generate_grounded_response(system_prompt: str, context: dict[str, Any]) -> AiGroundedResponse:
    client = _get_client()
    user_prompt = "Context (JSON) -- only cite figures that appear in here:\n" + json.dumps(context, default=str)
    response = client.models.generate_content(
        model=settings.ai_model,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=2048,
            thinking_config=_NO_THINKING,
            response_mime_type="application/json",
            response_schema=AiGroundedResponse,
        ),
    )
    return AiGroundedResponse.model_validate_json(response.text)


# ---------------------------------------------------------------------------
# Portfolio Review + shared portfolio context (also used by Chat)
# ---------------------------------------------------------------------------

_PORTFOLIO_REVIEW_SYSTEM_PROMPT = (
    "You are a portfolio analyst assistant embedded in a fictional stock "
    "market simulation app. You are given a structured JSON snapshot of a "
    "user's simulated portfolio. Write a brief narrative review (3-5 "
    "sentences) covering overall performance, notable positions, and any "
    "risk considerations (concentration, volatility, drawdown). You MUST "
    "only cite figures that appear verbatim in the provided context -- "
    "never invent or estimate a number that isn't given to you. For every "
    "specific figure you cite, add a matching entry to the evidence list "
    "(type: 'holding' for a specific position keyed by its ticker, "
    "'metric' for a portfolio-level risk/return figure). The evidence "
    "'label' must be a short human-readable name for the figure (e.g. "
    "'Total Return' or 'AAPL Position'), never the number itself. This is a "
    "fictional simulation; never present this as real financial advice."
)


def build_portfolio_context(db: Session, user: User, timeline_id: int) -> Optional[dict[str, Any]]:
    """Structured, real-numbers-only snapshot of a user's portfolio --
    shared by portfolio_review and AI Chat's opt-in portfolio-context
    toggle. Returns None if the user has no portfolio on this timeline
    (Chat degrades to "no context available" rather than erroring; Review
    returns its own no-data message)."""
    from apps.api.services.portfolio_service import compute_risk_metrics, get_portfolio_history
    from apps.api.services.trade_service import get_portfolio_analytics

    try:
        analytics = get_portfolio_analytics(db, user, timeline_id)
    except NotFoundError:
        return None

    metrics = compute_risk_metrics(get_portfolio_history(db, user, timeline_id, "MAX"))

    holdings = (
        db.query(Holding)
        .join(Portfolio, Portfolio.id == Holding.portfolio_id)
        .filter(Portfolio.user_id == user.id, Portfolio.timeline_id == timeline_id)
        .all()
    )
    company_ids = [h.company_id for h in holdings]
    companies = (
        {c.id: c for c in db.query(Company).filter(Company.id.in_(company_ids)).all()} if company_ids else {}
    )

    holdings_payload = []
    for h in holdings:
        company = companies.get(h.company_id)
        if company is None or company.current_price is None:
            continue
        price = float(company.current_price)
        qty = float(h.quantity)
        cost = float(h.avg_cost_basis)
        holdings_payload.append({
            "ticker": company.ticker,
            "quantity": qty,
            "avg_cost_basis": round(cost, 2),
            "current_price": round(price, 2),
            "market_value": round(qty * price, 2),
            "unrealized_pnl_pct": round((price - cost) / cost * 100, 2) if cost > 0 else None,
        })

    return {
        "total_value": _r(analytics.total_value),
        "cash_balance": _r(analytics.cash_balance),
        "total_return_pct": _r(analytics.total_return_pct),
        "unrealized_pnl": _r(analytics.unrealized_pnl),
        "realized_pnl": _r(analytics.realized_pnl),
        "num_positions": analytics.num_positions,
        "win_rate": _r(analytics.win_rate),
        "cash_allocation_pct": _r(analytics.cash_allocation_pct),
        "allocation_by_sector": [{"sector": s.sector, "pct": _r(s.pct)} for s in analytics.allocation_by_sector],
        "beta": _r(metrics.get("beta")),
        "sharpe_ratio": _r(metrics.get("sharpe_ratio")),
        "volatility_pct": _r(metrics.get("volatility_pct")),
        "max_drawdown_pct": _r(metrics.get("max_drawdown_pct")),
        "value_at_risk_pct": _r(metrics.get("value_at_risk_pct")),
        "holdings": holdings_payload,
    }


def portfolio_review(db: Session, user: User, timeline_id: int) -> AiGroundedResponse:
    context = build_portfolio_context(db, user, timeline_id)
    if context is None:
        return AiGroundedResponse(text="No portfolio found for this timeline yet.", evidence=[])
    if context["num_positions"] == 0:
        return AiGroundedResponse(
            text="This portfolio has no positions yet -- place a trade to get a review of your holdings.",
            evidence=[],
        )
    return _generate_grounded_response(_PORTFOLIO_REVIEW_SYSTEM_PROMPT, context)


# ---------------------------------------------------------------------------
# Company Review
# ---------------------------------------------------------------------------

_COMPANY_REVIEW_SYSTEM_PROMPT = (
    "You are a company analyst assistant embedded in a fictional stock "
    "market simulation app. You are given a structured JSON snapshot of "
    "one company's current price, valuation, and latest financial "
    "statement. Write a brief analysis (3-5 sentences) covering valuation "
    "(price vs intrinsic value), financial quality signals, and one "
    "notable growth or risk consideration. Only cite figures present in "
    "the provided context -- never invent a number. Add an evidence entry "
    "(type: 'financial' for statement line items, 'metric' for "
    "valuation/quality scores) for every specific figure you cite. The "
    "evidence 'label' must be a short human-readable name for the figure "
    "(e.g. 'Revenue' or 'Intrinsic Value'), never the number itself. This is "
    "a fictional simulation; never present this as real investment advice."
)


def company_review(db: Session, ticker: str, timeline_id: int) -> AiGroundedResponse:
    company = db.query(Company).filter_by(ticker=ticker.upper()).first()
    if company is None:
        raise NotFoundError(f"Company '{ticker}' not found")

    price = get_latest_price(db, company.id, timeline_id)
    cfs = (
        db.query(CompanyFactorScore)
        .filter_by(company_id=company.id, timeline_id=timeline_id)
        .order_by(CompanyFactorScore.fiscal_period.desc())
        .first()
    )
    income = (
        db.query(IncomeStatement)
        .filter_by(company_id=company.id, timeline_id=timeline_id)
        .order_by(IncomeStatement.fiscal_period.desc())
        .first()
    )
    # No-data guard (Section AI Workspace, C3): a company with insufficient
    # underlying data must get an honest "not enough data" response instead
    # of the model generating a review that sounds confident but is thin.
    if price is None or cfs is None or income is None:
        return AiGroundedResponse(
            text=f"Not enough data available yet for a full analysis of {company.ticker}.",
            evidence=[],
        )

    context = {
        "ticker": company.ticker,
        "name": company.name,
        "current_price": _r(price),
        "intrinsic_value": _r(cfs.intrinsic_value),
        "intrinsic_score": _r(cfs.intrinsic_score),
        "fair_pe": _r(cfs.fair_pe),
        "moat_score": _r(cfs.moat_score),
        "financial_quality": _r(cfs.financial_quality),
        "growth_potential": _r(cfs.growth_potential),
        "management_quality": _r(cfs.management_quality),
        "latest_fiscal_period": income.fiscal_period,
        "revenue": _r(income.revenue),
        "net_profit": _r(income.net_profit),
        "eps": _r(income.eps),
    }
    return _generate_grounded_response(_COMPANY_REVIEW_SYSTEM_PROMPT, context)


# ---------------------------------------------------------------------------
# Explain News
# ---------------------------------------------------------------------------

_EXPLAIN_NEWS_SYSTEM_PROMPT = (
    "You are a financial news analyst assistant embedded in a fictional "
    "stock market simulation app. You are given one news item's headline, "
    "body, and sentiment/severity metadata. Structure your response as two "
    "clearly separated parts in the text: 'What happened' (a factual "
    "restatement of the news item itself, 1-2 sentences) and 'Why it might "
    "matter' (your own inferred implication for the affected company or "
    "sector, 1-2 sentences, clearly framed as inference, not fact -- do "
    "not blur the two). Only cite figures present in the provided context. "
    "For every evidence entry, 'label' must be a short human-readable name "
    "for the figure, never the number itself. This is a fictional simulation."
)


def explain_news(db: Session, news_id: int, timeline_id: int) -> AiGroundedResponse:
    news = db.query(NewsFeed).filter_by(id=news_id).first()
    if news is None:
        raise NotFoundError(f"News item {news_id} not found")

    company = db.query(Company).filter_by(id=news.company_id).first() if news.company_id else None
    industry = db.query(Industry).filter_by(id=news.industry_id).first() if news.industry_id else None

    context = {
        "headline": news.headline,
        "body": news.body,
        "sentiment": news.sentiment,
        "severity": _r(news.severity),
        "sim_date": news.sim_date.isoformat(),
        "company_ticker": company.ticker if company else None,
        "industry_name": industry.name if industry else None,
    }
    return _generate_grounded_response(_EXPLAIN_NEWS_SYSTEM_PROMPT, context)


# ---------------------------------------------------------------------------
# Strategy Builder -- single-turn, not conversational (Section AI Workspace,
# C6). No evidence-citation contract: the disclaimer is a hardcoded,
# server-guaranteed field rather than something we rely on the model to
# faithfully include every time.
# ---------------------------------------------------------------------------

_STRATEGY_BUILDER_SYSTEM_PROMPT = (
    "You are a strategy-suggestion assistant embedded in a fictional stock "
    "market simulation app. Given a user's stated risk tolerance, "
    "investment goal, and time horizon (and optionally their current "
    "simulated portfolio context), write a short illustrative strategy "
    "suggestion (4-6 sentences): a general allocation direction and the "
    "key risk considerations for that profile. Be general and educational "
    "-- not a specific stock pick list, and never suggest or imply placing "
    "any trade automatically. This is a fictional simulation for "
    "educational purposes only; the platform already shows a disclaimer "
    "alongside your response, so do not spend words repeating it at length."
)

STRATEGY_BUILDER_DISCLAIMER = (
    "This is an illustrative, educational suggestion generated within a fictional "
    "market simulation -- not real financial advice. Nothing is ever traded "
    "automatically; you decide everything yourself via the Trading Desk."
)


def strategy_builder(
    risk_tolerance: str, goal: str, time_horizon: str, portfolio_context: Optional[dict[str, Any]] = None,
) -> dict[str, str]:
    client = _get_client()
    prompt_parts = [
        f"Risk tolerance: {risk_tolerance}",
        f"Investment goal: {goal}",
        f"Time horizon: {time_horizon}",
    ]
    if portfolio_context is not None:
        prompt_parts.append(f"Current portfolio context (JSON): {json.dumps(portfolio_context, default=str)}")
    prompt = "\n".join(prompt_parts)

    response = client.models.generate_content(
        model=settings.ai_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_STRATEGY_BUILDER_SYSTEM_PROMPT,
            max_output_tokens=800,
            thinking_config=_NO_THINKING,
        ),
    )
    text = (response.text or "").strip()
    return {"narrative": text, "disclaimer": STRATEGY_BUILDER_DISCLAIMER}


# ---------------------------------------------------------------------------
# AI Chat -- parameterized by scope ("portfolio" | "market"), not a second
# duplicate endpoint (Section AI Workspace, C7 "Market Assistant").
# ---------------------------------------------------------------------------

_CHAT_SYSTEM_PROMPTS = {
    "portfolio": (
        "You are the portfolio assistant for a fictional stock market "
        "simulation app called Stock Sim. Help the user understand their "
        "simulated portfolio and general investing concepts. If the user "
        "asks about their specific holdings or performance and no "
        "portfolio context was provided in this conversation, say so "
        "plainly and suggest enabling portfolio context or using the "
        "dedicated Portfolio Review feature instead -- never invent "
        "specific numbers about their holdings. This is a simulation; "
        "never present yourself as giving real financial advice."
    ),
    "market": (
        "You are the market assistant for a fictional stock market "
        "simulation app called Stock Sim. Help the user understand general "
        "market and investing concepts, and this simulation's own current "
        "market data when it's given to you. Never invent specific prices "
        "or figures you weren't given. This is a simulation; never present "
        "yourself as giving real financial advice."
    ),
}


def _market_chat_context(db: Session, timeline_id: int) -> Optional[dict[str, Any]]:
    cycle = (
        db.query(EconomicCycleState)
        .filter_by(timeline_id=timeline_id)
        .order_by(EconomicCycleState.sim_date.desc())
        .first()
    )
    if cycle is None:
        return None
    return {
        "cycle_phase": cycle.cycle_phase,
        "sim_date": cycle.sim_date.isoformat(),
        "market_sentiment": _r(cycle.market_sentiment),
        "interest_rate": _r(cycle.interest_rate),
    }


def stream_chat(
    db: Session,
    user: User,
    messages: list[dict[str, str]],
    scope: str,
    use_context: bool,
    timeline_id: int,
) -> Iterator[str]:
    """Streams chat completion text chunks. Raises AiNotConfiguredError
    (before yielding anything) if unconfigured -- callers should check that
    up front rather than let it surface mid-stream."""
    client = _get_client()
    system = _CHAT_SYSTEM_PROMPTS[scope]

    context = build_portfolio_context(db, user, timeline_id) if scope == "portfolio" else _market_chat_context(db, timeline_id)
    if use_context and context is not None:
        system += "\n\nCurrent context (JSON) -- only cite figures from here: " + json.dumps(context, default=str)

    # Gemini has no "assistant" role -- prior model turns are "model".
    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part(text=m["content"])],
        )
        for m in messages
    ]

    # Can't turn this into a clean HTTP error status once streaming starts
    # (headers/200 are already committed by the time a chunk fails) -- catch
    # it here and yield a plain-text notice instead of letting the
    # exception propagate and truncate the HTTP response silently.
    try:
        for chunk in client.models.generate_content_stream(
            model=settings.ai_model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=1536,
                thinking_config=_NO_THINKING,
            ),
        ):
            if chunk.text:
                yield chunk.text
    except genai_errors.APIError:
        yield "\n\n**The AI provider is temporarily unavailable -- try again in a moment.**"
