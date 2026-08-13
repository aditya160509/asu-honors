"""Server-side execution and lineage for the Market Explorer screener.

The service deliberately evaluates a small allowlisted metric registry rather
than interpolating user input into SQL.  This gives the client one reproducible
query contract while leaving room for materialized snapshots when the dataset
outgrows the bounded history window used here.
"""

from __future__ import annotations

import hashlib
import json
import math
import ast
import csv
import io
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from apps.api.schemas import (
    BreadthPoint,
    BreadthResponse,
    CompanyGridItem,
    CorrelationResponse,
    DcfRequest,
    DcfResponse,
    DcfSensitivityCell,
    ScreenerEventImpact,
    ScreenerEventImpactResponse,
    ScreenerExposurePoint,
    ScreenerExposureRequest,
    ScreenerNewsCluster,
    ScreenerNewsClustersResponse,
    ScreenerTranscriptMatch,
    ScreenerTranscriptSearchResponse,
    ScreenerClause,
    ScreenerHeatmapCell,
    ScreenerMetric,
    ScreenerProvenance,
    ScreenerQuery,
    ScreenerQueryResponse,
    ScreenerRanking,
    ScreenerRow,
    FormulaEvaluateResponse,
    FormulaValue,
)
from apps.api.services.market_service import get_market_grid
from db.models import CashFlowStatement, CompanyFactorScore, Company, ConCall, EventInstance, IncomeStatement, MarketEvent, NewsFeed, PriceHistory, SimulationState, User, Watchlist


CALCULATION_VERSION = "screener-v1"
DEFAULT_COLUMNS = [
    "ticker",
    "name",
    "industry_name",
    "price",
    "day_change_pct",
    "market_cap",
    "iv_gap_pct",
    "intrinsic_value",
    "volatility",
    "avg_volume_20d",
    "rsi_14",
    "return_1m_pct",
    "financial_quality",
    "growth_potential",
    "revenue_growth_pct",
    "gross_margin_pct",
    "operating_margin_pct",
    "net_margin_pct",
    "fcf_margin_pct",
    "cash_conversion_pct",
]

# These are rendered by the legacy table but are not persisted as analytical
# observations.  They remain valid query columns so the shared query contract
# can be sent by both the old terminal table and the research workspace.
DISPLAY_ONLY_COLUMNS = {"spark"}


def _metric(
    key: str,
    label: str,
    aliases: list[str],
    category: str,
    unit: str,
    value_type: str = "number",
    timeframe: str = "latest",
    null_policy: str = "null_when_missing",
    operators: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "aliases": aliases,
        "category": category,
        "unit": unit,
        "value_type": value_type,
        "timeframe": timeframe,
        "null_policy": null_policy,
        "calculation_version": CALCULATION_VERSION,
        "operators": operators or ["=", "!=", ">", ">=", "<", "<=", "is_null", "not_null"],
    }


METRICS: list[dict[str, Any]] = [
    _metric("ticker", "Ticker", ["ticker", "symbol"], "identity", "text", "text", operators=["=", "contains", "in"]),
    _metric("name", "Company", ["company", "name"], "identity", "text", "text", operators=["=", "contains", "in"]),
    _metric("industry_name", "Industry", ["industry", "sector"], "identity", "text", "text", operators=["=", "contains", "in"]),
    _metric("market_cap_category", "Cap Class", ["cap class", "cap category", "size"], "identity", "text", "text", operators=["=", "in"]),
    _metric("price", "Price", ["price", "share price", "current price"], "price", "currency"),
    _metric("prev_close", "Previous Close", ["prev close", "previous close"], "price", "currency"),
    _metric("day_change_pct", "Day Change %", ["change", "day change", "chg"], "price", "percent"),
    _metric("day_change_abs", "Day Change", ["absolute change", "day change absolute"], "price", "currency"),
    _metric("market_cap", "Market Cap", ["market cap", "marketcap", "mcap", "cap"], "fundamental", "currency"),
    _metric("intrinsic_value", "Intrinsic Value", ["intrinsic value", "iv", "fair value"], "valuation", "currency"),
    _metric("iv_gap_pct", "IV Gap %", ["iv gap", "ivgap", "valuation gap"], "valuation", "percent"),
    _metric("volatility", "Volatility", ["volatility", "vol"], "risk", "percent"),
    _metric("avg_volume_20d", "Average Volume", ["volume", "avg volume", "20d volume"], "liquidity", "shares"),
    _metric("high_52w", "52W High", ["52w high", "high 52w"], "price", "currency"),
    _metric("low_52w", "52W Low", ["52w low", "low 52w"], "price", "currency"),
    _metric("pct_off_high", "% Off 52W High", ["off high", "pct off high"], "price", "percent"),
    _metric("rsi_14", "RSI (14)", ["rsi", "rsi 14"], "technical", "score", timeframe="14 sessions"),
    _metric("sma_20_pct", "Distance from SMA 20", ["sma", "sma 20", "distance from sma"], "technical", "percent", timeframe="20 sessions"),
    _metric("return_1m_pct", "1M Return", ["1m return", "one month return", "monthly return"], "technical", "percent", timeframe="21 sessions"),
    _metric("relative_strength_pct", "Relative Strength", ["relative strength", "rs"], "technical", "percent", timeframe="21 sessions"),
    _metric("management_quality", "Management Quality", ["management quality", "management"], "factor", "score"),
    _metric("moat_score", "Moat", ["moat", "moat score"], "factor", "score"),
    _metric("financial_quality", "Financial Quality", ["financial quality", "quality"], "factor", "score"),
    _metric("fcf_quality", "FCF Quality", ["fcf quality", "cash flow quality"], "factor", "score"),
    _metric("growth_potential", "Growth Potential", ["growth", "growth potential"], "factor", "score"),
    _metric("intrinsic_score", "Intrinsic Score", ["intrinsic score", "value score"], "factor", "score"),
    _metric("fair_pe", "Fair P/E", ["fair pe", "fair p/e"], "valuation", "multiple"),
    _metric("revenue_growth_pct", "Revenue Growth %", ["revenue growth", "revenue growth %", "sales growth"], "fundamental", "percent", timeframe="quarter over quarter"),
    _metric("gross_margin_pct", "Gross Margin %", ["gross margin", "gross margin %"], "quality", "percent"),
    _metric("operating_margin_pct", "Operating Margin %", ["operating margin", "ebit margin", "operating margin %"], "quality", "percent"),
    _metric("net_margin_pct", "Net Margin %", ["net margin", "net margin %"], "quality", "percent"),
    _metric("fcf_margin_pct", "FCF Margin %", ["fcf margin", "free cash flow margin"], "quality", "percent"),
    _metric("cash_conversion_pct", "Cash Conversion %", ["cash conversion", "ocf conversion", "cash earnings conversion"], "quality", "percent"),
]

