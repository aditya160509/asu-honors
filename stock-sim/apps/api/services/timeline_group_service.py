"""Future Lab (Section 11.3/11.5) — timeline_groups: sweep/ensemble
aggregation. GET /sim/timeline-groups/{id} and .../distribution.

The percentile/histogram reduction here is intentionally minimal (pure
Python, no numpy) since it only needs to run once per API request over
however many member timelines a group has -- engine/ensemble.py (Phase 4/5)
owns the actual N-seeded-run fan-out and can reuse reduce_to_percentiles/
reduce_to_histogram below rather than duplicating the math.
"""

from typing import Optional

from sqlalchemy.orm import Session

from apps.api.exceptions import NotFoundError
from db.models import Portfolio, Timeline, TimelineGroup


def get_group(db: Session, group_id: int) -> TimelineGroup:
    group = db.query(TimelineGroup).filter_by(id=group_id).first()
    if group is None:
        raise NotFoundError(f"TimelineGroup {group_id} not found")
    return group


def get_member_timelines(db: Session, group_id: int) -> list[Timeline]:
    return db.query(Timeline).filter_by(timeline_group_id=group_id).order_by(Timeline.id).all()


def reduce_to_percentiles(values: list[float], percentiles: Optional[list[int]] = None) -> dict[str, float]:
    if not values:
        return {}
    percentiles = percentiles or [5, 25, 50, 75, 95]
    ordered = sorted(values)
    n = len(ordered)
    result = {}
    for p in percentiles:
        idx = min(n - 1, max(0, round((p / 100.0) * (n - 1))))
        result[str(p)] = ordered[idx]
    return result


def reduce_to_histogram(values: list[float], bins: int = 20) -> tuple[list[float], list[int]]:
    if not values:
        return [], []
    lo, hi = min(values), max(values)
    if lo == hi:
        return [lo, hi], [len(values)]
    width = (hi - lo) / bins
    edges = [lo + i * width for i in range(bins + 1)]
    counts = [0] * bins
    for v in values:
        idx = min(bins - 1, int((v - lo) / width))
        counts[idx] += 1
    return edges, counts


def compute_distribution(db: Session, group_id: int, metric: str) -> dict:
    """metric='portfolio_return' is the only metric implemented for v1
    (reads each member timeline's live Portfolio.total_value, if any exist
    for that timeline) -- other metrics (single-stock price, drawdown, etc.)
    are a frontend/Phase 7 concern layered on top of this same reduction.
    """
    get_group(db, group_id)  # 404s if missing
    members = get_member_timelines(db, group_id)

    values: list[float] = []
    if metric == "portfolio_return":
        for member in members:
            portfolios = db.query(Portfolio).filter_by(timeline_id=member.id).all()
            for pf in portfolios:
                if pf.total_value is not None:
                    values.append(float(pf.total_value))

    count = len(values)
    mean = sum(values) / count if count else None
    percentiles = reduce_to_percentiles(values)
    median = percentiles.get("50")
    bins, counts = reduce_to_histogram(values)

    return {
        "metric": metric,
        "count": count,
        "mean": mean,
        "median": median,
        "percentiles": percentiles,
        "histogram_bins": bins,
        "histogram_counts": counts,
    }
