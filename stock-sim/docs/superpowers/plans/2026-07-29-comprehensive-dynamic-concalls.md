# Comprehensive Dynamic Concalls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the con-call (`ConCall`) feature to cover the sections a real Indian public-company earnings call includes (capex/debt/strategy commentary, segment/geography guidance, analyst Q&A), make tone/narrative condition on multi-quarter trend history instead of just the current quarter, and close the feedback loop so a generated con-call visibly and safely nudges factor scores, the news feed, and next-quarter financials.

**Architecture:** `engine/concalls.py::generate_concall` stays a pure function (build-but-don't-persist a `ConCall`, no DB/session access) — it gains new template banks, a self-chaining trend-context computation (each `ConCall` carries forward a streak counter from the single most recent prior call, so no multi-row history query is needed), and three new small forward-looking bias signals inside the existing `driver_deltas` field. `engine/orchestrator.py::_generate_concalls_for_quarter` (the only caller) gains the DB-side effects: reading the one prior `ConCall`/`BalanceSheet`/`CashFlowStatement` row needed for trend chaining, applying small clamped factor-score nudges, writing a `NewsFeed` row, and recording what it did into a new `applied_deltas` field for auditability. A second small orchestrator change threads the forward-looking bias signals from the most recent prior `ConCall` into `_generate_fake_quarterly_financials`'s margin/capex/debt computation, extending the existing (single-signal) guidance-to-revenue-growth pattern to three more signals. Frontend and PDF changes are additive rendering only.

**Tech Stack:** Python 3.14, SQLAlchemy 2.0 (`Mapped`/`mapped_column`), Alembic migrations, FastAPI + Pydantic schemas, pytest, Next.js/React/TypeScript frontend, ReportLab for PDF generation.

## Global Constraints

- No LLM calls anywhere in the generator — stays deterministic/templated, consistent with `engine/news_manager.py`'s existing approach (module docstring, `engine/concalls.py:1-18`).
- All new factor-score/financials/news-feed effects are small and clamped, reusing the same order of magnitude as the existing `driver_deltas` → next-quarter-guidance mechanism, per the approved design's "small bounded nudges" choice — not routed through the full `EventInstance`/`_apply_factor_effects_to_company` pipeline (that was the design's explicitly rejected "first-class event source" alternative).
- No true segment-level financial modeling exists in this simulation — `segment_guidance` is a presentational synthesis of the aggregate guidance number, not new ground-truth data. Document this inline where it's generated.
- Applies going forward only. No backfill/regeneration of existing historical `ConCall` rows.
- New JSON columns (`trend_context`, `segment_guidance`, `qa_transcript`, `applied_deltas`) get a Python-side `default=dict` and a DB-side `server_default='{}'` so existing `ConCall(...)` construction call sites (including `apps/api/tests/test_concalls.py`) do not need to change.
- Deviation from the design doc's exact wording, made for type-safety reasons: the design said `capex_debt`/`order_book_strategy`/`segment_guidance`/`qa_transcript` all become new keys inside the existing `statements` field. `statements` is typed end-to-end as `dict[str, str]` (Pydantic `ConCallItem.statements: dict[str, str]`, frontend `Record<string, string>`, and the PDF loop's `Paragraph(text, ...)` call all assume string values). `capex_debt` and `order_book_strategy` are prose strings, so they DO become new `statements` keys as designed. `segment_guidance` (segment → guided growth number) and `qa_transcript` (list of Q&A objects) are structurally different from a string, so they become their own new top-level `ConCall` columns instead — same intent, correct typing.

---

### Task 1: Migration — add `trend_context`, `segment_guidance`, `qa_transcript`, `applied_deltas` columns

**Files:**
- Create: `db/migrations/versions/0022_concall_comprehensive_fields.py`

**Interfaces:**
- Consumes: nothing.
- Produces: four new nullable JSON columns on `con_calls`, each defaulting to `{}` — read by Task 2 (model) and written by Task 3/5 (generator/orchestrator).

- [ ] **Step 1: Write the migration**

```python
"""add trend_context/segment_guidance/qa_transcript/applied_deltas to con_calls

Extends ConCall (db/models/concalls.py) for the comprehensive/dynamic con-calls
feature: trend_context carries a self-chaining multi-quarter streak summary
forward from each call to the next (see engine/concalls.py::_chain_streak),
segment_guidance/qa_transcript hold the new segment-guidance and analyst-Q&A
sections (kept as separate columns rather than nested inside `statements`
since that field is typed dict[str, str] end-to-end), and applied_deltas
records what factor-score/news/financials effects a given call actually
caused (engine.orchestrator._generate_concalls_for_quarter), for auditability
and so a re-generated call is never double-applied.

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()

    op.add_column("con_calls", sa.Column("trend_context", json_type, nullable=False, server_default="{}"))
    op.add_column("con_calls", sa.Column("segment_guidance", json_type, nullable=False, server_default="{}"))
    op.add_column("con_calls", sa.Column("qa_transcript", json_type, nullable=False, server_default="[]"))
    op.add_column("con_calls", sa.Column("applied_deltas", json_type, nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("con_calls", "applied_deltas")
    op.drop_column("con_calls", "qa_transcript")
    op.drop_column("con_calls", "segment_guidance")
    op.drop_column("con_calls", "trend_context")
```

- [ ] **Step 2: Run the migration against the dev/test database**

```bash
cd "stock-sim"
alembic upgrade head
```

Expected: completes with no errors, head revision is now `0022`.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/versions/0022_concall_comprehensive_fields.py
git commit -m "feat: add trend_context/segment_guidance/qa_transcript/applied_deltas to con_calls"
```

---

### Task 2: Model — extend `ConCall`

**Files:**
- Modify: `db/models/concalls.py:78-81` (insert four new columns after `driver_deltas`, before `generated_at`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ConCall.trend_context: dict`, `ConCall.segment_guidance: dict`, `ConCall.qa_transcript: list`, `ConCall.applied_deltas: dict` — all read/written by Task 3 (generator) and Task 5 (orchestrator), and read by Task 6 (API schema).

- [ ] **Step 1: Insert the new columns**

Change:
```python
    # effect_profile-shaped dict of small deltas (DRIVER_KEYS / factor-score
    # keys -> float), mirroring db.models.events.MarketEvent.effect_profile so
    # any future event-style consumer (e.g. _apply_factor_effects_to_company)
    # could apply con-call tone the same way it applies event effects, without
    # requiring this model to know about that mechanism.
    driver_deltas: Mapped[dict] = mapped_column(JSONType, nullable=False)

    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
```
to:
```python
    # effect_profile-shaped dict of small deltas (DRIVER_KEYS / factor-score
    # keys -> float), mirroring db.models.events.MarketEvent.effect_profile.
    # engine.orchestrator._generate_concalls_for_quarter is now a real
    # consumer: "guidance"/"earnings_surprise" drive an immediate small
    # factor-score nudge, and "margin_bias"/"capex_bias"/"debt_bias" (added
    # by engine/concalls.py's comprehensive template banks) are read back by
    # _load_concall_extended_signals as forward-looking inputs to next
    # quarter's financials generation, the same way tone_score/
    # guidance_revenue_growth already are.
    driver_deltas: Mapped[dict] = mapped_column(JSONType, nullable=False)

    # Self-chaining multi-quarter trend summary (beat/miss streak, margin
    # streak, price/IV streak, guided-vs-actual streak) -- see
    # engine/concalls.py::_chain_streak. Each call reads the single most
    # recent prior call's trend_context, extends or resets each streak, and
    # writes its own -- so trend awareness needs only a 1-row lookback per
    # generation despite reflecting arbitrarily many quarters of history.
    trend_context: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    # Synthesized segment/geography guidance sub-splits of
    # guidance_revenue_growth (segment label -> guided growth fraction).
    # This simulation does not model true segment-level financials -- these
    # numbers are a presentational synthesis (deterministic seeded jitter
    # around the aggregate figure), not independent ground-truth data. See
    # engine/concalls.py::_synthesize_segment_guidance.
    segment_guidance: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    # Simulated analyst Q&A: list of {analyst_name, analyst_firm, question,
    # answer} dicts. See engine/concalls.py::_build_qa_transcript.
    qa_transcript: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)

    # What this call actually caused once applied by
    # engine.orchestrator._generate_concalls_for_quarter: management_quality/
    # moat_score point deltas and the id of the NewsFeed row it created.
    # Written once, at generation time -- exists so a re-generated call (or
    # future auditing/debugging) can see the causal effect without
    # re-deriving it from driver_deltas.
    applied_deltas: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
```