METRIC_BY_KEY = {item["key"]: item for item in METRICS}
METRIC_ALIASES = {alias.lower(): item["key"] for item in METRICS for alias in item["aliases"]}


def metric_definitions() -> list[ScreenerMetric]:
    return [ScreenerMetric.model_validate(item) for item in METRICS]


def normalize_metric(metric: str) -> str:
    normalized = metric.strip().lower().replace("-", "_")
    return METRIC_ALIASES.get(normalized, normalized)


def fingerprint_query(query: ScreenerQuery) -> str:
    payload = query.model_dump(mode="json", exclude_none=True)
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:24]


def _number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def _market_cap_category(value: float | None) -> str:
    if value is None or value <= 0:
        return "Unknown"
    if value >= 200e9:
        return "Mega"
    if value >= 10e9:
        return "Large"
    if value >= 2e9:
        return "Mid"
    if value >= 300e6:
        return "Small"
    return "Micro"


def _rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    changes = [closes[i] - closes[i - 1] for i in range(len(closes) - period, len(closes))]
    gains = sum(max(change, 0.0) for change in changes) / period
    losses = sum(max(-change, 0.0) for change in changes) / period
    if losses == 0:
        return 100.0 if gains > 0 else 50.0
    return 100.0 - (100.0 / (1.0 + gains / losses))


def _series_metrics(closes: list[float]) -> dict[str, float | None]:
    if not closes:
        return {"rsi_14": None, "sma_20_pct": None, "return_1m_pct": None, "relative_strength_pct": None}
    price = closes[-1]
    sma_window = closes[-20:]
    sma = sum(sma_window) / len(sma_window)
    return_1m = ((price / closes[-21]) - 1.0) * 100.0 if len(closes) >= 22 and closes[-21] else None
    return {
        "rsi_14": _rsi(closes),
        "sma_20_pct": ((price / sma) - 1.0) * 100.0 if sma else None,
        "return_1m_pct": return_1m,
        # The simulated universe has no external benchmark in this service;
        # the market's equal-weight close is the declared benchmark.
        "relative_strength_pct": return_1m,
    }


