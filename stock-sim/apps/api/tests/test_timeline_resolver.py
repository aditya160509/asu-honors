"""Tests for db/timeline_resolver.py — parent-chain read resolution.

Covers the core Future Lab correctness guarantee: a branch's reads for
dates before its own first tick fall back through its parent chain rather
than returning empty/wrong data, while never copying parent rows into the
child's own table (branch cost stays O(incremental rows), NFR8).
"""

from datetime import date

from db.models import EconomicCycleState, PriceHistory, Timeline
from db.timeline_resolver import (
    get_latest_intrinsic_values,
    get_latest_price,
    get_latest_prices,
    get_timeline_chain,
    resolve_latest_cycle_state,
    resolve_price_history_range,
)


def _mk_timeline(db, id_, name, rng_seed=1, parent_id=None, branch_point=None, is_live=False):
    t = Timeline(
        id=id_, name=name, rng_seed=rng_seed, is_live=is_live,
        parent_timeline_id=parent_id, branch_point_sim_date=branch_point,
    )
    db.add(t)
    db.commit()
    return t


def _mk_price(db, timeline_id, company_id, d, close, iv=None):
    db.add(PriceHistory(
        timeline_id=timeline_id, company_id=company_id, sim_date=d,
        open=close, high=close, low=close, close=close,
        volume=1000, intrinsic_value=iv if iv is not None else close,
        order_imbalance=0.0,
    ))
    db.commit()


def test_get_timeline_chain_single_root(test_db):
    _mk_timeline(test_db, 1, "Live", is_live=True)
    assert get_timeline_chain(test_db, 1) == [1]


def test_get_timeline_chain_grandchild(test_db):
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    _mk_timeline(test_db, 3, "Grandchild", parent_id=2, branch_point=date(2026, 1, 10))
    assert get_timeline_chain(test_db, 3) == [3, 2, 1]


def test_get_latest_price_falls_back_to_parent(test_db, test_industry, test_company_bare):
    """A freshly forked child with zero PriceHistory rows resolves its
    'current price' from the parent's most recent row."""
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 5), close=105.0)

    price = get_latest_price(test_db, test_company_bare.id, 2)
    assert price is not None
    assert float(price) == 105.0


def test_get_latest_price_prefers_own_row_over_parent(test_db, test_industry, test_company_bare):
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 5), close=105.0)
    _mk_price(test_db, 2, test_company_bare.id, date(2026, 1, 6), close=200.0)

    price = get_latest_price(test_db, test_company_bare.id, 2)
    assert float(price) == 200.0


def test_get_latest_prices_batch_mixed_fallback(test_db, test_industry, test_company_bare, test_company_2):
    """One company has its own row on the child, one has none -- batch
    resolver must fall back per-company, not all-or-nothing."""
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 5), close=100.0)
    _mk_price(test_db, 1, test_company_2.id, date(2026, 1, 5), close=50.0)
    _mk_price(test_db, 2, test_company_bare.id, date(2026, 1, 6), close=110.0)
    # test_company_2 never ticked on the child -- must fall back to parent.

    prices = get_latest_prices(test_db, [test_company_bare.id, test_company_2.id], 2)
    assert float(prices[test_company_bare.id]) == 110.0
    assert float(prices[test_company_2.id]) == 50.0


def test_get_latest_intrinsic_values_fallback(test_db, test_industry, test_company_bare):
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 5), close=100.0, iv=95.0)

    ivs = get_latest_intrinsic_values(test_db, [test_company_bare.id], 2)
    assert float(ivs[test_company_bare.id]) == 95.0


def test_resolve_price_history_range_merges_parent_and_child(test_db, test_industry, test_company_bare):
    """Dates before the branch point resolve from the parent; dates after
    (once the child has ticked) resolve from the child's own rows."""
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    for i, close in enumerate([100.0, 101.0, 102.0, 103.0, 104.0]):
        _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 1 + i), close)
    _mk_price(test_db, 2, test_company_bare.id, date(2026, 1, 6), close=999.0)

    rows = resolve_price_history_range(test_db, 2, test_company_bare.id)
    assert len(rows) == 6
    dates = [r.sim_date for r in rows]
    assert dates == sorted(dates)
    # Child's own row for 2026-01-06 wins; parent's earlier rows fill the rest.
    assert float(rows[-1].close) == 999.0
    assert float(rows[0].close) == 100.0


def test_resolve_price_history_range_child_row_wins_on_shared_date(test_db, test_industry, test_company_bare):
    """If both a timeline and its parent have a row for the same sim_date
    (e.g. re-simulated history), the nearer (child's own) row wins."""
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 5), close=100.0)
    _mk_price(test_db, 2, test_company_bare.id, date(2026, 1, 5), close=250.0)

    rows = resolve_price_history_range(test_db, 2, test_company_bare.id)
    assert len(rows) == 1
    assert float(rows[0].close) == 250.0


def test_resolve_price_history_range_respects_date_bounds(test_db, test_industry, test_company_bare):
    _mk_timeline(test_db, 1, "Live", is_live=True)
    for i, close in enumerate([100.0, 101.0, 102.0]):
        _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 1 + i), close)

    rows = resolve_price_history_range(
        test_db, 1, test_company_bare.id, from_date=date(2026, 1, 2), to_date=date(2026, 1, 2),
    )
    assert len(rows) == 1
    assert rows[0].sim_date == date(2026, 1, 2)


def test_resolve_latest_cycle_state_fresh_fork_inherits_parent_phase(test_db):
    """Regression test: a freshly forked child with no EconomicCycleState of
    its own must NOT default to 'expansion' if the parent was, say, in
    contraction at the branch point."""
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    test_db.add(EconomicCycleState(
        timeline_id=1, sim_date=date(2026, 1, 5), cycle_phase="contraction",
        market_factor_return=-0.001, gdp_growth=-1.5, interest_rate=3.0, market_sentiment=-0.3,
    ))
    test_db.commit()

    state = resolve_latest_cycle_state(test_db, 2)
    assert state is not None
    assert state.cycle_phase == "contraction"


def test_resolve_latest_cycle_state_prefers_own_row(test_db):
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    test_db.add(EconomicCycleState(
        timeline_id=1, sim_date=date(2026, 1, 5), cycle_phase="contraction",
        market_factor_return=-0.001, gdp_growth=-1.5, interest_rate=3.0, market_sentiment=-0.3,
    ))
    test_db.add(EconomicCycleState(
        timeline_id=2, sim_date=date(2026, 1, 6), cycle_phase="trough",
        market_factor_return=-0.0001, gdp_growth=0.5, interest_rate=2.0, market_sentiment=-0.5,
    ))
    test_db.commit()

    state = resolve_latest_cycle_state(test_db, 2)
    assert state.cycle_phase == "trough"


def test_resolve_never_writes_to_child_table(test_db, test_industry, test_company_bare):
    """Reading through the resolver must never insert rows into the child's
    own PriceHistory partition -- branch cost stays O(incremental rows)."""
    _mk_timeline(test_db, 1, "Live", is_live=True)
    _mk_timeline(test_db, 2, "Child", parent_id=1, branch_point=date(2026, 1, 5))
    _mk_price(test_db, 1, test_company_bare.id, date(2026, 1, 5), close=100.0)

    get_latest_price(test_db, test_company_bare.id, 2)
    resolve_price_history_range(test_db, 2, test_company_bare.id)

    child_rows = test_db.query(PriceHistory).filter_by(timeline_id=2).all()
    assert child_rows == []
