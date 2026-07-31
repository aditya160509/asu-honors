"""Persisted, cross-market analytics for a completed Future Lab timeline."""

from __future__ import annotations

import math
from collections import defaultdict
from statistics import mean, stdev

from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from db.models import Company, Industry, PriceDriverScore, PriceHistory, Timeline


def _drawdown(values: list[float]) -> float | None:
    if not values:
        return None
    peak = values[0]
    worst = 0.0
    for value in values:
        peak = max(peak, value)
        if peak > 0:
            worst = min(worst, value / peak - 1.0)
    return worst


def build_timeline_analytics(db: Session, timeline_id: int, compare_id: int | None = None) -> dict:
    timeline = db.query(Timeline).filter_by(id=timeline_id).first()
    if timeline is None:
        raise NotFoundError(f"Timeline {timeline_id} not found")
    companies = {c.id: c for c in db.query(Company).all()}
    industries = {i.id: i.name for i in db.query(Industry).all()}
    rows = db.query(PriceHistory).filter_by(timeline_id=timeline_id).order_by(
        PriceHistory.sim_date, PriceHistory.company_id,
    ).all()

    by_company: dict[int, list[PriceHistory]] = defaultdict(list)
    by_date: dict[str, list[PriceHistory]] = defaultdict(list)
    for row in rows:
        by_company[row.company_id].append(row)
        by_date[str(row.sim_date)].append(row)

    company_returns = []
    sector_returns: dict[str, list[float]] = defaultdict(list)
    breadth = {"advancers": 0, "decliners": 0, "unchanged": 0}
    for company_id, history in by_company.items():
        if not history:
            continue
        first, last = history[0], history[-1]
        total_return = float(last.close) / float(first.close) - 1.0 if float(first.close) else 0.0
        company = companies.get(company_id)
        item = {
            "company_id": company_id,
            "ticker": company.ticker if company else str(company_id),
            "name": company.name if company else str(company_id),
            "sector": industries.get(company.industry_id, "Unclassified") if company else "Unclassified",
            "return_pct": total_return * 100.0,
            "final_close": float(last.close),
            "final_intrinsic_value": float(last.intrinsic_value),
        }
        company_returns.append(item)
        sector_returns[item["sector"]].append(total_return * 100.0)
        if len(history) > 1:
            change = float(last.close) - float(history[-2].close)
            breadth["advancers" if change > 0 else "decliners" if change < 0 else "unchanged"] += 1

    market_path = []
    for sim_date, day_rows in sorted(by_date.items()):
        market_path.append({
            "sim_date": sim_date,
            "price": mean(float(r.close) for r in day_rows),
            "intrinsic_value": mean(float(r.intrinsic_value) for r in day_rows),
            "volume": sum(int(r.volume) for r in day_rows),
            "order_imbalance": mean(float(r.order_imbalance) for r in day_rows),
        })
    prices = [p["price"] for p in market_path]
    returns = [prices[i] / prices[i - 1] - 1.0 for i in range(1, len(prices)) if prices[i - 1]]
    volatility = stdev(returns) * math.sqrt(252) if len(returns) > 1 else None

    latest_driver_date = db.query(PriceDriverScore.sim_date).filter_by(timeline_id=timeline_id).order_by(
        PriceDriverScore.sim_date.desc(),
    ).first()
    contributions: dict[str, list[float]] = defaultdict(list)
    if latest_driver_date:
        for row in db.query(PriceDriverScore).filter_by(
            timeline_id=timeline_id, sim_date=latest_driver_date[0],
        ).all():
            contributions[row.driver_key].append(float(row.contribution))
    contribution_means = {key: mean(values) for key, values in contributions.items()}
    total_abs = sum(abs(value) for value in contribution_means.values())
    risk = sorted(({
        "driver_key": key,
        "contribution": value,
        "share_pct": abs(value) / total_abs * 100.0 if total_abs else 0.0,
    } for key, value in contribution_means.items()), key=lambda item: item["share_pct"], reverse=True)

    comparison = None
    if compare_id is not None and compare_id != timeline_id:
        compare_rows = db.query(PriceHistory).filter_by(timeline_id=compare_id).order_by(PriceHistory.sim_date).all()
        latest_by_company: dict[int, PriceHistory] = {}
        for row in compare_rows:
            latest_by_company[row.company_id] = row
        deltas = []
        for company_id, history in by_company.items():
            if history and company_id in latest_by_company:
                deltas.append(float(history[-1].close) / float(latest_by_company[company_id].close) - 1.0)
        comparison = {
            "timeline_id": compare_id,
            "mean_price_delta_pct": mean(deltas) * 100.0 if deltas else None,
            "companies_compared": len(deltas),
        }

    company_returns.sort(key=lambda item: item["return_pct"], reverse=True)
    sectors = sorted(({
        "sector": sector,
        "return_pct": mean(values),
        "company_count": len(values),
    } for sector, values in sector_returns.items()), key=lambda item: item["return_pct"], reverse=True)
    return {
        "timeline_id": timeline_id,
        "market_path": market_path,
        "breadth": breadth,
        "sector_performance": sectors,
        "best_companies": company_returns[:10],
        "worst_companies": list(reversed(company_returns[-10:])),
        "annualized_volatility_pct": volatility * 100.0 if volatility is not None else None,
        "max_drawdown_pct": (_drawdown(prices) or 0.0) * 100.0 if prices else None,
        "volume_change_pct": ((market_path[-1]["volume"] / market_path[0]["volume"] - 1.0) * 100.0) if len(market_path) > 1 and market_path[0]["volume"] else None,
        "liquidity_change": (market_path[-1]["order_imbalance"] - market_path[0]["order_imbalance"]) if len(market_path) > 1 else None,
        "risk_decomposition": risk,
        "comparison": comparison,
    }