def _fiscal_period_for_date(as_of_date: date) -> str:
    quarter = ((as_of_date.month - 1) // 3) + 1
    return f"{as_of_date.year}Q{quarter}"


def _latest_factors(db: Session, timeline_id: int, as_of_date: date | None = None) -> dict[int, dict[str, float | None]]:
    rows = (
        db.query(CompanyFactorScore)
        .filter(CompanyFactorScore.timeline_id == timeline_id)
        .order_by(CompanyFactorScore.company_id, CompanyFactorScore.fiscal_period.desc(), CompanyFactorScore.id.desc())
        .all()
    )
    result: dict[int, dict[str, float | None]] = {}
    cutoff_period = _fiscal_period_for_date(as_of_date) if as_of_date else None
    for row in rows:
        # Factor rows are quarterly snapshots.  A historical screen may only
        # see the latest snapshot whose period has started by the requested
        # date; otherwise a backtest can accidentally read today's factors.
        if cutoff_period and row.fiscal_period > cutoff_period:
            continue
        if row.company_id in result:
            continue
        result[row.company_id] = {
            key: _number(getattr(row, key, None))
            for key in (
                "management_quality",
                "moat_score",
                "financial_quality",
                "fcf_quality",
                "growth_potential",
                "intrinsic_score",
                "fair_pe",
            )
        }
    return result


def _latest_statement_metrics(db: Session, timeline_id: int, as_of_date: date) -> dict[int, dict[str, float | None]]:
    """Return point-in-time fundamental quality ratios for each company.

    Statement rows are quarterly snapshots. The fiscal-period cutoff mirrors
    the factor resolver so historical screens cannot see a later quarter's
    revenue or cash flow. Missing/zero denominators stay null and are surfaced
    through the normal metric provenance envelope.
    """
    cutoff_period = _fiscal_period_for_date(as_of_date)
    income_rows = (
        db.query(IncomeStatement)
        .filter(IncomeStatement.timeline_id == timeline_id, IncomeStatement.fiscal_period <= cutoff_period)
        .order_by(IncomeStatement.company_id, IncomeStatement.fiscal_period.asc(), IncomeStatement.id.asc())
        .all()
    )
    cash_rows = (
        db.query(CashFlowStatement)
        .filter(CashFlowStatement.timeline_id == timeline_id, CashFlowStatement.fiscal_period <= cutoff_period)
        .order_by(CashFlowStatement.company_id, CashFlowStatement.fiscal_period.asc(), CashFlowStatement.id.asc())
        .all()
    )
    income_by_company: dict[int, list[IncomeStatement]] = {}
    cash_by_company: dict[int, list[CashFlowStatement]] = {}
    for row in income_rows:
        income_by_company.setdefault(row.company_id, []).append(row)
    for row in cash_rows:
        cash_by_company.setdefault(row.company_id, []).append(row)

    def ratio(numerator: Any, denominator: Any) -> float | None:
        numerator_value = _number(numerator)
        denominator_value = _number(denominator)
        return (numerator_value / denominator_value) * 100.0 if numerator_value is not None and denominator_value not in (None, 0) else None

    result: dict[int, dict[str, float | None]] = {}
    for company_id, rows in income_by_company.items():
        latest = rows[-1]
        previous = rows[-2] if len(rows) > 1 else None
        cash = cash_by_company.get(company_id, [])
        latest_cash = cash[-1] if cash else None
        result[company_id] = {
            "revenue_growth_pct": ratio(_number(latest.revenue) - _number(previous.revenue), previous.revenue) if previous else None,
            "gross_margin_pct": ratio(latest.gross_profit, latest.revenue),
            "operating_margin_pct": ratio(latest.ebit, latest.revenue),
            "net_margin_pct": ratio(latest.net_profit, latest.revenue),
            "fcf_margin_pct": ratio(latest_cash.free_cash_flow, latest.revenue) if latest_cash else None,
            "cash_conversion_pct": ratio(latest_cash.operating_cash_flow, latest.net_profit) if latest_cash else None,
        }
    return result


def _history_by_company(db: Session, timeline_id: int, as_of_date: date) -> dict[int, list[float]]:
    cutoff = as_of_date - timedelta(days=420)
    rows = (
        db.query(PriceHistory.company_id, PriceHistory.sim_date, PriceHistory.close)
        .filter(
            PriceHistory.timeline_id == timeline_id,
            PriceHistory.sim_date <= as_of_date,
            PriceHistory.sim_date > cutoff,
        )
        .order_by(PriceHistory.company_id, PriceHistory.sim_date)
        .all()
    )
    result: dict[int, list[float]] = {}
    for row in rows:
        close = _number(row.close)
        if close is not None:
            result.setdefault(row.company_id, []).append(close)
    return result


def _build_context(db: Session, query: ScreenerQuery) -> tuple[list[dict[str, Any]], date]:
    grid = get_market_grid(db, query.timeline_id, as_of_date=query.as_of_date)
    as_of_date = query.as_of_date or grid.sim_date
    factors = _latest_factors(db, query.timeline_id, as_of_date)
    statements = _latest_statement_metrics(db, query.timeline_id, as_of_date)
    history = _history_by_company(db, query.timeline_id, as_of_date)
    contexts: list[dict[str, Any]] = []
    for company in grid.companies:
        price = _number(company.current_price)
        intrinsic = _number(company.intrinsic_value)
        market_cap = _number(company.market_cap)
        values: dict[str, Any] = {
            "ticker": company.ticker,
            "name": company.name,
            "industry_name": company.industry_name,
            "price": price,
            "prev_close": _number(company.prev_close),
            "day_change_pct": _number(company.day_change_pct),
            "day_change_abs": (price - _number(company.prev_close)) if price is not None and _number(company.prev_close) is not None else None,
            "market_cap": market_cap,
            "intrinsic_value": intrinsic,
            "iv_gap_pct": ((price - intrinsic) / intrinsic * 100.0) if price is not None and intrinsic else None,
            "volatility": _number(company.volatility),
            "avg_volume_20d": _number(company.avg_volume_20d),
            "high_52w": _number(company.high_52w),
            "low_52w": _number(company.low_52w),
            "pct_off_high": ((price / _number(company.high_52w)) - 1.0) * 100.0 if price is not None and _number(company.high_52w) else None,
            "market_cap_category": _market_cap_category(market_cap),
        }
        values.update(_series_metrics(history.get(company.id, [])))
        values.update(factors.get(company.id, {}))
        values.update(statements.get(company.id, {}))
        contexts.append({"company": company, "values": values})
    return contexts, as_of_date


def _matches(actual: Any, clause: ScreenerClause) -> bool:
    operator = clause.operator
    if operator == "is_null":
        return actual is None
    if operator == "not_null":
        return actual is not None
    if actual is None:
        return False
    expected = clause.value
    if operator in {"contains", "=", "!=", "in"} and isinstance(actual, str):
        if operator == "contains":
            return str(expected).lower() in actual.lower()
        if operator == "in":
            options = expected if isinstance(expected, list) else [expected]
            return actual.lower() in {str(item).lower() for item in options}
        equal = actual.lower() == str(expected).lower()
        return not equal if operator == "!=" else equal
    if operator == "in":
        options = expected if isinstance(expected, list) else [expected]
        return actual in options
    try:
        left = float(actual)
        right = float(expected)
    except (TypeError, ValueError):
        equal = actual == expected
        return not equal if operator == "!=" else equal
    if operator == "=":
        return left == right
    if operator == "!=":
        return left != right
    if operator == ">":
        return left > right
    if operator == ">=":
        return left >= right
    if operator == "<":
        return left < right
    if operator == "<=":
        return left <= right
    return False


def _selected_columns(query: ScreenerQuery) -> list[str]:
    columns = [normalize_metric(key) for key in (query.columns or DEFAULT_COLUMNS)]
    selected = [key for key in columns if key in METRIC_BY_KEY and key not in DISPLAY_ONLY_COLUMNS]
    return list(dict.fromkeys(selected)) or DEFAULT_COLUMNS


def _provenance(metric: str, query: ScreenerQuery, as_of_date: date, missing_reason: str | None = None) -> ScreenerProvenance:
    descriptor = METRIC_BY_KEY[metric]
    formula = None
    source = "market_service.get_market_grid"
    if metric in {"iv_gap_pct", "market_cap_category"}:
        source = "screener_service"
        formula = "(price - intrinsic_value) / intrinsic_value * 100" if metric == "iv_gap_pct" else "market_cap_thresholds_v1"
    elif metric in {"rsi_14", "sma_20_pct", "return_1m_pct", "relative_strength_pct"}:
        source = "PriceHistory"
        formula = {
            "rsi_14": "Wilder RSI over 14 price changes",
            "sma_20_pct": "(close / SMA(close, 20) - 1) * 100",
            "return_1m_pct": "(close / close[-21] - 1) * 100",
            "relative_strength_pct": "equal-weight market benchmark proxy; 1M return",
        }[metric]
    elif metric in {"management_quality", "moat_score", "financial_quality", "fcf_quality", "growth_potential", "intrinsic_score", "fair_pe"}:
        source = "CompanyFactorScore"
    elif metric in {"revenue_growth_pct", "gross_margin_pct", "operating_margin_pct", "net_margin_pct", "fcf_margin_pct", "cash_conversion_pct"}:
        source = "IncomeStatement + CashFlowStatement"
        formula = {
            "revenue_growth_pct": "(revenue_t / revenue_t-1 - 1) * 100",
            "gross_margin_pct": "gross_profit / revenue * 100",
            "operating_margin_pct": "ebit / revenue * 100",
            "net_margin_pct": "net_profit / revenue * 100",
            "fcf_margin_pct": "free_cash_flow / revenue * 100",
            "cash_conversion_pct": "operating_cash_flow / net_profit * 100",
        }[metric]
    return ScreenerProvenance(
        source=source,
        source_ids=[metric],
        formula=formula,
        calculation_version=descriptor["calculation_version"],
        timeline_id=query.timeline_id,
        as_of_date=as_of_date,
        generated_at=datetime.now(timezone.utc),
        missing_reason=missing_reason,
    )


def _normalize_query(query: ScreenerQuery) -> ScreenerQuery:
    payload = query.model_dump()
    payload["clauses"] = [
        {**clause, "metric": normalize_metric(clause["metric"])}
        for clause in payload["clauses"]
    ]
    payload["sort"] = [
        {**entry, "metric": normalize_metric(entry["metric"])}
        for entry in payload["sort"]
    ]
    return ScreenerQuery.model_validate(payload)


def validate_query(query: ScreenerQuery) -> ScreenerQuery:
    """Normalize and reject unknown registry keys before query execution.

    Silently dropping a misspelled metric makes a saved screen look valid while
    returning a materially different universe, so the API fails closed with a
    useful 422 instead.
    """
    normalized = _normalize_query(query)
    errors: list[str] = []
    for index, clause in enumerate(normalized.clauses):
        if clause.metric not in METRIC_BY_KEY:
            errors.append(f"clauses[{index}].metric '{clause.metric}' is not in the screener metric registry")
    for index, sort_item in enumerate(normalized.sort):
        if sort_item.metric not in METRIC_BY_KEY:
            errors.append(f"sort[{index}].metric '{sort_item.metric}' is not in the screener metric registry")
    for index, column in enumerate(normalized.columns):
        if normalize_metric(column) not in METRIC_BY_KEY and normalize_metric(column) not in DISPLAY_ONLY_COLUMNS:
            errors.append(f"columns[{index}] '{column}' is not in the screener metric registry")
    if errors:
        raise ValueError("; ".join(errors))
    return normalized


def _watchlist_company_ids(db: Session, query: ScreenerQuery, user: User | None) -> set[int]:
    if query.universe.type != "watchlist":
        return set()
    if user is None:
        raise ValueError("Watchlist universes require authentication")
    if query.universe.watchlist_id is None:
        raise ValueError("watchlist_id is required for a watchlist universe")
    return {
        company_id
        for (company_id,) in db.query(Watchlist.company_id).filter(
            Watchlist.user_id == user.id,
            Watchlist.group_id == query.universe.watchlist_id,
        ).all()
    }


def _apply_query_filters(contexts: list[dict[str, Any]], query: ScreenerQuery, watchlist_ids: set[int] | None = None) -> list[dict[str, Any]]:
    universe = query.universe
    if universe.type == "industry" and universe.industry_names:
        allowed = {name.lower() for name in universe.industry_names}
        contexts = [item for item in contexts if item["company"].industry_name.lower() in allowed]
    if universe.type == "tickers" and universe.tickers:
        allowed = {ticker.upper() for ticker in universe.tickers}
        contexts = [item for item in contexts if item["company"].ticker.upper() in allowed]
    if universe.type == "watchlist":
        contexts = [item for item in contexts if item["company"].id in (watchlist_ids or set())]

    query_text = (query.query_text or "").strip().lower()
    if query_text:
        contexts = [
            item for item in contexts
            if query_text in item["company"].ticker.lower() or query_text in item["company"].name.lower()
        ]

    clauses = query.clauses
    for item in contexts:
        matches = [_matches(item["values"].get(normalize_metric(clause.metric)), clause) for clause in clauses]
        item["matched"] = (any(matches) if query.logic == "any" and matches else all(matches))
    return [item for item in contexts if item["matched"]]


def query_screener(db: Session, raw_query: ScreenerQuery, user: User | None = None) -> ScreenerQueryResponse:
    query = validate_query(raw_query)
    contexts, as_of_date = _build_context(db, query)
    contexts = _apply_query_filters(contexts, query, _watchlist_company_ids(db, query, user))

    for sort_item in reversed(query.sort):
        metric = normalize_metric(sort_item.metric)
        if metric not in METRIC_BY_KEY:
            continue
        contexts.sort(
            key=lambda item: (item["values"].get(metric) is None, item["values"].get(metric) if item["values"].get(metric) is not None else 0),
            reverse=sort_item.direction == "desc",
        )

    columns = _selected_columns(query)
    fingerprint = fingerprint_query(query)
    total = len(contexts)
    percentile_values: dict[str, list[float]] = {}
    for key in columns:
        if METRIC_BY_KEY.get(key, {}).get("value_type") == "text":
            continue
        values = sorted(
            numeric
            for numeric in (_number(item["values"].get(key)) for item in contexts)
            if numeric is not None
        )
        if values:
            percentile_values[key] = values
    page = contexts[query.offset : query.offset + query.page_size]
    rows: list[ScreenerRow] = []
    for item in page:
        metrics = {key: item["values"].get(key) for key in columns}
        ranks = {
            key: round(sum(candidate <= float(value) for candidate in distribution) / len(distribution) * 100.0, 2)
            for key, distribution in percentile_values.items()
            if (value := _number(item["values"].get(key))) is not None
        }
        provenance = {
            key: _provenance(key, query, as_of_date, "No observation for this company/date" if metrics[key] is None else None)
            for key in columns
            if key in METRIC_BY_KEY
        }
        rows.append(ScreenerRow(company=item["company"], metrics=metrics, ranks=ranks, provenance=provenance))

    return ScreenerQueryResponse(
        rows=rows,
        total=total,
        offset=query.offset,
        page_size=query.page_size,
        query=query,
        query_fingerprint=fingerprint,
        timeline_id=query.timeline_id,
        as_of_date=as_of_date,
    )


EXPORT_MAX_ROWS = 10_000


def export_csv(
    db: Session,
    raw_query: ScreenerQuery,
    user: User | None = None,
) -> tuple[str, str, date, int, int]:
    """Export a complete, bounded screener result set as CSV.

    The API query contract intentionally caps a single page at 500 rows.  An
    export is allowed to page through the same executor up to 10,000 rows, so
    it remains deterministic and never turns a client-side visible-page dump
    into a misleading export.  Larger exports should move to an async job
    once the dataset needs that scale.
    """
    page_size = 500
    base_query = validate_query(raw_query.model_copy(update={"offset": 0, "page_size": page_size}))
    first_page = query_screener(db, base_query, user)
    total = first_page.total
    export_total = min(total, EXPORT_MAX_ROWS)
    columns = _selected_columns(base_query)
    headers: list[str] = []
    header_labels = {metric["key"]: metric["label"] for metric in METRICS}
    for key in columns:
        label = header_labels.get(key, key)
        if label not in headers:
            headers.append(label)

    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(headers)

    def write_page(page: ScreenerQueryResponse) -> None:
        for row in page.rows:
            writer.writerow([
                "" if row.metrics.get(key) is None else row.metrics.get(key)
                for key in columns
            ])

    write_page(first_page)
    offset = len(first_page.rows)
    while offset < export_total:
        page_query = base_query.model_copy(update={"offset": offset})
        page = query_screener(db, page_query, user)
        if not page.rows:
            break
        write_page(page)
        offset += len(page.rows)

    return output.getvalue(), first_page.query_fingerprint, first_page.as_of_date, offset, total


def heatmap(db: Session, raw_query: ScreenerQuery, color_metric: str = "day_change_pct", size_metric: str = "market_cap", user: User | None = None) -> list[ScreenerHeatmapCell]:
    query = validate_query(raw_query.model_copy(update={"offset": 0, "page_size": 500}))
    contexts, _ = _build_context(db, query)
    color_metric = normalize_metric(color_metric)
    size_metric = normalize_metric(size_metric)
    if color_metric not in METRIC_BY_KEY or size_metric not in METRIC_BY_KEY:
        raise ValueError("Heatmap metrics must be present in the screener metric registry")
    contexts = _apply_query_filters(contexts, query, _watchlist_company_ids(db, query, user))
    cells: dict[str, dict[str, Any]] = {}
    for item in contexts:
        values = item["values"]
        industry = item["company"].industry_name or "Unclassified"
        cell = cells.setdefault(industry, {"count": 0, "size": 0.0, "color": []})
        cell["count"] += 1
        cell["size"] += _number(values.get(size_metric)) or 0.0
        color = _number(values.get(color_metric))
        if color is not None:
            cell["color"].append(color)
    fingerprint = fingerprint_query(query)
    return [
        ScreenerHeatmapCell(
            key=key,
            label=key,
            count=value["count"],
            size_value=value["size"] or None,
            color_value=(sum(value["color"]) / len(value["color"])) if value["color"] else None,
            color_metric=color_metric,
            size_metric=size_metric,
            query_fingerprint=fingerprint,
        )
        for key, value in sorted(cells.items(), key=lambda entry: entry[1]["size"], reverse=True)
    ]


def rankings(db: Session, raw_query: ScreenerQuery, metric: str, direction: str = "desc", limit: int = 50, user: User | None = None) -> list[ScreenerRanking]:
    metric = normalize_metric(metric)
    if metric not in METRIC_BY_KEY:
        raise ValueError(f"Ranking metric '{metric}' is not in the screener metric registry")
    query = validate_query(raw_query.model_copy(update={"sort": [], "offset": 0, "page_size": 500}))
    contexts, as_of_date = _build_context(db, query)
    contexts = _apply_query_filters(contexts, query, _watchlist_company_ids(db, query, user))
    contexts.sort(key=lambda item: (item["values"].get(metric) is None, item["values"].get(metric) or 0), reverse=direction == "desc")
    values = [_number(item["values"].get(metric)) for item in contexts]
    non_null = [value for value in values if value is not None]
    result: list[ScreenerRanking] = []
    for index, item in enumerate(contexts[: max(1, min(limit, 500))], start=1):
        value = item["values"].get(metric)
        numeric = _number(value)
        percentile = (sum(1 for candidate in non_null if numeric is not None and candidate <= numeric) / len(non_null) * 100) if numeric is not None and non_null else None
        result.append(
            ScreenerRanking(
                ticker=item["company"].ticker,
                name=item["company"].name,
                industry_name=item["company"].industry_name,
                metric=metric,
                value=value,
                rank=index,
                percentile=percentile,
                provenance=_provenance(metric, query, as_of_date, "No observation for this company/date" if value is None else None),
            )
        )
    return result


def calculate_dcf(db: Session, ticker: str, assumptions: DcfRequest, timeline_id: int = 1, as_of_date: date | None = None) -> DcfResponse:
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if company is None:
        raise ValueError(f"Company '{ticker}' not found")
    statements = (
        db.query(IncomeStatement)
        .filter(IncomeStatement.company_id == company.id, IncomeStatement.timeline_id == timeline_id)
        .order_by(IncomeStatement.fiscal_period.desc(), IncomeStatement.id.desc())
        .all()
    )
    cutoff_period = _fiscal_period_for_date(as_of_date) if as_of_date else None
    statement = next((item for item in statements if cutoff_period is None or item.fiscal_period <= cutoff_period), None)
    if statement is None or _number(statement.revenue) is None:
        raise ValueError(f"No income statement revenue for {ticker}")
    base_revenue = float(statement.revenue)
    shares = assumptions.shares_outstanding or _number(company.shares_outstanding)
    if not shares or shares <= 0:
        raise ValueError(f"No shares outstanding for {ticker}")
    revenue = base_revenue
    cash_flows: list[float] = []
    for _ in range(assumptions.projection_years):
        revenue *= 1 + assumptions.revenue_growth
        nopat = revenue * assumptions.ebitda_margin * (1 - assumptions.tax_rate)
        cash_flows.append(nopat * (1 - assumptions.reinvestment_rate))
    discount = sum(value / ((1 + assumptions.wacc) ** (index + 1)) for index, value in enumerate(cash_flows))
    terminal_fcf = cash_flows[-1] * (1 + assumptions.terminal_growth)
    terminal_value = terminal_fcf / (assumptions.wacc - assumptions.terminal_growth)
    enterprise = discount + terminal_value / ((1 + assumptions.wacc) ** assumptions.projection_years)
    equity = enterprise - assumptions.net_debt
    per_share = equity / shares

    sensitivity: list[DcfSensitivityCell] = []
    for wacc_delta in (-2, -1, 0, 1, 2):
        for growth_delta in (-2, -1, 0, 1, 2):
            wacc = assumptions.wacc + wacc_delta * assumptions.sensitivity_step
            growth = assumptions.terminal_growth + growth_delta * assumptions.sensitivity_step
            if wacc <= growth or wacc <= 0:
                value = None
            else:
                terminal = cash_flows[-1] * (1 + growth) / (wacc - growth)
                sensitivity_discount = sum(value / ((1 + wacc) ** (index + 1)) for index, value in enumerate(cash_flows))
                ev = sensitivity_discount + terminal / ((1 + wacc) ** assumptions.projection_years)
                value = (ev - assumptions.net_debt) / shares
            sensitivity.append(DcfSensitivityCell(wacc=wacc, terminal_growth=growth, per_share_value=value))
    as_of = _timeline_end_date(db, timeline_id, as_of_date)
    return DcfResponse(
        ticker=company.ticker,
        base_revenue=base_revenue,
        enterprise_value=enterprise,
        equity_value=equity,
        per_share_value=per_share,
        projected_free_cash_flows=cash_flows,
        assumptions=assumptions,
        sensitivity=sensitivity,
        provenance=ScreenerProvenance(
            source="IncomeStatement",
            source_ids=[str(statement.id)],
            formula="discounted unlevered FCF with Gordon-growth terminal value",
            calculation_version="dcf-v1",
            timeline_id=timeline_id,
            as_of_date=as_of,
            generated_at=datetime.now(timezone.utc),
        ),
    )


def correlation_matrix(db: Session, tickers: list[str], timeline_id: int, as_of_date: date | None, lookback: int = 60) -> CorrelationResponse:
    companies = db.query(Company).filter(Company.ticker.in_([ticker.upper() for ticker in tickers])).all()
    by_ticker = {company.ticker.upper(): company for company in companies}
    selected = [ticker.upper() for ticker in tickers if ticker.upper() in by_ticker]
    end_date = as_of_date
    if as_of_date is None:
        state = db.query(SimulationState).filter(SimulationState.timeline_id == timeline_id).first()
        end_date = state.current_sim_date if state else (db.query(func.max(PriceHistory.sim_date)).filter(PriceHistory.timeline_id == timeline_id).scalar() or date.today())
    cutoff = end_date - timedelta(days=max(lookback * 3, 90))
    rows = db.query(PriceHistory.company_id, PriceHistory.sim_date, PriceHistory.close).filter(
        PriceHistory.timeline_id == timeline_id,
        PriceHistory.company_id.in_([by_ticker[ticker].id for ticker in selected]),
        PriceHistory.sim_date <= end_date,
        PriceHistory.sim_date > cutoff,
    ).order_by(PriceHistory.sim_date.asc()).all()
    closes: dict[int, list[tuple[date, float]]] = {}
    for row in rows:
        value = _number(row.close)
        if value is not None:
            closes.setdefault(row.company_id, []).append((row.sim_date, value))
    returns: dict[str, dict[date, float]] = {}
    for ticker in selected:
        series = closes.get(by_ticker[ticker].id, [])
        returns[ticker] = {series[i][0]: series[i][1] / series[i - 1][1] - 1 for i in range(1, len(series)) if series[i - 1][1]}
    common_dates = sorted(set.intersection(*(set(series) for series in returns.values()))) if returns else []
    common_dates = common_dates[-lookback:]

    def pearson(left: list[float], right: list[float]) -> float | None:
        if len(left) < 2 or len(right) < 2:
            return None
        mean_left = sum(left) / len(left)
        mean_right = sum(right) / len(right)
        numerator = sum((a - mean_left) * (b - mean_right) for a, b in zip(left, right))
        denominator_left = math.sqrt(sum((a - mean_left) ** 2 for a in left))
        denominator_right = math.sqrt(sum((b - mean_right) ** 2 for b in right))
        return numerator / (denominator_left * denominator_right) if denominator_left and denominator_right else None

    matrix: list[list[float | None]] = []
    for left in selected:
        row_values: list[float | None] = []
        for right in selected:
            if left == right and common_dates:
                row_values.append(1.0)
            else:
                row_values.append(pearson([returns[left][day] for day in common_dates], [returns[right][day] for day in common_dates]))
        matrix.append(row_values)
    resolved_date = as_of_date or (common_dates[-1] if common_dates else end_date)
    return CorrelationResponse(
        tickers=selected,
        dates=common_dates,
        matrix=matrix,
        method="pearson daily close returns",
        lookback=lookback,
        provenance=ScreenerProvenance(source="PriceHistory", source_ids=selected, formula="Pearson correlation on aligned daily returns", calculation_version="correlation-v1", timeline_id=timeline_id, as_of_date=resolved_date, generated_at=datetime.now(timezone.utc)),
    )


def breadth_series(db: Session, timeline_id: int, as_of_date: date | None, lookback: int = 60) -> BreadthResponse:
    end = as_of_date
    if end is None:
        state = db.query(SimulationState).filter(SimulationState.timeline_id == timeline_id).first()
        end = state.current_sim_date if state else (db.query(func.max(PriceHistory.sim_date)).filter(PriceHistory.timeline_id == timeline_id).scalar() or date.today())
    cutoff = end - timedelta(days=max(lookback * 3, 90))
    rows = db.query(PriceHistory.company_id, PriceHistory.sim_date, PriceHistory.close).filter(
        PriceHistory.timeline_id == timeline_id, PriceHistory.sim_date <= end, PriceHistory.sim_date > cutoff
    ).order_by(PriceHistory.company_id, PriceHistory.sim_date.asc()).all()
    by_company: dict[int, list[tuple[date, float]]] = {}
    for row in rows:
        close = _number(row.close)
        if close is not None:
            by_company.setdefault(row.company_id, []).append((row.sim_date, close))
    dates = sorted({day for series in by_company.values() for day, _ in series})[-lookback:]
    points: list[BreadthPoint] = []
    for day in dates:
        advances = declines = unchanged = new_highs = new_lows = above_sma20 = 0
        total = 0
        for series in by_company.values():
            values = [close for item_day, close in series if item_day <= day]
            if not values:
                continue
            total += 1
            current = values[-1]
            previous = values[-2] if len(values) >= 2 else current
            if current > previous: advances += 1
            elif current < previous: declines += 1
            else: unchanged += 1
            trailing = values[-20:]
            if len(values) >= 20 and current >= max(values): new_highs += 1
            if len(values) >= 20 and current <= min(values): new_lows += 1
            if trailing and current >= sum(trailing) / len(trailing): above_sma20 += 1
        points.append(BreadthPoint(sim_date=day, advances=advances, declines=declines, unchanged=unchanged, new_highs=new_highs, new_lows=new_lows, above_sma20=above_sma20, total=total))
    resolved = points[-1].sim_date if points else end
    return BreadthResponse(points=points, timeline_id=timeline_id, as_of_date=resolved, provenance=ScreenerProvenance(source="PriceHistory", source_ids=[], formula="advance/decline, 20-session participation, and rolling new-high/low counts", calculation_version="breadth-v1", timeline_id=timeline_id, as_of_date=resolved, generated_at=datetime.now(timezone.utc)))


def _timeline_end_date(db: Session, timeline_id: int, as_of_date: date | None) -> date:
    if as_of_date is not None:
        return as_of_date
    state = db.query(SimulationState).filter(SimulationState.timeline_id == timeline_id).first()
    return state.current_sim_date if state else (db.query(func.max(PriceHistory.sim_date)).filter(PriceHistory.timeline_id == timeline_id).scalar() or date.today())


_NEWS_THEME_RULES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("earnings", "Earnings & guidance", ("earnings", "revenue", "profit", "eps", "guidance", "quarter")),
    ("product", "Product & demand", ("product", "launch", "demand", "customer", "contract", "pipeline")),
    ("macro", "Macro & rates", ("rate", "inflation", "fed", "macro", "economy", "currency")),
    ("capital", "Capital allocation", ("dividend", "buyback", "repurchase", "debt", "offering", "acquisition")),
    ("legal", "Legal & regulation", ("lawsuit", "regulator", "regulation", "investigation", "fine", "legal")),
    ("operations", "Operations & supply", ("supply", "factory", "production", "outage", "inventory", "capacity")),
)


