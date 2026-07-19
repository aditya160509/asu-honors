"""Future Lab (Section 11.7) — timeline-scoped reads that fall back through a
branch's parent chain instead of trusting the shared, timeline-agnostic
Company.current_price/intrinsic_value/market_cap columns.

Company.current_price et al. are denormalized "latest tick" caches, and
engine.orchestrator writes them unconditionally for whichever timeline last
ticked (see _update_denormalized_fields) -- with more than one timeline
advancing independently (Future Lab branches), those columns stop meaning
"the live price" and instead mean "whatever timeline happened to tick most
recently," corrupting price display and trade execution for every other
timeline. Every read that needs "the current price for THIS timeline" must
go through get_latest_price/get_latest_two_closes here instead of reading
company.current_price directly.

Phase 2 (fork/branch service) extends this module with the full parent-chain
walk for arbitrary date-range PriceHistory queries; the functions below only
resolve "latest price as of now for a single timeline," which is already
correct even for a freshly-forked child with zero of its own rows yet (falls
straight through to the parent).
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from db.models import EconomicCycleState, PriceHistory, Timeline


def get_timeline_chain(session: Session, timeline_id: int) -> list[int]:
    """[timeline_id, parent_id, grandparent_id, ...] up to the root.

    Walks Timeline.parent_timeline_id. Bounded defensively at 100 hops --
    the parent chain is meant to be a simple tree with no cycles, but a
    corrupt/manually-edited row forming a cycle must not hang the caller.
    """
    chain = [timeline_id]
    current_id: Optional[int] = timeline_id
    seen = {timeline_id}
    for _ in range(100):
        timeline = session.query(Timeline).filter_by(id=current_id).first()
        if timeline is None or timeline.parent_timeline_id is None:
            break
        parent_id = timeline.parent_timeline_id
        if parent_id in seen:
            break
        chain.append(parent_id)
        seen.add(parent_id)
        current_id = parent_id
    return chain


def get_latest_price(session: Session, company_id: int, timeline_id: int) -> Optional[Decimal]:
    """Most recent PriceHistory.close for (company_id, timeline_id), falling
    back through the parent chain if this timeline has no rows of its own
    yet (e.g. a just-forked child that hasn't ticked). Never copies parent
    rows into the child -- purely a read-time fallback."""
    for tid in get_timeline_chain(session, timeline_id):
        row = (
            session.query(PriceHistory.close)
            .filter_by(company_id=company_id, timeline_id=tid)
            .order_by(PriceHistory.sim_date.desc())
            .first()
        )
        if row is not None:
            return row[0]
    return None


def get_latest_prices(session: Session, company_ids: list[int], timeline_id: int) -> dict[int, Decimal]:
    """Batch form of get_latest_price for a set of companies on one timeline.

    Walks the parent chain once, filling in only the companies still missing
    a price after each level, so a mostly-populated child timeline doesn't
    re-query the whole company set against every ancestor.
    """
    return _latest_column_batch(session, company_ids, timeline_id, PriceHistory.close)


def get_latest_intrinsic_values(session: Session, company_ids: list[int], timeline_id: int) -> dict[int, Decimal]:
    """Batch, timeline-scoped intrinsic_value lookup, same fallback semantics
    as get_latest_prices.

    PriceHistory.intrinsic_value is written every tick (_write_tick_results)
    and is already timeline-scoped, unlike Company.intrinsic_value (a single
    shared cache mutated in place by IV drift every tick regardless of which
    timeline is advancing -- see orchestrator.py's IV-drift block and
    _refresh_fundamentals). Reading through here instead of
    company.intrinsic_value is required for any non-live timeline's tick to
    compute its own correct IV drift rather than drifting off whatever IV
    the live (or another branch's) timeline last left in the shared row.
    """
    return _latest_column_batch(session, company_ids, timeline_id, PriceHistory.intrinsic_value)


def _latest_column_batch(
    session: Session, company_ids: list[int], timeline_id: int, column,
) -> dict[int, Decimal]:
    if not company_ids:
        return {}
    remaining = set(company_ids)
    result: dict[int, Decimal] = {}
    for tid in get_timeline_chain(session, timeline_id):
        if not remaining:
            break
        rows = (
            session.query(PriceHistory.company_id, column, PriceHistory.sim_date)
            .filter(PriceHistory.timeline_id == tid, PriceHistory.company_id.in_(remaining))
            .order_by(PriceHistory.company_id.asc(), PriceHistory.sim_date.desc())
            .all()
        )
        seen_this_level: set[int] = set()
        for company_id, value, _sim_date in rows:
            if company_id in seen_this_level or value is None:
                continue
            seen_this_level.add(company_id)
            result[company_id] = value
        remaining -= seen_this_level
    return result


def resolve_price_history_range(
    session: Session,
    timeline_id: int,
    company_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
) -> list[PriceHistory]:
    """PriceHistory rows for `company_id` covering [from_date, to_date] as
    seen from `timeline_id`, resolved across the parent chain.

    Section 11.7's read path: for each date in the requested range, prefer
    this timeline's own row if one exists; otherwise fall back to the
    nearest ancestor's row for that date. A branch's own rows only exist for
    sim_dates from its branch_point_sim_date forward (whatever it has
    actually ticked), so any date before that resolves entirely from the
    parent chain. Never copies parent rows into the child's own table --
    this is a read-time UNION, keeping branch creation and per-tick writes
    O(incremental rows only) (NFR8).

    Returns rows sorted ascending by sim_date, de-duplicated by sim_date
    (this timeline's own row wins over an ancestor's row for the same date).
    """
    chain = get_timeline_chain(session, timeline_id)
    by_date: dict[date, PriceHistory] = {}
    # Walk the chain root-to-self is not needed -- iterate self-to-root and
    # only fill in dates not already claimed by a nearer (more specific)
    # timeline, so the nearest timeline's row always wins for a given date.
    for tid in chain:
        query = session.query(PriceHistory).filter(
            PriceHistory.timeline_id == tid, PriceHistory.company_id == company_id,
        )
        if from_date is not None:
            query = query.filter(PriceHistory.sim_date >= from_date)
        if to_date is not None:
            query = query.filter(PriceHistory.sim_date <= to_date)
        for row in query.all():
            if row.sim_date not in by_date:
                by_date[row.sim_date] = row
    return [by_date[d] for d in sorted(by_date.keys())]


def resolve_latest_cycle_state(
    session: Session, timeline_id: int, before_date: Optional[date] = None,
) -> Optional[EconomicCycleState]:
    """Chain-aware latest EconomicCycleState lookup.

    Fixes the fresh-fork cold-start bug: engine.orchestrator._load_tick_state
    previously queried EconomicCycleState scoped only to `timeline_id`, so a
    just-forked child timeline (with no cycle history of its own yet) always
    saw prev_phase default to "expansion" on its first tick, regardless of
    what phase the parent was actually in at the branch point. Walking the
    parent chain here means a fresh child correctly inherits the parent's
    real cycle phase as of the branch point.
    """
    for tid in get_timeline_chain(session, timeline_id):
        query = session.query(EconomicCycleState).filter_by(timeline_id=tid)
        if before_date is not None:
            query = query.filter(EconomicCycleState.sim_date <= before_date)
        row = query.order_by(EconomicCycleState.sim_date.desc()).first()
        if row is not None:
            return row
    return None
