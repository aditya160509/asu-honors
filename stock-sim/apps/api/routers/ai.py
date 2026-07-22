"""AI Financial Advisor (apps/web/PHASE_5_AI_WORKSPACE.md) -- all 6
capabilities: Explain Metrics, AI Chat, Portfolio Review, Company Review,
Explain News, Strategy Builder."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from google.genai import errors as genai_errors
from sqlalchemy.orm import Session

from apps.api.auth import get_current_user
from apps.api.config import settings
from apps.api.database import get_db
from apps.api.rate_limiter import ai_rate_limiter
from apps.api.schemas import (
    AiGroundedResponse,
    ChatRequest,
    CompanyReviewRequest,
    ExplainMetricRequest,
    ExplainMetricResponse,
    ExplainNewsRequest,
    StrategyBuilderRequest,
    StrategyBuilderResponse,
)
from apps.api.services import ai_service
from db.models import User

router = APIRouter(prefix="/api/v1/ai", tags=["AI Financial Advisor"])


def _not_configured(exc: ai_service.AiNotConfiguredError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


def _upstream_unavailable(exc: genai_errors.APIError) -> HTTPException:
    # Gemini's own transient errors (e.g. "high demand" 503s on the free
    # tier) would otherwise surface as an unhandled 500 with a full
    # traceback logged -- this is an expected, retryable condition, not a
    # bug in our code, so it gets a clean error response instead of
    # crashing the request. Deliberately 502, not 503: the frontend only
    # has the HTTP status to distinguish "not configured" (our own 503)
    # from "upstream provider is down" (this) -- reusing 503 for both
    # made a real Gemini outage render as "you forgot to set
    # GEMINI_API_KEY", which is actively misleading when the key is fine.
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="The AI provider is temporarily unavailable -- try again in a moment.",
    )


@router.post("/explain-metric", response_model=ExplainMetricResponse)
def explain_metric(
    request: ExplainMetricRequest,
    user: User = Depends(get_current_user),
) -> ExplainMetricResponse:
    # LLM calls cost real money per request -- a conservative, separately-
    # tunable per-user cap (see rate_limiter.py's ai_rate_limiter). Generic
    # (no value/context) requests mostly hit ai_service's in-memory cache
    # after the first call, so this mainly bounds value-specific requests.
    ai_rate_limiter.check(f"explain-metric:user:{user.id}", max_requests=30, window_seconds=3600)
    try:
        explanation = ai_service.explain_metric(
            metric_name=request.metric_name, value=request.value, context=request.context,
        )
    except ai_service.AiNotConfiguredError as exc:
        raise _not_configured(exc) from exc
    except genai_errors.APIError as exc:
        raise _upstream_unavailable(exc) from exc
    return ExplainMetricResponse(explanation=explanation)


@router.post("/portfolio-review", response_model=AiGroundedResponse)
def portfolio_review(
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AiGroundedResponse:
    ai_rate_limiter.check(f"portfolio-review:user:{user.id}", max_requests=10, window_seconds=3600)
    try:
        return ai_service.portfolio_review(db, user, timeline_id)
    except ai_service.AiNotConfiguredError as exc:
        raise _not_configured(exc) from exc
    except genai_errors.APIError as exc:
        raise _upstream_unavailable(exc) from exc


@router.post("/company-review", response_model=AiGroundedResponse)
def company_review(
    request: CompanyReviewRequest,
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AiGroundedResponse:
    ai_rate_limiter.check(f"company-review:user:{user.id}", max_requests=15, window_seconds=3600)
    try:
        return ai_service.company_review(db, request.ticker, timeline_id)
    except ai_service.AiNotConfiguredError as exc:
        raise _not_configured(exc) from exc
    except genai_errors.APIError as exc:
        raise _upstream_unavailable(exc) from exc


@router.post("/explain-news", response_model=AiGroundedResponse)
def explain_news(
    request: ExplainNewsRequest,
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AiGroundedResponse:
    ai_rate_limiter.check(f"explain-news:user:{user.id}", max_requests=20, window_seconds=3600)
    try:
        return ai_service.explain_news(db, request.news_id, timeline_id)
    except ai_service.AiNotConfiguredError as exc:
        raise _not_configured(exc) from exc
    except genai_errors.APIError as exc:
        raise _upstream_unavailable(exc) from exc


@router.post("/strategy-builder", response_model=StrategyBuilderResponse)
def strategy_builder(
    request: StrategyBuilderRequest,
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StrategyBuilderResponse:
    ai_rate_limiter.check(f"strategy-builder:user:{user.id}", max_requests=10, window_seconds=3600)
    portfolio_context = (
        ai_service.build_portfolio_context(db, user, timeline_id) if request.use_context else None
    )
    try:
        result = ai_service.strategy_builder(
            request.risk_tolerance, request.goal, request.time_horizon, portfolio_context,
        )
    except ai_service.AiNotConfiguredError as exc:
        raise _not_configured(exc) from exc
    except genai_errors.APIError as exc:
        raise _upstream_unavailable(exc) from exc
    return StrategyBuilderResponse(**result)


@router.post("/chat")
def chat(
    request: ChatRequest,
    timeline_id: int = Query(default=settings.default_timeline_id),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    ai_rate_limiter.check(f"chat:user:{user.id}", max_requests=30, window_seconds=3600)
    # Checked here (before the StreamingResponse starts) rather than inside
    # stream_chat -- stream_chat is a generator, so its body (including
    # _get_client()'s check) doesn't run until the response has already
    # started sending; by then it's too late to return a clean 503.
    if not settings.gemini_api_key:
        raise _not_configured(ai_service.AiNotConfiguredError(
            "AI advisor is not configured -- set GEMINI_API_KEY in .env (repo root)"
        ))
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    return StreamingResponse(
        ai_service.stream_chat(db, user, messages, request.scope, request.use_context, timeline_id),
        media_type="text/plain",
    )