def _news_theme(headline: str, body: str) -> tuple[str, str]:
    text = f"{headline} {body}".lower()
    for key, label, keywords in _NEWS_THEME_RULES:
        if any(keyword in text for keyword in keywords):
            return key, label
    return "other", "Other market intelligence"


def news_clusters(db: Session, ticker: str | None, timeline_id: int, as_of_date: date | None, limit: int = 500) -> ScreenerNewsClustersResponse:
    end = _timeline_end_date(db, timeline_id, as_of_date)
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first() if ticker else None
    query = db.query(NewsFeed).filter(NewsFeed.timeline_id == timeline_id, NewsFeed.sim_date <= end)
    if ticker and company is None:
        raise ValueError(f"Company '{ticker}' not found")
    if company is not None:
        query = query.filter(NewsFeed.company_id == company.id)
    rows = query.order_by(NewsFeed.sim_date.desc(), NewsFeed.id.desc()).limit(max(1, min(limit, 2000))).all()
    groups: dict[str, dict[str, Any]] = {}
    for row in rows:
        theme, label = _news_theme(row.headline, row.body)
        group = groups.setdefault(theme, {"label": label, "rows": []})
        group["rows"].append(row)
    clusters: list[ScreenerNewsCluster] = []
    for theme, group in groups.items():
        group_rows = group["rows"]
        sentiments: dict[str, int] = {}
        for row in group_rows:
            sentiment = (row.sentiment or "unknown").lower()
            sentiments[sentiment] = sentiments.get(sentiment, 0) + 1
        clusters.append(ScreenerNewsCluster(
            theme=theme,
            label=group["label"],
            count=len(group_rows),
            average_severity=(sum(float(row.severity) for row in group_rows) / len(group_rows)) if group_rows else None,
            sentiment_counts=sentiments,
            first_date=min(row.sim_date for row in group_rows),
            last_date=max(row.sim_date for row in group_rows),
            sample_headlines=[row.headline for row in group_rows[:3]],
            source_ids=[str(row.id) for row in group_rows],
        ))
    clusters.sort(key=lambda item: (item.count, item.average_severity or 0), reverse=True)
    return ScreenerNewsClustersResponse(
        clusters=clusters,
        timeline_id=timeline_id,
        as_of_date=end,
        provenance=ScreenerProvenance(
            source="NewsFeed",
            source_ids=[str(row.id) for row in rows],
            formula="deterministic keyword theme clustering with sentiment counts and mean severity",
            calculation_version="news-cluster-v1",
            timeline_id=timeline_id,
            as_of_date=end,
            generated_at=datetime.now(timezone.utc),
        ),
    )