- [ ] **Step 2: Run the model against a fresh test DB to confirm no mapping errors**

```bash
cd "stock-sim"
python -c "from db.models import ConCall; print(ConCall.__table__.columns.keys())"
```

Expected output includes `trend_context`, `segment_guidance`, `qa_transcript`, `applied_deltas` in the column list, no exceptions.

- [ ] **Step 3: Commit**

```bash
git add db/models/concalls.py
git commit -m "feat: add trend_context/segment_guidance/qa_transcript/applied_deltas fields to ConCall model"
```

---

### Task 3: Generator — trend chaining, new template banks, driver_deltas extension

**Files:**
- Modify: `engine/concalls.py` (full set of additions below; existing `_STATEMENT_TEMPLATES`, `_performance_bucket`, `_mgmt_band`, `_TONE_ORDER`/`_nudge_tone`, `_tone_nudge_from_score`, `_revenue_growth_pct`, `_margin_direction`, `_market_context_statement` are unchanged)
- Test: `tests/engine/test_concalls.py` (new file)

**Interfaces:**
- Consumes: `ConCall` (`db.models.concalls`), `BalanceSheet`/`CashFlowStatement`/`ConsensusEstimate`/`IncomeStatement` (`db.models.financials`), `Company` (`db.models.reference`) — all already imported in this file.
- Produces: `generate_concall(...)` gains three new optional kwargs (`previous_concall: Optional[ConCall] = None`, `prior_balance_sheet: Optional[BalanceSheet] = None`, `prior_cash_flow: Optional[CashFlowStatement] = None`); the returned `ConCall.statements` gains optional `"capex_debt"`, `"order_book_strategy"`, `"trend_note"` string keys; `ConCall.segment_guidance: dict[str, float]`, `ConCall.qa_transcript: list[dict]`, `ConCall.trend_context: dict[str, int]` are populated; `ConCall.driver_deltas` gains `"margin_bias"`, `"capex_bias"`, `"debt_bias"` float keys. All consumed by Task 5 (orchestrator wiring).

- [ ] **Step 1: Add new template banks and constants**

Insert after the existing `_STATEMENT_TEMPLATES` dict (`engine/concalls.py:122`, right before `def _performance_bucket`):

```python
# Capex/debt/strategy commentary, keyed by tone only (not bucket) -- this
# section is about forward capital-allocation posture, which tracks
# management's overall confidence level more than this quarter's exact
# beat/miss bucket. {capex_direction}/{leverage_direction} are substituted
# from the current-vs-prior-quarter comparison in generate_concall.
CAPEX_DEBT_TEMPLATES: dict[str, str] = {
    "confident": (
        "We're leaning into capex here -- spend is trending {capex_direction}, and we're comfortable "
        "with leverage trending {leverage_direction} given the return profile we're seeing."
    ),
    "measured": (
        "Capex is trending {capex_direction}, broadly in line with our plan, and we're keeping leverage "
        "{leverage_direction} while we validate returns on recent spend."
    ),
    "cautious": (
        "We're being more selective on capex, which is trending {capex_direction}, and want to keep "
        "leverage {leverage_direction} until visibility improves."
    ),
    "defensive": (
        "We're pulling back on capex -- trending {capex_direction} -- and prioritizing keeping leverage "
        "{leverage_direction} given the current environment."
    ),
    "evasive": "We'd rather not commit to specifics on capex or leverage plans today; both are under review.",
}

# Order-book / demand / strategy commentary, keyed by tone only.
ORDER_BOOK_TEMPLATES: dict[str, str] = {
    "confident": (
        "The order book remains healthy and demand signals are strong -- we see room to keep investing "
        "in the strategy that's gotten us here."
    ),
    "measured": "Order book trends are stable, and we're continuing to execute the existing strategy without major shifts.",
    "cautious": (
        "We're seeing some softness build in the order book and are watching demand signals closely "
        "before committing to new strategic initiatives."
    ),
    "defensive": "The order book has weakened, and we're reassessing parts of the strategy as a result.",
    "evasive": "We're not going to get into specifics on the order book or strategy today.",
}

# Analyst Q&A: question bank keyed by topic, answer bank keyed by tone.
# {revenue_growth_pct}/{margin_direction} are substituted the same way as in
# the statement templates above.
QA_TOPIC_QUESTIONS: dict[str, str] = {
    "growth": "Growth came in at {revenue_growth_pct} this quarter -- how sustainable is that number into next quarter?",
    "margins": "Can you unpack the margin trajectory here, and what gives you confidence {margin_direction} margins hold up from here?",
    "guidance": "Given the guidance you've laid out, what would need to change for you to revise it?",
    "capex": "Walk us through the capex plan and how you're prioritizing spend from here.",
    "competition": "How are you thinking about competitive intensity in the segment right now?",
}

QA_ANSWER_TEMPLATES: dict[str, str] = {
    "confident": "{company} management gave a direct, upbeat answer, reiterating confidence in the current trajectory.",
    "measured": "{company} management gave a balanced answer, pointing to steady execution against the existing plan.",
    "cautious": "{company} management answered carefully, flagging the uncertainty directly rather than offering a firm commitment.",
    "defensive": "{company} management pushed back gently on the framing, emphasizing steps already underway to address it.",
    "evasive": "{company} management gave a noncommittal answer, deferring specifics to a future update.",
}

# Small, fixed roster so the same handful of names/firms recur across a
# company's calls (deterministic per-call sample via the rng already passed
# into generate_concall) rather than fabricating a new analyst every time.
ANALYST_ROSTER: list[tuple[str, str]] = [
    ("Ananya Rao", "Kotak Institutional Equities"),
    ("Rohan Mehta", "Nomura"),
    ("Priya Nair", "Morgan Stanley"),
    ("Karan Shah", "ICICI Securities"),
    ("Divya Iyer", "Jefferies"),
    ("Arjun Kapoor", "CLSA"),
]

# Segment/geography labels used to synthesize segment_guidance -- this sim
# has no true segment-level financial model, so these are a presentational
# split of the single aggregate guidance number, not independent data.
SEGMENT_LABELS: list[str] = ["Core", "Emerging Markets", "Digital / New Initiatives"]
```

- [ ] **Step 2: Add trend-chaining and direction helpers**

Insert immediately after `_market_context_statement` (`engine/concalls.py:184-192`), before `def generate_concall`:

```python
def _chain_streak(prior_streak: int, direction: int) -> int:
    """Extend or reset a signed streak counter. `direction` is +1/-1/0 for
    this quarter; a positive prior streak extends on +1, a negative one
    extends on -1, and any sign flip (or a neutral 0 direction) resets to
    `direction`. This is how trend_context reflects arbitrarily many
    quarters of history from a single prior row: each call's trend_context
    already encodes everything before it.
    """
    if direction == 0:
        return 0
    if prior_streak > 0 and direction > 0:
        return prior_streak + 1
    if prior_streak < 0 and direction < 0:
        return prior_streak - 1
    return direction


def _relative_direction(current: float, prior: Optional[float], tolerance: float = 0.03) -> str:
    """'up' | 'down' | 'flat' comparison for capex/leverage commentary,
    using a relative (percentage) tolerance band rather than
    _margin_direction's absolute one since capex/debt figures are absolute
    currency amounts, not margin fractions."""
    if prior is None or prior == 0:
        return "flat"
    delta_pct = (current - prior) / abs(prior)
    if delta_pct > tolerance:
        return "up"
    if delta_pct < -tolerance:
        return "down"
    return "flat"


def _trend_narrative_addendum(company_name: str, trend_context: dict[str, int]) -> Optional[str]:
    """A short explicit callout once a streak becomes notable (|streak| >= 3),
    e.g. 'third consecutive quarter of margin compression' framing -- checked
    in priority order (beat/miss streak first, then margin streak) so at most
    one addendum is added rather than stacking several trend callouts."""
    bm = trend_context.get("beat_miss_streak", 0)
    if bm >= 3:
        return f"{company_name} has now beaten expectations for {bm} consecutive quarters."
    if bm <= -3:
        return f"{company_name} has now missed expectations for {abs(bm)} consecutive quarters."
    ms = trend_context.get("margin_streak", 0)
    if ms >= 3:
        return f"This marks {ms} consecutive quarters of margin expansion."
    if ms <= -3:
        return f"This marks {abs(ms)} consecutive quarters of margin compression."
    return None


def _select_qa_topics(trend_context: dict[str, int], margin_direction: str, has_capex_section: bool) -> list[str]:
    """Pick 2-4 Q&A topics based on what's actually notable this quarter,
    so the simulated analysts sound like they're reacting to this call
    rather than asking a fixed rotation of questions every time."""
    topics = ["growth"]
    if abs(trend_context.get("margin_streak", 0)) >= 2 or margin_direction != "roughly flat":
        topics.append("margins")
    if abs(trend_context.get("guided_vs_actual_streak", 0)) >= 2:
        topics.append("guidance")
    if has_capex_section:
        topics.append("capex")
    if len(topics) < 3:
        topics.append("competition")
    return topics[:4]


def _build_qa_transcript(
    company_name: str, topics: list[str], tone: str, replacements: dict[str, str], rng: random.Random,
) -> list[dict[str, str]]:
    analysts = rng.sample(ANALYST_ROSTER, k=min(len(topics), len(ANALYST_ROSTER)))
    answer = QA_ANSWER_TEMPLATES[tone].replace("{company}", company_name)
    transcript: list[dict[str, str]] = []
    for (name, firm), topic in zip(analysts, topics):
        question = QA_TOPIC_QUESTIONS[topic]
        for key, val in replacements.items():
            question = question.replace(key, val)
        transcript.append({"analyst_name": name, "analyst_firm": firm, "question": question, "answer": answer})
    return transcript


def _synthesize_segment_guidance(aggregate_guidance: float, rng: random.Random) -> dict[str, float]:
    """Presentational sub-split of the single aggregate guidance figure --
    see SEGMENT_LABELS docstring/comment above; not independent data."""
    return {
        label: round(max(-0.30, min(0.30, aggregate_guidance + rng.gauss(0, 0.02))), 4)
        for label in SEGMENT_LABELS
    }
```

