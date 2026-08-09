"""Invariants for deterministic market-realism primitives."""

from datetime import date, datetime, timezone

import pytest

from engine.realism import (
    CorporateAction,
    CorporateActionType,
    EconomicEventType,
    HaltReason,
    MarketRegime,
    SessionPhase,
    FundamentalState,
    apply_corporate_action,
    build_order_book,
    classify_regime,
    economic_event_impact,
    execute_market_order,
    evolve_fundamentals,
    generate_flows,
    get_preset,
    generate_market_shock,
    realism_news,
    replay_fingerprint,
    session_phase_at,
    session_timestamp,
    slippage_bps,
    stable_seed,
)


def test_stable_seed_and_fingerprint_are_process_independent_contracts():
    assert stable_seed(42, 1, 2, "flows") == stable_seed(42, 1, 2, "flows")
    assert stable_seed(42, 1, 2, "flows") != stable_seed(42, 1, 2, "news")
    payload = {"price": 100.0, "tick": 3, "nested": {"b": 2, "a": 1}}
    assert replay_fingerprint(payload) == replay_fingerprint({"nested": {"a": 1, "b": 2}, "tick": 3, "price": 100.0})


def test_session_clock_covers_pre_market_auctions_open_after_hours_and_closed():
    tz = timezone.utc
    assert session_phase_at(datetime(2026, 1, 5, 12, 0, tzinfo=tz)) == SessionPhase.PRE_MARKET
    assert session_phase_at(datetime(2026, 1, 5, 14, 27, tzinfo=tz)) == SessionPhase.OPEN_AUCTION
    assert session_phase_at(datetime(2026, 1, 5, 15, 0, tzinfo=tz)) == SessionPhase.OPEN
    assert session_phase_at(datetime(2026, 1, 5, 23, 58, tzinfo=tz)) == SessionPhase.AFTER_HOURS
    assert session_phase_at(datetime(2026, 1, 5, 22, 0, tzinfo=tz)) == SessionPhase.AFTER_HOURS
    assert session_phase_at(datetime(2026, 1, 5, 1, 0, tzinfo=tz)) == SessionPhase.CLOSED
    assert session_phase_at(datetime(2026, 1, 4, 15, 0, tzinfo=tz)) == SessionPhase.CLOSED


def test_session_timestamp_is_monotonic_and_inside_open_window():
    preset = get_preset("realistic")
    first = session_timestamp(date(2026, 1, 5), 0, preset)
    last = session_timestamp(date(2026, 1, 5), preset.micro_ticks_per_session - 1, preset)
    assert first < last
    assert first.hour == 9
    assert last.hour == 15


def test_unknown_preset_is_rejected():
    with pytest.raises(ValueError, match="Unknown realism preset"):
        get_preset("typo")


def test_regime_classifier_distinguishes_bull_bear_high_vol_and_crisis():
    assert classify_regime([0.01, 0.02, 0.015], breadth=0.6, liquidity_index=0.9).regime == MarketRegime.BULL
    assert classify_regime([-0.01, -0.02, -0.015], breadth=-0.6, liquidity_index=0.9).regime == MarketRegime.BEAR
    assert classify_regime([0.08, -0.08, 0.07, -0.07], breadth=0.0, liquidity_index=0.9).regime == MarketRegime.HIGH_VOLATILITY
    assert classify_regime([-0.06, -0.05, -0.04], breadth=-0.8, liquidity_index=0.1, drawdown=-0.25).regime == MarketRegime.CRISIS


def test_order_book_is_reproducible_and_imbalance_changes_depth():
    book_a = build_order_book(100.0, 1_000_000, 0.02, 80, 42, order_imbalance=0.6)
    book_b = build_order_book(100.0, 1_000_000, 0.02, 80, 42, order_imbalance=0.6)
    book_c = build_order_book(100.0, 1_000_000, 0.02, 80, 42, order_imbalance=-0.6)
    assert book_a == book_b
    assert book_a.ask_price > book_a.bid_price
    assert book_a.total_ask_depth > book_c.total_ask_depth
    assert len(book_a.bids) == 5
    assert len(book_a.asks) == 5


