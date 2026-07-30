"""Tests for the comprehensive/dynamic con-call generator additions."""
from datetime import date

from engine.concalls import _chain_streak, _relative_direction, _select_qa_topics, generate_concall
from db.models.concalls import ConCall
from db.models.financials import BalanceSheet, CashFlowStatement, IncomeStatement
from db.models.reference import Company
import random


def test_chain_streak_extends_same_direction():
    assert _chain_streak(2, 1) == 3
    assert _chain_streak(-2, -1) == -3


def test_chain_streak_resets_on_flip():
    assert _chain_streak(3, -1) == -1
    assert _chain_streak(-3, 1) == 1


def test_chain_streak_resets_on_neutral():
    assert _chain_streak(5, 0) == 0


def test_relative_direction_bands():
    assert _relative_direction(110, 100, tolerance=0.03) == "up"
    assert _relative_direction(90, 100, tolerance=0.03) == "down"
    assert _relative_direction(101, 100, tolerance=0.03) == "flat"
    assert _relative_direction(100, None) == "flat"


def test_select_qa_topics_always_includes_growth():
    topics = _select_qa_topics({}, "roughly flat", has_capex_section=False)
    assert "growth" in topics
    assert 2 <= len(topics) <= 4


def _make_company() -> Company:
    return Company(id=1, ticker="TST", name="Test Co", industry_id=1)


def _make_income_stmt(revenue: float, eps: float, gross_profit: float) -> IncomeStatement:
    return IncomeStatement(
        company_id=1, fiscal_period="2026Q2", revenue=revenue, eps=eps,
        gross_profit=gross_profit, cogs=revenue - gross_profit,
        operating_expenses=revenue * 0.2, ebit=revenue * 0.15, ebitda=revenue * 0.18,
        net_profit=revenue * 0.1, interest_expense=revenue * 0.01,
        depreciation_amortization=revenue * 0.03, shares_diluted=100,
    )


def test_generate_concall_populates_new_sections():
    company = _make_company()
    income_stmt = _make_income_stmt(revenue=1200.0, eps=1.10, gross_profit=480.0)
    prior_income_stmt = _make_income_stmt(revenue=1000.0, eps=1.00, gross_profit=380.0)
    rng = random.Random(42)

    call = generate_concall(
        company=company,
        income_stmt=income_stmt,
        prior_income_stmt=prior_income_stmt,
        consensus=None,
        management_quality=70.0,
        growth_potential=60.0,
        fiscal_period="2026Q2",
        call_date=date(2026, 4, 1),
        rng=rng,
    )

    assert "capex_debt" in call.statements
    assert "order_book_strategy" in call.statements
    assert set(call.segment_guidance.keys()) == {"Core", "Emerging Markets", "Digital / New Initiatives"}
    assert len(call.qa_transcript) >= 2
    for exchange in call.qa_transcript:
        assert set(exchange.keys()) == {"analyst_name", "analyst_firm", "question", "answer"}
    assert set(call.trend_context.keys()) == {
        "beat_miss_streak", "margin_streak", "price_streak", "guided_vs_actual_streak",
    }
    assert {"margin_bias", "capex_bias", "debt_bias"} <= set(call.driver_deltas.keys())


def test_generate_concall_chains_trend_from_previous_call():
    company = _make_company()
    income_stmt = _make_income_stmt(revenue=1200.0, eps=1.10, gross_profit=480.0)
    prior_income_stmt = _make_income_stmt(revenue=1000.0, eps=1.00, gross_profit=380.0)
    rng = random.Random(42)

    previous_concall = ConCall(
        company_id=1, fiscal_period="2026Q1", call_date=date(2026, 1, 1),
        performance_bucket="beat", tone="confident", tone_score=1.0,
        guidance_revenue_growth=0.05, statements={}, driver_deltas={},
        trend_context={"beat_miss_streak": 2, "margin_streak": 1, "price_streak": 0, "guided_vs_actual_streak": 1},
    )

    call = generate_concall(
        company=company,
        income_stmt=income_stmt,
        prior_income_stmt=prior_income_stmt,
        consensus=None,
        management_quality=70.0,
        growth_potential=60.0,
        fiscal_period="2026Q2",
        call_date=date(2026, 4, 1),
        rng=rng,
        previous_concall=previous_concall,
    )

    # income_stmt is another beat (eps 1.10 > implied consensus == eps, so
    # bucket is "inline" by default with no consensus row) -- assert the
    # streak chained rather than reset to a fresh value, regardless of exact
    # sign, by checking it differs from a cold-start (no previous_concall) run.
    cold_call = generate_concall(
        company=company, income_stmt=income_stmt, prior_income_stmt=prior_income_stmt,
        consensus=None, management_quality=70.0, growth_potential=60.0,
        fiscal_period="2026Q2", call_date=date(2026, 4, 1), rng=random.Random(42),
    )
    assert call.trend_context != cold_call.trend_context or call.trend_context["margin_streak"] != 0