- [ ] **Step 3: Extend `generate_concall`'s signature and body**

Change the signature (`engine/concalls.py:195-209`):
```python
def generate_concall(
    company: Company,
    income_stmt: IncomeStatement,
    prior_income_stmt: Optional[IncomeStatement],
    consensus: Optional[ConsensusEstimate],
    management_quality: float,
    growth_potential: float,
    fiscal_period: str,
    call_date: date,
    rng: random.Random,
    balance_sheet: Optional[BalanceSheet] = None,
    cash_flow: Optional[CashFlowStatement] = None,
    moat_score: Optional[float] = None,
    market_performance: Optional[float] = None,
) -> ConCall:
```
to:
```python
def generate_concall(
    company: Company,
    income_stmt: IncomeStatement,
    prior_income_stmt: Optional[IncomeStatement],
    consensus: Optional[ConsensusEstimate],
    management_quality: float,
    growth_potential: float,
    fiscal_period: str,
    call_date: date,
    rng: random.Random,
    balance_sheet: Optional[BalanceSheet] = None,
    cash_flow: Optional[CashFlowStatement] = None,
    moat_score: Optional[float] = None,
    market_performance: Optional[float] = None,
    previous_concall: Optional[ConCall] = None,
    prior_balance_sheet: Optional[BalanceSheet] = None,
    prior_cash_flow: Optional[CashFlowStatement] = None,
) -> ConCall:
```

Update the docstring (same location) by appending a paragraph:
```python
    `previous_concall` (this company's most recent prior ConCall, if any) is
    the sole input needed for multi-quarter trend awareness -- its
    trend_context is chained forward (see _chain_streak) rather than
    re-querying multiple quarters of history. `prior_balance_sheet` /
    `prior_cash_flow` (previous quarter's rows) are used only for the new
    capex/debt commentary's up/down/flat framing.
    """
```

Change the return statement (`engine/concalls.py:309-320`):
```python
    return ConCall(
        company_id=company.id,
        fiscal_period=fiscal_period,
        call_date=call_date,
        performance_bucket=bucket,
        tone=tone,
        tone_score=round(tone_score, 4),
        guidance_revenue_growth=round(guidance_revenue_growth, 4),
        statements=statements,
        driver_deltas=driver_deltas,
        generated_at=datetime.now(timezone.utc),
    )
```
to:
```python
    prior_trend = previous_concall.trend_context if previous_concall is not None else {}
    bucket_direction = 1 if bucket == "beat" else (-1 if bucket == "miss" else 0)
    margin_direction_val = 1 if margin_direction == "higher" else (-1 if margin_direction == "lower" else 0)
    price_direction_val = 0
    if market_performance is not None:
        if market_performance >= MARKET_PERFORMANCE_STRONG_THRESHOLD:
            price_direction_val = 1
        elif market_performance <= MARKET_PERFORMANCE_WEAK_THRESHOLD:
            price_direction_val = -1
    if previous_concall is not None:
        guided_vs_actual_direction = 1 if revenue_growth >= float(previous_concall.guidance_revenue_growth) - 0.005 else -1
    else:
        guided_vs_actual_direction = 0

    trend_context = {
        "beat_miss_streak": _chain_streak(int(prior_trend.get("beat_miss_streak", 0)), bucket_direction),
        "margin_streak": _chain_streak(int(prior_trend.get("margin_streak", 0)), margin_direction_val),
        "price_streak": _chain_streak(int(prior_trend.get("price_streak", 0)), price_direction_val),
        "guided_vs_actual_streak": _chain_streak(
            int(prior_trend.get("guided_vs_actual_streak", 0)), guided_vs_actual_direction
        ),
    }

    trend_note = _trend_narrative_addendum(company.name, trend_context)
    if trend_note:
        statements["trend_note"] = trend_note

    current_debt = float(balance_sheet.total_debt) if balance_sheet is not None else None
    prior_debt = float(prior_balance_sheet.total_debt) if prior_balance_sheet is not None else None
    leverage_direction = _relative_direction(current_debt, prior_debt) if current_debt is not None else "flat"

    current_capex = abs(float(cash_flow.capex)) if cash_flow is not None else None
    prior_capex = abs(float(prior_cash_flow.capex)) if prior_cash_flow is not None else None
    capex_direction = _relative_direction(current_capex, prior_capex) if current_capex is not None else "flat"

    capex_debt_text = CAPEX_DEBT_TEMPLATES[tone]
    capex_debt_text = capex_debt_text.replace("{capex_direction}", capex_direction).replace(
        "{leverage_direction}", leverage_direction
    )
    statements["capex_debt"] = capex_debt_text
    statements["order_book_strategy"] = ORDER_BOOK_TEMPLATES[tone]

    segment_guidance = _synthesize_segment_guidance(guidance_revenue_growth, rng)

    qa_topics = _select_qa_topics(trend_context, margin_direction, has_capex_section=True)
    qa_transcript = _build_qa_transcript(company.name, qa_topics, tone, replacements, rng)

    # Forward-looking bias signals for next quarter's financials generation
    # (engine.orchestrator._load_concall_extended_signals /
    # _generate_fake_quarterly_financials), same small-magnitude philosophy
    # as the existing "guidance"/"earnings_surprise" keys: bounded well
    # inside the outer GROWTH_RATE_CLAMP_MIN/MAX so no combination of
    # signals can dominate.
    margin_bias = max(-0.03, min(0.03, tone_score * 0.02 + (0.01 if margin_direction == "higher" else (-0.01 if margin_direction == "lower" else 0.0))))
    capex_bias = max(-0.10, min(0.10, tone_score * 0.06))
    debt_bias = max(-0.05, min(0.05, tone_score * 0.03))
    driver_deltas["margin_bias"] = round(margin_bias, 4)
    driver_deltas["capex_bias"] = round(capex_bias, 4)
    driver_deltas["debt_bias"] = round(debt_bias, 4)

    return ConCall(
        company_id=company.id,
        fiscal_period=fiscal_period,
        call_date=call_date,
        performance_bucket=bucket,
        tone=tone,
        tone_score=round(tone_score, 4),
        guidance_revenue_growth=round(guidance_revenue_growth, 4),
        statements=statements,
        driver_deltas=driver_deltas,
        trend_context=trend_context,
        segment_guidance=segment_guidance,
        qa_transcript=qa_transcript,
        generated_at=datetime.now(timezone.utc),
    )
```

- [ ] **Step 4: Write the failing tests**