def test_order_book_market_order_can_fill_partially_and_reports_slippage():
    book = build_order_book(100.0, 10_000, 0.04, 20, 9)
    result = execute_market_order(book, "buy", 10_000_000)
    assert result.status == "partially_filled"
    assert result.filled_quantity > 0
    assert result.remaining_quantity > 0
    assert result.average_price is not None
    assert result.slippage_bps > 0


def test_limit_order_respects_price_and_closed_market_rejects():
    book = build_order_book(100.0, 1_000_000, 0.02, 80, 7)
    too_low = execute_market_order(book, "buy", 10, limit_price=book.bid_price - 1.0)
    assert too_low.status == "open"
    closed = build_order_book(100.0, 1_000_000, 0.02, 80, 7, session_phase=SessionPhase.CLOSED)
    assert execute_market_order(closed, "buy", 10).status == "rejected"


def test_size_based_slippage_increases_with_order_size_and_illiquidity():
    small = slippage_bps(100, 1_000_000, 0.02, 8, 90)
    large = slippage_bps(100_000, 1_000_000, 0.02, 8, 90)
    illiquid = slippage_bps(100_000, 1_000_000, 0.02, 8, 10)
    assert large > small
    assert illiquid > large


def test_corporate_actions_adjust_price_shares_and_cash():
    dividend = apply_corporate_action(
        CorporateAction(CorporateActionType.DIVIDEND, cash_per_share=2.0), 100.0, 1_000, 50
    )
    assert dividend.price == 98.0
    assert dividend.cash_received == 100.0

    split = apply_corporate_action(CorporateAction(CorporateActionType.SPLIT, ratio=2.0), 100.0, 1_000, 50)
    assert split.price == 50.0
    assert split.shares_outstanding == 2_000.0
    assert split.holder_shares == 100.0

    delisted = apply_corporate_action(
        CorporateAction(CorporateActionType.DELISTING, settlement_price=3.0), 100.0, 1_000, 50
    )
    assert delisted.price == 3.0
    assert delisted.active is False


def test_economic_surprise_is_directional_by_event_type():
    rate = economic_event_impact(EconomicEventType.INTEREST_RATE, 6.0, 4.0)
    jobs = economic_event_impact(EconomicEventType.EMPLOYMENT, 110.0, 100.0)
    assert rate.rate_change > 0
    assert rate.market_return_shock < 0
    assert jobs.employment_change > 0
    assert jobs.market_return_shock > 0


def test_flow_fundamental_and_news_outputs_are_deterministic_and_bounded():
    flow_a = generate_flows(42, 1, 2, 3, MarketRegime.BULL, 0.4, 80)
    flow_b = generate_flows(42, 1, 2, 3, MarketRegime.BULL, 0.4, 80)
    assert flow_a == flow_b

    previous = FundamentalState(0.08, 0.20, 0.10, 1.2, 70.0)
    current = evolve_fundamentals(previous, 3.0, 4.0, 0.5, 0.2, 42)
    assert current == evolve_fundamentals(previous, 3.0, 4.0, 0.5, 0.2, 42)
    assert 0.0 <= current.quality_score <= 100.0
    assert realism_news("earnings", "Acme", None, "positive", 42.0, 42) == realism_news("earnings", "Acme", None, "positive", 42.0, 42)


def test_market_shock_generation_is_deterministic_and_crisis_sensitive():
    normal_a = generate_market_shock(42, 1, date(2026, 1, 2), 1, "crisis", MarketRegime.CRISIS)
    normal_b = generate_market_shock(42, 1, date(2026, 1, 2), 1, "crisis", MarketRegime.CRISIS)
    assert normal_a == normal_b
    assert normal_a.liquidity_multiplier <= 1.0