def transcript_search(
    db: Session,
    ticker: str,
    search: str,
    timeline_id: int,
    as_of_date: date | None,
    limit: int = 50,
) -> ScreenerTranscriptSearchResponse:
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if company is None:
        raise ValueError(f"Company '{ticker}' not found")
    query_text = search.strip()
    if not query_text:
        raise ValueError("Transcript search requires a non-empty query")
    end = _timeline_end_date(db, timeline_id, as_of_date)
    tokens = [token.lower() for token in query_text.split() if token.strip()]
    calls = (
        db.query(ConCall)
        .filter(ConCall.company_id == company.id, ConCall.call_date <= end)
        .order_by(ConCall.call_date.desc(), ConCall.id.desc())
        .limit(100)
        .all()
    )

    def snippet(text: str, term: str) -> str:
        clean = " ".join(text.split())
        index = clean.lower().find(term)
        if index < 0:
            return clean[:280]
        start = max(0, index - 100)
        end_index = min(len(clean), index + len(term) + 180)
        prefix = "…" if start else ""
        suffix = "…" if end_index < len(clean) else ""
        return f"{prefix}{clean[start:end_index]}{suffix}"

    matches: list[ScreenerTranscriptMatch] = []
    for call in calls:
        sections: list[tuple[str, str]] = [(str(key), str(value)) for key, value in (call.statements or {}).items()]
        for index, item in enumerate(call.qa_transcript or []):
            sections.append((f"Q&A {index + 1}", f"{item.get('question', '')} {item.get('answer', '')}"))
        full_text = " ".join(text for _, text in sections).lower()
        matched_terms = [token for token in tokens if token in full_text]
        if not matched_terms:
            continue
        for section, text in sections:
            section_terms = [token for token in tokens if token in text.lower()]
            if not section_terms:
                continue
            matches.append(ScreenerTranscriptMatch(
                call_id=call.id,
                fiscal_period=call.fiscal_period,
                call_date=call.call_date,
                tone=call.tone,
                tone_score=float(call.tone_score),
                section=section,
                snippet=snippet(text, section_terms[0]),
                matched_terms=section_terms,
                source_ids=[str(call.id)],
            ))
            if len(matches) >= limit:
                break
        if len(matches) >= limit:
            break

    return ScreenerTranscriptSearchResponse(
        ticker=company.ticker,
        query=query_text,
        matches=matches,
        timeline_id=timeline_id,
        as_of_date=end,
        provenance=ScreenerProvenance(
            source="ConCall",
            source_ids=sorted({source_id for match in matches for source_id in match.source_ids}),
            formula="case-insensitive token search across structured statements and Q&A transcript sections",
            calculation_version="transcript-search-v1",
            timeline_id=timeline_id,
            as_of_date=end,
            generated_at=datetime.now(timezone.utc),
        ),
    )