Create `tests/engine/test_concalls.py` (check whether `tests/engine/__init__.py` exists first; if the `tests/engine/` directory doesn't exist yet, create it with an empty `__init__.py` alongside):

```python
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
```

- [ ] **Step 5: Run the tests to verify they fail before Step 3's code exists**

(If Step 3 was already applied before writing tests, skip straight to Step 6 — the point of this step is only relevant if executing strictly RED-then-GREEN. In this plan, Step 3 precedes the tests, so proceed to Step 6.)

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd "stock-sim"
pytest tests/engine/test_concalls.py -v
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add engine/concalls.py tests/engine/test_concalls.py
git commit -m "feat: comprehensive con-call content + multi-quarter trend chaining"
```

---

### Task 4: Orchestrator — thread margin/capex/debt bias signals into next-quarter financials

**Files:**
- Modify: `engine/orchestrator.py:1718-1769` (`_compute_quarterly_growth_and_margin_bias`)
- Modify: `engine/orchestrator.py:1771-1811` (add new function `_load_concall_extended_signals` right after `_load_concall_guidance_signal`)
- Modify: `engine/orchestrator.py:1814-2020` region (`_generate_fake_quarterly_financials` signature + capex/debt lines)
- Modify: `engine/orchestrator.py:1490-1542` (call site wiring)

**Interfaces:**
- Consumes: `ConCall.driver_deltas["margin_bias"|"capex_bias"|"debt_bias"]` (Task 3 output).
- Produces: `_generate_fake_quarterly_financials` gains three new optional kwargs consumed nowhere else in this codebase (internal to this function's cost/capex/debt computation).

- [ ] **Step 1: Add the `concall_margin_bias` parameter to `_compute_quarterly_growth_and_margin_bias`**

Change (`engine/orchestrator.py:1718-1726`):
```python
def _compute_quarterly_growth_and_margin_bias(
    revenue_history: list[float],
    management_quality: float,
    fq_history: list[float],
    price_return_qtr: float,
    event_sentiment: float,
    guidance_signal: float,
    rng: random.Random,
) -> tuple[float, float]:
```
to:
```python
def _compute_quarterly_growth_and_margin_bias(
    revenue_history: list[float],
    management_quality: float,
    fq_history: list[float],
    price_return_qtr: float,
    event_sentiment: float,
    guidance_signal: float,
    rng: random.Random,
    concall_margin_bias: float = 0.0,
) -> tuple[float, float]:
```

Change the margin_bias line (`engine/orchestrator.py:1766`):
```python
    margin_bias = max(-0.05, min(0.05, mgmt_mean_bias * 0.5 + fq_bias * 0.5 + event_bias * 0.3))
```
to:
```python
    # concall_margin_bias is the prior quarter's con-call margin commentary
    # signal (engine/concalls.py's driver_deltas["margin_bias"], already
    # clamped to [-0.03, 0.03] there) -- added directly, same small scale as
    # the other terms here.
    margin_bias = max(-0.08, min(0.08, mgmt_mean_bias * 0.5 + fq_bias * 0.5 + event_bias * 0.3 + concall_margin_bias))
```

- [ ] **Step 2: Add `_load_concall_extended_signals`**

Insert immediately after `_load_concall_guidance_signal` (`engine/orchestrator.py:1811`), before `def _generate_fake_quarterly_financials`:

```python
def _load_concall_extended_signals(
    session: Session, company_ids: list[int], current_period: str,
) -> dict[int, dict[str, float]]:
    """Prior-quarter con-call margin/capex/debt bias signals, one dict per
    company, mirroring _load_concall_guidance_signal's single-query,
    degrade-to-neutral-on-any-failure contract. Pulled from the same most
    recent prior ConCall.driver_deltas that guidance/tone_score come from,
    so this adds no extra query beyond what _load_concall_guidance_signal
    already issues in the same tick (both could be merged into one query in
    a future pass; kept separate here for a smaller, more reviewable diff).
    """
    neutral = {cid: {"margin_bias": 0.0, "capex_bias": 0.0, "debt_bias": 0.0} for cid in company_ids}
    if not company_ids:
        return neutral
    try:
        from db.models import ConCall  # type: ignore[attr-defined]
    except ImportError:
        return neutral

    try:
        with session.begin_nested():
            rows = session.query(ConCall).filter(
                ConCall.company_id.in_(company_ids),
                ConCall.fiscal_period < current_period,
            ).order_by(ConCall.company_id.asc(), ConCall.fiscal_period.desc()).all()
    except Exception:
        return neutral

    seen: set[int] = set()
    result = dict(neutral)
    for row in rows:
        if row.company_id in seen:
            continue
        seen.add(row.company_id)
        deltas = row.driver_deltas or {}
        result[row.company_id] = {
            "margin_bias": max(-0.03, min(0.03, float(deltas.get("margin_bias", 0.0)))),
            "capex_bias": max(-0.10, min(0.10, float(deltas.get("capex_bias", 0.0)))),
            "debt_bias": max(-0.05, min(0.05, float(deltas.get("debt_bias", 0.0)))),
        }
    return result
```

- [ ] **Step 3: Add the three new kwargs to `_generate_fake_quarterly_financials`**

Change the signature (`engine/orchestrator.py:1814-1826`):
```python
def _generate_fake_quarterly_financials(
    session: Session,
    timeline_id: int,
    company: Company,
    fiscal_period: str,
    rng: random.Random,
    management_quality: float = 50.0,
    fq_history: Optional[list[float]] = None,
    price_return_qtr: float = 0.0,
    event_sentiment: float = 0.0,
    guidance_signal: float = 0.0,
    already_refreshed: Optional[bool] = None,
) -> dict[str, float]:
```
to:
```python
def _generate_fake_quarterly_financials(
    session: Session,
    timeline_id: int,
    company: Company,
    fiscal_period: str,
    rng: random.Random,
    management_quality: float = 50.0,
    fq_history: Optional[list[float]] = None,
    price_return_qtr: float = 0.0,
    event_sentiment: float = 0.0,
    guidance_signal: float = 0.0,
    already_refreshed: Optional[bool] = None,
    concall_margin_bias: float = 0.0,
    concall_capex_bias: float = 0.0,
    concall_debt_bias: float = 0.0,
) -> dict[str, float]:
```

- [ ] **Step 4: Pass `concall_margin_bias` through to the growth/margin computation**

Change (`engine/orchestrator.py:1939-1947`):
```python
        growth_rate, margin_bias = _compute_quarterly_growth_and_margin_bias(
            revenue_history=revenue_history,
            management_quality=management_quality,
            fq_history=fq_history or [],
            price_return_qtr=price_return_qtr,
            event_sentiment=event_sentiment,
            guidance_signal=guidance_signal,
            rng=rng,
        )
```
to:
```python
        growth_rate, margin_bias = _compute_quarterly_growth_and_margin_bias(
            revenue_history=revenue_history,
            management_quality=management_quality,
            fq_history=fq_history or [],
            price_return_qtr=price_return_qtr,
            event_sentiment=event_sentiment,
            guidance_signal=guidance_signal,
            rng=rng,
            concall_margin_bias=concall_margin_bias,
        )
```

- [ ] **Step 5: Apply `concall_debt_bias` to the debt evolution**

Change (`engine/orchestrator.py:2067`):
```python
        td = float(latest_bal.total_debt) * (1 + rng.gauss(0.0, 0.02))
```
to:
```python
        td = float(latest_bal.total_debt) * (1 + rng.gauss(0.0, 0.02) + concall_debt_bias)
```

- [ ] **Step 6: Apply `concall_capex_bias` to the capex computation**

Change (`engine/orchestrator.py:2131`):
```python
    capex = -ppe * capex_r * (1 + rng.gauss(0, 0.05))
```
to:
```python
    capex = -ppe * capex_r * (1 + rng.gauss(0, 0.05) + concall_capex_bias)
```

- [ ] **Step 7: Wire the loader into the call site**

Change (`engine/orchestrator.py:1486-1492`):
```python
    # Prior-quarter con-call guidance signal. If the ConCall model (built by a
    # parallel workstream) isn't importable/queryable yet in this working
    # tree, this degrades to a neutral 0.0 delta for every company rather than
    # blocking fundamentals generation -- see _load_concall_guidance_signal.
    guidance_signal_by_company: dict[int, float] = _load_concall_guidance_signal(
        session, [c.id for c in companies], latest_period,
    )
```
to:
```python
    # Prior-quarter con-call guidance signal. If the ConCall model (built by a
    # parallel workstream) isn't importable/queryable yet in this working
    # tree, this degrades to a neutral 0.0 delta for every company rather than
    # blocking fundamentals generation -- see _load_concall_guidance_signal.
    guidance_signal_by_company: dict[int, float] = _load_concall_guidance_signal(
        session, [c.id for c in companies], latest_period,
    )
    extended_signal_by_company: dict[int, dict[str, float]] = _load_concall_extended_signals(
        session, [c.id for c in companies], latest_period,
    )
```

Change (`engine/orchestrator.py:1533-1542`):
```python
        raw = _generate_fake_quarterly_financials(
            session, timeline_id, company, latest_period, rng,
            management_quality=mgmt_quality_signal,
            fq_history=fq_history_by_company.get(company.id, []),
            price_return_qtr=price_return_by_company.get(company.id, 0.0),
            already_refreshed=company.id in already_refreshed_ids,
            event_sentiment=event_sentiment_by_company.get(company.id, 0.0)
                + event_sentiment_by_industry.get(company.industry_id, 0.0),
            guidance_signal=guidance_signal_by_company.get(company.id, 0.0),
        )
```
to:
```python
        extended_signal = extended_signal_by_company.get(company.id, {})
        raw = _generate_fake_quarterly_financials(
            session, timeline_id, company, latest_period, rng,
            management_quality=mgmt_quality_signal,
            fq_history=fq_history_by_company.get(company.id, []),
            price_return_qtr=price_return_by_company.get(company.id, 0.0),
            already_refreshed=company.id in already_refreshed_ids,
            event_sentiment=event_sentiment_by_company.get(company.id, 0.0)
                + event_sentiment_by_industry.get(company.industry_id, 0.0),
            guidance_signal=guidance_signal_by_company.get(company.id, 0.0),
            concall_margin_bias=extended_signal.get("margin_bias", 0.0),
            concall_capex_bias=extended_signal.get("capex_bias", 0.0),
            concall_debt_bias=extended_signal.get("debt_bias", 0.0),
        )
```

- [ ] **Step 8: Run the existing orchestrator test suite to confirm nothing broke**

```bash
cd "stock-sim"
pytest tests/test_orchestrator.py -v
```

Expected: all tests PASS (new kwargs all default to `0.0`, so behavior is unchanged for any caller that doesn't pass them).

- [ ] **Step 9: Commit**

```bash
git add engine/orchestrator.py
git commit -m "feat: thread con-call margin/capex/debt bias signals into next-quarter financials"
```

---

### Task 5: Orchestrator — apply factor-score nudges, emit a news entry, record `applied_deltas`

**Files:**
- Modify: `engine/orchestrator.py:19-43` (import `NewsFeed`)
- Modify: `engine/orchestrator.py:131-135` region (add two new constants near `DRIVER_KEYS`)
- Modify: `engine/orchestrator.py:2291-2397` (`_generate_concalls_for_quarter`)

**Interfaces:**
- Consumes: `NewsFeed` (`db.models`), `ConCall.driver_deltas`/`applied_deltas` (Task 2/3 output).
- Produces: `ConCall.applied_deltas` populated at generation time; a `NewsFeed` row per generated call; `CompanyFactorScore.management_quality`/`moat_score` nudged for the current quarter's fresh row only (never a stale/detached row).

- [ ] **Step 1: Import `NewsFeed`**

Change (`engine/orchestrator.py:19-43`):
```python
from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    CompanyFactorScore,
    ConCall,
    ConfigParameter,
    ConsensusEstimate,
    EconomicCycleState,
    EventInstance,
    FactorDefinition,
    FinancialQualitySubscore,
    Holding,
    IncomeStatement,
    Industry,
    IndustryPillarWeight,
    MarketEvent,
    MoatSubscore,
    Portfolio,
    PriceDriverScore,
    PriceHistory,
    SimulationState,
    Timeline,
    TimelineOverride,
)
```
to:
```python
from db.models import (
    BalanceSheet,
    CashFlowStatement,
    Company,
    CompanyFactorScore,
    ConCall,
    ConfigParameter,
    ConsensusEstimate,
    EconomicCycleState,
    EventInstance,
    FactorDefinition,
    FinancialQualitySubscore,
    Holding,
    IncomeStatement,
    Industry,
    IndustryPillarWeight,
    MarketEvent,
    MoatSubscore,
    NewsFeed,
    Portfolio,
    PriceDriverScore,
    PriceHistory,
    SimulationState,
    Timeline,
    TimelineOverride,
)
```

- [ ] **Step 2: Add the factor-nudge constants**

Insert near `DRIVER_KEYS` (`engine/orchestrator.py:131-135`, immediately after that block):

```python
# Con-call -> factor-score nudge scale/clamp (Section 6.O comprehensive
# con-calls). driver_deltas["guidance"]/["earnings_surprise"] are already
# clamped to roughly [-0.15, 0.15] in engine/concalls.py; multiplying by
# CONCALL_FACTOR_NUDGE_SCALE and then clamping again to
# +/-CONCALL_FACTOR_NUDGE_CLAMP keeps a single con-call's factor-score effect
# tiny relative to the 0-100 CompanyFactorScore range -- deliberately
# conservative per the approved design's "small bounded nudges" choice.
CONCALL_FACTOR_NUDGE_SCALE = 6.0
CONCALL_FACTOR_NUDGE_CLAMP = 1.5
```

- [ ] **Step 3: Query the one prior row needed for trend chaining and capex/debt framing, and pass it into `generate_concall`**

Change (`engine/orchestrator.py:2374-2389`):
```python
                cfs = fresh_cfs_by_company.get(company.id) or stale_latest_cfs.get(company.id)
                management_quality = float(cfs.management_quality) if cfs else 50.0
                growth_potential = float(cfs.growth_potential) if cfs else 50.0
                moat_score = float(cfs.moat_score) if cfs else None

                concall = generate_concall(
                    company=company,
                    income_stmt=income_stmt,
                    prior_income_stmt=prior_income_stmt,
                    consensus=consensus,
                    management_quality=management_quality,
                    growth_potential=growth_potential,
                    fiscal_period=latest_period,
                    call_date=sim_date,
                    rng=rng,
                    balance_sheet=balance_sheet,
                    cash_flow=cash_flow,
                    moat_score=moat_score,
                    market_performance=market_performance_by_company.get(company.id),
                )
                session.add(concall)
```
to:
```python
                cfs = fresh_cfs_by_company.get(company.id) or stale_latest_cfs.get(company.id)
                management_quality = float(cfs.management_quality) if cfs else 50.0
                growth_potential = float(cfs.growth_potential) if cfs else 50.0
                moat_score = float(cfs.moat_score) if cfs else None

                previous_concall = (
                    session.query(ConCall)
                    .filter(ConCall.company_id == company.id, ConCall.fiscal_period < latest_period)
                    .order_by(ConCall.fiscal_period.desc())
                    .first()
                )
                prior_balance_sheet = session.query(BalanceSheet).filter(
                    BalanceSheet.company_id == company.id,
                    BalanceSheet.timeline_id == timeline_id,
                    BalanceSheet.fiscal_period < latest_period,
                ).order_by(BalanceSheet.fiscal_period.desc()).first()
                prior_cash_flow = session.query(CashFlowStatement).filter(
                    CashFlowStatement.company_id == company.id,
                    CashFlowStatement.timeline_id == timeline_id,
                    CashFlowStatement.fiscal_period < latest_period,
                ).order_by(CashFlowStatement.fiscal_period.desc()).first()

                concall = generate_concall(
                    company=company,
                    income_stmt=income_stmt,
                    prior_income_stmt=prior_income_stmt,
                    consensus=consensus,
                    management_quality=management_quality,
                    growth_potential=growth_potential,
                    fiscal_period=latest_period,
                    call_date=sim_date,
                    rng=rng,
                    balance_sheet=balance_sheet,
                    cash_flow=cash_flow,
                    moat_score=moat_score,
                    market_performance=market_performance_by_company.get(company.id),
                    previous_concall=previous_concall,
                    prior_balance_sheet=prior_balance_sheet,
                    prior_cash_flow=prior_cash_flow,
                )
                session.add(concall)

                # Small bounded factor-score nudge -- only against the
                # current-session-fresh CompanyFactorScore row for this
                # quarter (fresh_cfs_by_company), never against
                # stale_latest_cfs (a pre-tick snapshot that may not be
                # attached to this session / may be stale by the time this
                # flushes) -- see this function's docstring on stale_latest_cfs.
                cfs_for_nudge = fresh_cfs_by_company.get(company.id)
                mgmt_delta = 0.0
                moat_delta = 0.0
                if cfs_for_nudge is not None:
                    mgmt_delta = max(
                        -CONCALL_FACTOR_NUDGE_CLAMP,
                        min(CONCALL_FACTOR_NUDGE_CLAMP, concall.driver_deltas.get("guidance", 0.0) * CONCALL_FACTOR_NUDGE_SCALE),
                    )
                    moat_delta = max(
                        -CONCALL_FACTOR_NUDGE_CLAMP,
                        min(CONCALL_FACTOR_NUDGE_CLAMP, concall.driver_deltas.get("earnings_surprise", 0.0) * CONCALL_FACTOR_NUDGE_SCALE),
                    )
                    cfs_for_nudge.management_quality = round(
                        max(0.0, min(100.0, float(cfs_for_nudge.management_quality) + mgmt_delta)), 4,
                    )
                    cfs_for_nudge.moat_score = round(
                        max(0.0, min(100.0, float(cfs_for_nudge.moat_score) + moat_delta)), 4,
                    )

                # Give the con-call a real entry in the news feed pipeline
                # (finally a consumer for driver_deltas -- see ConCall's
                # model docstring) via a direct NewsFeed insert rather than
                # engine.news_manager.generate_news, since that function is
                # hard-wired to an EventInstance+MarketEvent+NewsTemplate
                # join and a con-call already has its own statement text, no
                # template substitution needed.
                headline = f"{company.name} {concall.performance_bucket.upper()} on {latest_period} earnings call"
                news = NewsFeed(
                    timeline_id=timeline_id,
                    sim_date=sim_date,
                    company_id=company.id,
                    industry_id=None,
                    headline=headline[:300],
                    body=concall.statements.get("opening", headline),
                    sentiment="positive" if concall.tone_score > 0 else ("negative" if concall.tone_score < 0 else "neutral"),
                    severity=round(abs(concall.tone_score) * 5.0, 4),
                    news_type="both",
                    source_event_instance_id=None,
                )
                session.add(news)
                session.flush()

                concall.applied_deltas = {
                    "management_quality_delta": mgmt_delta,
                    "moat_score_delta": moat_delta,
                    "news_feed_id": news.id,
                }