def event_impacts(db: Session, ticker: str, timeline_id: int, as_of_date: date | None, limit: int = 100) -> ScreenerEventImpactResponse:
    company = db.query(Company).filter(Company.ticker == ticker.upper()).first()
    if company is None:
        raise ValueError(f"Company '{ticker}' not found")
    end = _timeline_end_date(db, timeline_id, as_of_date)
    instances = (
        db.query(EventInstance, MarketEvent)
        .join(MarketEvent, MarketEvent.id == EventInstance.event_id)
        .filter(
            EventInstance.timeline_id == timeline_id,
            EventInstance.scope_type == "company",
            EventInstance.scope_ref == company.id,
            EventInstance.sim_date <= end,
        )
        .order_by(EventInstance.sim_date.desc(), EventInstance.id.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    price_rows = (
        db.query(PriceHistory.sim_date, PriceHistory.close)
        .filter(PriceHistory.timeline_id == timeline_id, PriceHistory.company_id == company.id, PriceHistory.sim_date <= end)
        .order_by(PriceHistory.sim_date.asc())
        .all()
    )
    prices = [(row.sim_date, _number(row.close)) for row in price_rows if _number(row.close) is not None]
    impacts: list[ScreenerEventImpact] = []
    for instance, event in instances:
        anchor = next((index for index, (day, _) in enumerate(prices) if day >= instance.sim_date), None)
        base = prices[anchor][1] if anchor is not None else None
        def forward_return(offset: int) -> float | None:
            if anchor is None or base in (None, 0) or anchor + offset >= len(prices):
                return None
            return (prices[anchor + offset][1] / base - 1.0) * 100.0
        source_ids = [str(row[0]) for row in db.query(NewsFeed.id).filter(NewsFeed.source_event_instance_id == instance.id).all()]
        impacts.append(ScreenerEventImpact(
            event_instance_id=instance.id,
            event_id=event.id,
            name=event.name,
            category=event.category,
            sentiment=event.sentiment,
            sim_date=instance.sim_date,
            severity=float(instance.resolved_severity),
            return_1d_pct=forward_return(1),
            return_5d_pct=forward_return(5),
            return_20d_pct=forward_return(20),
            source_ids=source_ids,
        ))
    return ScreenerEventImpactResponse(
        ticker=company.ticker,
        events=impacts,
        timeline_id=timeline_id,
        as_of_date=end,
        provenance=ScreenerProvenance(
            source="EventInstance + PriceHistory",
            source_ids=[str(item.event_instance_id) for item in impacts],
            formula="forward close-to-close return from the first available session on or after each event date",
            calculation_version="event-impact-v1",
            timeline_id=timeline_id,
            as_of_date=end,
            generated_at=datetime.now(timezone.utc),
        ),
    )


def factor_exposure_map(db: Session, request: ScreenerExposureRequest, user: User | None = None) -> list[ScreenerExposurePoint]:
    query = validate_query(request.query.model_copy(update={"offset": 0, "page_size": 500}))
    contexts, as_of_date = _build_context(db, query)
    contexts = _apply_query_filters(contexts, query, _watchlist_company_ids(db, query, user))
    factors = [normalize_metric(factor) for factor in request.factors]
    unknown = [factor for factor in factors if factor not in METRIC_BY_KEY or METRIC_BY_KEY[factor]["category"] != "factor"]
    if unknown:
        raise ValueError(f"Unknown factor exposure metrics: {', '.join(unknown)}")
    points: list[ScreenerExposurePoint] = []
    for item in contexts:
        points.append(ScreenerExposurePoint(
            ticker=item["company"].ticker,
            name=item["company"].name,
            industry_name=item["company"].industry_name,
            exposures={factor: _number(item["values"].get(factor)) for factor in factors},
            provenance={factor: _provenance(factor, query, as_of_date, "No observation for this company/date" if item["values"].get(factor) is None else None) for factor in factors},
        ))
    return points


ALLOWED_FORMULA_NODES = (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.USub, ast.UAdd, ast.Name, ast.Load, ast.Constant, ast.Mod)


def _evaluate_formula(expression: str, values: dict[str, Any]) -> float | None:
    tree = ast.parse(expression, mode="eval")
    if any(not isinstance(node, ALLOWED_FORMULA_NODES) for node in ast.walk(tree)):
        raise ValueError("Formula contains a disallowed operation")

    def visit(node: ast.AST) -> float:
        if isinstance(node, ast.Expression): return visit(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)): return float(node.value)
        if isinstance(node, ast.Name):
            value = _number(values.get(node.id))
            if value is None: raise ValueError(f"Missing metric '{node.id}'")
            return value
        if isinstance(node, ast.UnaryOp):
            value = visit(node.operand)
            return -value if isinstance(node.op, ast.USub) else value
        if isinstance(node, ast.BinOp):
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add): return left + right
            if isinstance(node.op, ast.Sub): return left - right
            if isinstance(node.op, ast.Mult): return left * right
            if isinstance(node.op, ast.Div): return left / right if right else math.nan
            if isinstance(node.op, ast.Pow): return left ** min(right, 8)
            if isinstance(node.op, ast.Mod): return left % right if right else math.nan
        raise ValueError("Formula contains an unsupported expression")

    value = visit(tree)
    return value if math.isfinite(value) else None


def evaluate_formula(db: Session, request: Any, user: User | None = None) -> FormulaEvaluateResponse:
    response = query_screener(db, request.query, user)
    values: list[FormulaValue] = []
    for row in response.rows:
        try:
            value = _evaluate_formula(request.formula, row.metrics)
            values.append(FormulaValue(ticker=row.company.ticker, value=value, missing_reason=None if value is not None else "Formula returned a non-finite value"))
        except (SyntaxError, ValueError, ZeroDivisionError) as exc:
            values.append(FormulaValue(ticker=row.company.ticker, missing_reason=str(exc)))
    return FormulaEvaluateResponse(formula=request.formula, values=values, provenance=ScreenerProvenance(source="ScreenerQueryResponse", source_ids=[response.query_fingerprint], formula=request.formula, calculation_version="formula-v1-safe-ast", timeline_id=response.timeline_id, as_of_date=response.as_of_date, generated_at=datetime.now(timezone.utc)))