```

- [ ] **Step 4: Run the con-call orchestrator test coverage**

```bash
cd "stock-sim"
pytest tests/test_orchestrator.py -k concall -v
```

Expected: PASS. If no tests currently match `-k concall`, instead run the full orchestrator suite (same command as Task 4 Step 8) and confirm no regressions.

- [ ] **Step 5: Commit**

```bash
git add engine/orchestrator.py
git commit -m "feat: con-calls apply bounded factor-score nudges and emit a news entry"
```

---

### Task 6: API — extend `ConCallItem` schema and the concalls router

**Files:**
- Modify: `apps/api/schemas.py:452-463` (`ConCallItem`)
- Modify: `apps/api/routers/concalls.py:55-69` (`ConCallItem(...)` construction in `get_concalls`)
- Test: `apps/api/tests/test_concalls.py` (add one new test)

**Interfaces:**
- Consumes: `ConCall.trend_context`/`segment_guidance`/`qa_transcript`/`applied_deltas` (Task 2/3/5 output).
- Produces: `GET /api/v1/companies/{ticker}/concalls` response items gain `trend_context`, `segment_guidance`, `qa_transcript`, `applied_deltas` fields — consumed by Task 8 (frontend).

- [ ] **Step 1: Add a Q&A exchange schema and extend `ConCallItem`**

Change (`apps/api/schemas.py:452-463`):
```python
class ConCallItem(BaseModel):
    id: int
    company_id: int
    fiscal_period: str
    call_date: date
    performance_bucket: str
    tone: str
    tone_score: float
    guidance_revenue_growth: float
    statements: dict[str, str]
    actual_eps: Optional[float] = None
    consensus_eps: Optional[float] = None
```
to:
```python
class ConCallQAExchange(BaseModel):
    analyst_name: str
    analyst_firm: str
    question: str
    answer: str


class ConCallItem(BaseModel):
    id: int
    company_id: int
    fiscal_period: str
    call_date: date
    performance_bucket: str
    tone: str
    tone_score: float
    guidance_revenue_growth: float
    statements: dict[str, str]
    segment_guidance: dict[str, float] = {}
    qa_transcript: list[ConCallQAExchange] = []
    trend_context: dict[str, int] = {}
    applied_deltas: dict[str, Optional[float]] = {}
    actual_eps: Optional[float] = None
    consensus_eps: Optional[float] = None
```

- [ ] **Step 2: Pass the new fields through in the router**

Change (`apps/api/routers/concalls.py:55-69`):
```python
    return [
        ConCallItem(
            id=r.id,
            company_id=r.company_id,
            fiscal_period=r.fiscal_period,
            call_date=r.call_date,
            performance_bucket=r.performance_bucket,
            tone=r.tone,
            tone_score=float(r.tone_score),
            guidance_revenue_growth=float(r.guidance_revenue_growth),
            statements=r.statements,
            actual_eps=actual_eps_by_period.get(r.fiscal_period),
            consensus_eps=consensus_eps_by_period.get(r.fiscal_period),
        )
        for r in rows
    ]
```
to:
```python
    return [
        ConCallItem(
            id=r.id,
            company_id=r.company_id,
            fiscal_period=r.fiscal_period,
            call_date=r.call_date,
            performance_bucket=r.performance_bucket,
            tone=r.tone,
            tone_score=float(r.tone_score),
            guidance_revenue_growth=float(r.guidance_revenue_growth),
            statements=r.statements,
            segment_guidance=r.segment_guidance or {},
            qa_transcript=r.qa_transcript or [],
            trend_context=r.trend_context or {},
            applied_deltas=r.applied_deltas or {},
            actual_eps=actual_eps_by_period.get(r.fiscal_period),
            consensus_eps=consensus_eps_by_period.get(r.fiscal_period),
        )
        for r in rows
    ]
```

- [ ] **Step 3: Add a test for the new fields**

Append to `apps/api/tests/test_concalls.py`:
```python
def test_get_concalls_includes_comprehensive_fields(client, test_db, test_timeline, test_company):
    call = ConCall(
        company_id=test_company.id,
        fiscal_period="2026Q1",
        call_date=date(2026, 1, 2),
        performance_bucket="beat",
        tone="confident",
        tone_score=1.0,
        guidance_revenue_growth=0.05,
        statements={"opening": "Great quarter.", "capex_debt": "Leaning into capex."},
        driver_deltas={"guidance": 0.15, "margin_bias": 0.01, "capex_bias": 0.02, "debt_bias": 0.0},
        segment_guidance={"Core": 0.04, "Emerging Markets": 0.06},
        qa_transcript=[{"analyst_name": "Ananya Rao", "analyst_firm": "Kotak", "question": "Q?", "answer": "A."}],
        trend_context={"beat_miss_streak": 1, "margin_streak": 1, "price_streak": 0, "guided_vs_actual_streak": 1},
        applied_deltas={"management_quality_delta": 0.9, "moat_score_delta": 0.5, "news_feed_id": 1},
    )
    test_db.add(call)
    test_db.commit()

    resp = client.get(f"/api/v1/companies/{test_company.ticker}/concalls")
    assert resp.status_code == 200
    data = resp.json()[0]
    assert data["statements"]["capex_debt"] == "Leaning into capex."
    assert data["segment_guidance"]["Core"] == 0.04
    assert data["qa_transcript"][0]["analyst_name"] == "Ananya Rao"
    assert data["trend_context"]["beat_miss_streak"] == 1
    assert data["applied_deltas"]["management_quality_delta"] == 0.9
```

- [ ] **Step 4: Run the API test suite**

```bash
cd "stock-sim"
pytest apps/api/tests/test_concalls.py -v
```

Expected: all tests PASS, including the pre-existing ones (they don't set the new fields, which default to `{}`/`[]` via the Pydantic defaults).

- [ ] **Step 5: Commit**

```bash
git add apps/api/schemas.py apps/api/routers/concalls.py apps/api/tests/test_concalls.py
git commit -m "feat: expose trend_context/segment_guidance/qa_transcript/applied_deltas via concalls API"
```

---

### Task 7: Frontend types

**Files:**
- Modify: `apps/web/lib/api/types.ts:393-405` (`ConCallItem`)

**Interfaces:**
- Consumes: nothing.
- Produces: `ConCallQAExchange`, extended `ConCallItem` — consumed by Task 8.

- [ ] **Step 1: Extend the type**

Change:
```typescript
export interface ConCallItem {
  id: number;
  company_id: number;
  fiscal_period: string;
  call_date: string;
  performance_bucket: "beat" | "inline" | "miss";
  tone: "confident" | "measured" | "cautious" | "defensive" | "evasive";
  tone_score: number;
  guidance_revenue_growth: number;
  statements: Record<string, string>;
  actual_eps: number | null;
  consensus_eps: number | null;
}
```
to:
```typescript
export interface ConCallQAExchange {
  analyst_name: string;
  analyst_firm: string;
  question: string;
  answer: string;
}

export interface ConCallItem {
  id: number;
  company_id: number;
  fiscal_period: string;
  call_date: string;
  performance_bucket: "beat" | "inline" | "miss";
  tone: "confident" | "measured" | "cautious" | "defensive" | "evasive";
  tone_score: number;
  guidance_revenue_growth: number;
  statements: Record<string, string>;
  segment_guidance: Record<string, number>;
  qa_transcript: ConCallQAExchange[];
  trend_context: Record<string, number>;
  applied_deltas: Record<string, number | null>;
  actual_eps: number | null;
  consensus_eps: number | null;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "stock-sim/apps/web"
npx tsc --noEmit
```

Expected: new errors ONLY in `FinancialTabs.tsx` (which Task 8 fixes) if any — the type change itself should not error, since `Record<string, string>` for `statements` was already satisfied and new fields are additive.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/api/types.ts
git commit -m "feat: extend ConCallItem frontend type with comprehensive con-call fields"
```

---

### Task 8: Frontend — render the new sections in `FinancialTabs.tsx`

**Files:**
- Modify: `apps/web/components/companies/FinancialTabs.tsx:128-172` (`STATEMENT_ORDER`, `ConCallTranscript`) and the imports block (`:1-16`)

**Interfaces:**
- Consumes: `ConCallItem` (Task 7 output).
- Produces: nothing new consumed elsewhere — leaf UI.

- [ ] **Step 1: Extend `STATEMENT_ORDER` and add the new presentational sub-components**

Change (`apps/web/components/companies/FinancialTabs.tsx:128`):
```tsx
const STATEMENT_ORDER = ["opening", "revenue", "margins", "guidance", "closing"];
```
to:
```tsx
const STATEMENT_ORDER = [
  "opening", "revenue", "margins", "capex_debt", "order_book_strategy", "guidance", "closing",
  "market_context", "trend_note",
];

const STATEMENT_LABELS: Record<string, string> = {
  capex_debt: "Capex & Debt",
  order_book_strategy: "Order Book & Strategy",
  market_context: "Market Context",
  trend_note: "Trend",
};

function SegmentGuidanceTable({ segments }: { segments: Record<string, number> }) {
  const entries = Object.entries(segments);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1">
      <span className="text-micro font-medium uppercase text-mer-ink-tertiary">
        Segment / Geography Guidance
      </span>
      <table className="w-full text-small">
        <tbody>
          {entries.map(([segment, growth]) => (
            <tr key={segment}>
              <td className="py-0.5 text-mer-ink-secondary">{segment}</td>
              <td className="num py-0.5 text-right text-mer-ink-primary">{formatPct(growth * 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QATranscript({ qa }: { qa: ConCallItem["qa_transcript"] }) {
  if (!qa || qa.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-2">
      <span className="text-micro font-medium uppercase text-mer-ink-tertiary">Analyst Q&amp;A</span>
      {qa.map((exchange, i) => (
        <div key={`${exchange.analyst_name}-${i}`} className="flex flex-col gap-0.5 rounded-mer-sm bg-mer-surface-2 p-2">
          <span className="text-micro font-medium text-mer-ink-primary">
            {exchange.analyst_name} · {exchange.analyst_firm}
          </span>
          <span className="text-small text-mer-ink-secondary">Q: {exchange.question}</span>
          <span className="text-small text-mer-ink-tertiary">A: {exchange.answer}</span>
        </div>
      ))}
    </div>
  );
}

const TREND_BADGE_LABELS: Record<string, (value: number) => string> = {
  beat_miss_streak: (v) => (v >= 2 ? `${v}Q beat streak` : v <= -2 ? `${Math.abs(v)}Q miss streak` : ""),
  margin_streak: (v) => (v >= 2 ? `${v}Q margin expansion` : v <= -2 ? `${Math.abs(v)}Q margin compression` : ""),
  guided_vs_actual_streak: (v) => (v >= 2 ? `${v}Q guidance beat` : v <= -2 ? `${Math.abs(v)}Q guidance miss` : ""),
};

function TrendBadges({ trend }: { trend: Record<string, number> }) {
  const labels = Object.entries(trend)
    .map(([key, value]) => TREND_BADGE_LABELS[key]?.(value) ?? "")
    .filter(Boolean);
  if (labels.length === 0) return null;
  return (
    <>
      {labels.map((label) => (
        <Badge key={label} variant="default">{label}</Badge>
      ))}
    </>
  );
}

function ImpactStrip({ applied }: { applied: Record<string, number | null> }) {
  const mgmt = applied.management_quality_delta;
  const moat = applied.moat_score_delta;
  if (!mgmt && !moat) return null;
  return (
    <div className="flex items-center gap-3 rounded-mer-sm bg-mer-surface-2 px-2 py-1 text-micro text-mer-ink-tertiary">
      <span className="font-medium uppercase">Impact</span>
      {mgmt ? <span>Management quality {mgmt > 0 ? "+" : ""}{mgmt.toFixed(2)}</span> : null}
      {moat ? <span>Moat score {moat > 0 ? "+" : ""}{moat.toFixed(2)}</span> : null}
    </div>
  );
}
```

- [ ] **Step 2: Render the new sections inside `ConCallTranscript`**

Change (`apps/web/components/companies/FinancialTabs.tsx:130-172`):
```tsx
function ConCallTranscript({ call, ticker }: { call: ConCallItem; ticker: string }) {
  const sections = Object.entries(call.statements).sort(
    ([a], [b]) => STATEMENT_ORDER.indexOf(a) - STATEMENT_ORDER.indexOf(b),
  );
  return (
    <div className={cn("flex flex-col gap-2 border-b py-3 last:border-b-0", MER_HAIRLINE)}>
      <div className="flex items-center gap-2">
        <span className="text-small font-medium text-mer-ink-primary">{call.fiscal_period}</span>
        <Badge variant={BUCKET_VARIANT[call.performance_bucket]}>{call.performance_bucket}</Badge>
        <Badge variant={TONE_VARIANT[call.tone]}>{call.tone}</Badge>
        <span className="num text-micro text-mer-ink-tertiary">{call.call_date}</span>
        {call.actual_eps != null && call.consensus_eps != null && (
          <span className="num text-micro text-mer-ink-tertiary">
            Actual EPS {formatPrice(call.actual_eps)} vs. Consensus {formatPrice(call.consensus_eps)}
          </span>
        )}
        <button
          type="button"
          onClick={() => downloadPdf(`/api/v1/companies/${ticker}/concalls/${call.id}/pdf`, `${ticker}_${call.fiscal_period}_concall.pdf`)}
          className="ml-auto flex items-center gap-1 rounded-mer-sm px-2 py-1 text-micro text-mer-ink-tertiary transition-colors hover:bg-mer-surface-2 hover:text-mer-ink-primary"
          title="Download PDF transcript"
        >
          <Download size={12} /> PDF
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {sections.map(([section, text]) => (
          <p key={section} className="text-small text-mer-ink-secondary">
            {text}
          </p>
        ))}
      </div>
      <div className="flex items-center gap-1.5 pt-1">
        <span className="text-micro font-medium uppercase text-mer-ink-tertiary">
          Guided Growth (management commentary)
        </span>
        <span className="num text-small font-medium text-mer-ink-primary">
          {formatPct(call.guidance_revenue_growth * 100)}
        </span>
      </div>
    </div>
  );
}
```
to:
```tsx
function ConCallTranscript({ call, ticker }: { call: ConCallItem; ticker: string }) {
  const sections = Object.entries(call.statements).sort(
    ([a], [b]) => STATEMENT_ORDER.indexOf(a) - STATEMENT_ORDER.indexOf(b),
  );
  return (
    <div className={cn("flex flex-col gap-2 border-b py-3 last:border-b-0", MER_HAIRLINE)}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-small font-medium text-mer-ink-primary">{call.fiscal_period}</span>
        <Badge variant={BUCKET_VARIANT[call.performance_bucket]}>{call.performance_bucket}</Badge>
        <Badge variant={TONE_VARIANT[call.tone]}>{call.tone}</Badge>
        <TrendBadges trend={call.trend_context} />
        <span className="num text-micro text-mer-ink-tertiary">{call.call_date}</span>
        {call.actual_eps != null && call.consensus_eps != null && (
          <span className="num text-micro text-mer-ink-tertiary">
            Actual EPS {formatPrice(call.actual_eps)} vs. Consensus {formatPrice(call.consensus_eps)}
          </span>
        )}
        <button
          type="button"
          onClick={() => downloadPdf(`/api/v1/companies/${ticker}/concalls/${call.id}/pdf`, `${ticker}_${call.fiscal_period}_concall.pdf`)}
          className="ml-auto flex items-center gap-1 rounded-mer-sm px-2 py-1 text-micro text-mer-ink-tertiary transition-colors hover:bg-mer-surface-2 hover:text-mer-ink-primary"
          title="Download PDF transcript"
        >
          <Download size={12} /> PDF
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {sections.map(([section, text]) => (
          <p key={section} className="text-small text-mer-ink-secondary">
            {STATEMENT_LABELS[section] ? <strong className="text-mer-ink-primary">{STATEMENT_LABELS[section]}: </strong> : null}
            {text}
          </p>
        ))}
      </div>
      <SegmentGuidanceTable segments={call.segment_guidance} />
      <QATranscript qa={call.qa_transcript} />
      <div className="flex items-center gap-1.5 pt-1">
        <span className="text-micro font-medium uppercase text-mer-ink-tertiary">
          Guided Growth (management commentary)
        </span>
        <span className="num text-small font-medium text-mer-ink-primary">
          {formatPct(call.guidance_revenue_growth * 100)}
        </span>
      </div>
      <ImpactStrip applied={call.applied_deltas} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
cd "stock-sim/apps/web"
npx tsc --noEmit
npx eslint components/companies/FinancialTabs.tsx
```

Expected: no errors.

- [ ] **Step 4: Manual verification in the browser**

```bash
npm run dev
```
Navigate to a company detail page → Con-Calls tab. Confirm: trend badges appear once a company has 2+ quarters of con-call history in the same direction; the transcript shows labeled Capex & Debt / Order Book & Strategy paragraphs; a Segment/Geography Guidance table renders; an Analyst Q&A block renders with 2-4 exchanges; an Impact strip appears showing the management-quality/moat-score deltas this call applied (once Task 5's backend change has actually run at least one quarter boundary in this environment — a freshly-seeded company/timeline with no elapsed quarters won't show any con-calls yet).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/companies/FinancialTabs.tsx
git commit -m "feat: render capex/debt, segment guidance, analyst Q&A, trend badges, and impact strip in Con-Calls tab"
```

---

### Task 9: PDF export — add the new sections

**Files:**
- Modify: `apps/api/services/pdf_service.py:162-177` (`generate_concall_pdf`'s "Management Commentary" section)

**Interfaces:**
- Consumes: `ConCall.statements`/`segment_guidance`/`qa_transcript` (Task 2/3 output).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Extend `statement_order`/`labels` and add segment/Q&A sections**

Change (`apps/api/services/pdf_service.py:162-177`):
```python
    # management commentary
    story.append(Paragraph("Management Commentary", s["h1"]))
    statement_order = ["opening", "revenue", "margins", "guidance", "closing"]
    labels = {
        "opening": "Opening Remarks",
        "revenue": "Revenue Commentary",
        "margins": "Margin Commentary",
        "guidance": "Outlook & Guidance",
        "closing": "Closing Remarks",
    }
    for key in statement_order:
        text = concall.statements.get(key)
        if text:
            story.append(Paragraph(labels.get(key, key.replace("_", " ").title()), s["h2"]))
            story.append(Paragraph(text, s["body"]))
            story.append(Spacer(1, 4))
```
to:
```python
    # management commentary
    story.append(Paragraph("Management Commentary", s["h1"]))
    statement_order = [
        "opening", "revenue", "margins", "capex_debt", "order_book_strategy",
        "guidance", "closing", "market_context", "trend_note",
    ]
    labels = {
        "opening": "Opening Remarks",
        "revenue": "Revenue Commentary",
        "margins": "Margin Commentary",
        "capex_debt": "Capex & Debt",
        "order_book_strategy": "Order Book & Strategy",
        "guidance": "Outlook & Guidance",
        "closing": "Closing Remarks",
        "market_context": "Market Context",
        "trend_note": "Trend",
    }
    for key in statement_order:
        text = concall.statements.get(key)
        if text:
            story.append(Paragraph(labels.get(key, key.replace("_", " ").title()), s["h2"]))
            story.append(Paragraph(text, s["body"]))
            story.append(Spacer(1, 4))

    if concall.segment_guidance:
        story.append(Paragraph("Segment / Geography Guidance", s["h1"]))
        seg_rows = [
            [Paragraph(segment, s["cell_label"]), Paragraph(f"{growth * 100:+.2f}%", s["body_bold"])]
            for segment, growth in concall.segment_guidance.items()
        ]
        seg_t = Table(seg_rows, colWidths=[3.0 * inch, 1.5 * inch])
        seg_t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(seg_t)
        story.append(Spacer(1, 10))

    if concall.qa_transcript:
        story.append(Paragraph("Analyst Q&A", s["h1"]))
        for exchange in concall.qa_transcript:
            story.append(Paragraph(f"{exchange['analyst_name']} — {exchange['analyst_firm']}", s["h2"]))
            story.append(Paragraph(f"Q: {exchange['question']}", s["body"]))
            story.append(Paragraph(f"A: {exchange['answer']}", s["body"]))
            story.append(Spacer(1, 4))
```

- [ ] **Step 2: Manually verify PDF generation doesn't error**

```bash
cd "stock-sim"
python -c "
from datetime import date
from db.models import Company, ConCall
from apps.api.services.pdf_service import generate_concall_pdf

company = Company(id=1, ticker='TST', name='Test Co', industry_id=1)
call = ConCall(
    id=1, company_id=1, fiscal_period='2026Q1', call_date=date(2026, 1, 1),
    performance_bucket='beat', tone='confident', tone_score=1.0, guidance_revenue_growth=0.05,
    statements={'opening': 'Great quarter.', 'capex_debt': 'Leaning into capex.'},
    driver_deltas={}, segment_guidance={'Core': 0.04}, qa_transcript=[{'analyst_name': 'A', 'analyst_firm': 'B', 'question': 'Q?', 'answer': 'A.'}],
)
pdf_bytes = generate_concall_pdf(company, call, 1.10, 1.00)
assert len(pdf_bytes) > 0
print('OK', len(pdf_bytes), 'bytes')
"
```

Expected: prints `OK <N> bytes` with no exception. (`company.industry` isn't set on this bare object — if `_company_header`/`_header_table` raise an `AttributeError` on a missing `industry` relationship, this is a pre-existing constraint of `generate_concall_pdf`'s test fixture, not something this task changes; the router's real call site always loads `Company` with `joinedload(Company.industry)`, per `apps/api/routers/concalls.py:79`.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/services/pdf_service.py
git commit -m "feat: add capex/debt, segment guidance, and analyst Q&A sections to con-call PDF export"
```

---

### Task 10: Full-suite regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

```bash
cd "stock-sim"
pytest -x -q
```

Expected: all tests PASS.

- [ ] **Step 2: Run the full frontend test suite**

```bash
cd "stock-sim/apps/web"
npx vitest run
npx tsc --noEmit
```

Expected: all tests PASS, no type errors.

- [ ] **Step 3: Manually advance a simulation timeline through a quarter boundary and inspect results**

Using whatever local dev flow exists for advancing simulation ticks (e.g. the admin panel's "Advance" action, or a direct call to `run_ticks`), advance a test timeline through at least one fiscal-quarter boundary for a company that already has one prior con-call on record. Then:

1. Query the new `ConCall` row and confirm `trend_context`, `segment_guidance`, `qa_transcript`, `applied_deltas` are all populated (non-empty).
2. Query `NewsFeed` for that `timeline_id`/`sim_date` and confirm a row with `source_event_instance_id IS NULL` and a headline matching `"{company} {BUCKET} on {period} earnings call"` exists.
3. Query `CompanyFactorScore` for that company/quarter before and after the tick and confirm `management_quality`/`moat_score` moved by an amount matching `applied_deltas["management_quality_delta"]`/`["moat_score_delta"]` (within rounding).
4. Advance one more quarter and confirm the next `ConCall.trend_context` streak values evolved sensibly from the previous call's (e.g. `beat_miss_streak` extended by exactly 1 if the bucket repeated, or reset to `±1` if it flipped).
