"""Section 6.O -- quarterly conference-call (con-call) generation.

Mirrors engine/news_manager.py's templated-text approach: no LLM call, just
deterministic bucket selection + placeholder substitution keyed off the
quarter's actual financial performance and the company's management_quality/
growth_potential factor scores.

Called once per company, per quarter boundary, from
engine.orchestrator._refresh_fundamentals -- right after that company's new
IncomeStatement/BalanceSheet/CashFlowStatement/ConsensusEstimate rows exist,
so this reads the just-generated quarter directly rather than re-querying.

Output feeds forward into next quarter's revenue-growth generation via
ConCall.tone_score / ConCall.guidance_revenue_growth (see
engine.orchestrator._load_concall_guidance_signal, which reads these two
fields back as a small guidance_signal input to
_generate_fake_quarterly_financials).
"""
import random
from datetime import date, datetime, timezone
from typing import Optional

from db.models.concalls import ConCall
from db.models.financials import BalanceSheet, CashFlowStatement, ConsensusEstimate, IncomeStatement
from db.models.reference import Company

# Management-quality bands used to pick a tone within a performance bucket.
# Scores are 0-100 (see CompanyFactorScore.management_quality).
MGMT_QUALITY_STRONG_THRESHOLD = 65.0
MGMT_QUALITY_WEAK_THRESHOLD = 35.0

# Moat-score band used as a tone tie-breaker (0-100, see
# CompanyFactorScore.moat_score) -- a wide moat lets management sound more
# assured even off a soft quarter; a thin moat sharpens caution on a soft one.
MOAT_SCORE_STRONG_THRESHOLD = 65.0
MOAT_SCORE_WEAK_THRESHOLD = 35.0

# Quarter-over-quarter stock return (close-to-close across the quarter, see
# _quarter_market_performance) band used the same way as the moat band.
MARKET_PERFORMANCE_STRONG_THRESHOLD = 0.08
MARKET_PERFORMANCE_WEAK_THRESHOLD = -0.08

# tone -> numeric [-1, 1] mirror stored on ConCall.tone_score, and the
# magnitude of guidance_revenue_growth suggested for that tone (further
# scaled by the quarter's actual growth rate below).
TONE_SCORE = {
    "confident": 1.0,
    "measured": 0.35,
    "cautious": -0.25,
    "defensive": -0.6,
    "evasive": -1.0,
}

# (performance_bucket, mgmt_band) -> tone. mgmt_band is "strong" | "mid" | "weak".
_TONE_MATRIX: dict[tuple[str, str], str] = {
    ("beat", "strong"): "confident",
    ("beat", "mid"): "confident",
    ("beat", "weak"): "measured",
    ("inline", "strong"): "measured",
    ("inline", "mid"): "measured",
    ("inline", "weak"): "cautious",
    ("miss", "strong"): "cautious",
    ("miss", "mid"): "defensive",
    ("miss", "weak"): "evasive",
}

# Statement templates keyed by (performance_bucket, tone). Each entry is a
# short structured "transcript": opening remarks, revenue commentary, margin
# commentary, guidance, closing tone -- rendered by the frontend as a list.
# {company}/{revenue_growth_pct}/{eps}/{consensus_eps}/{margin_direction}
# are substituted per-call.
_STATEMENT_TEMPLATES: dict[tuple[str, str], dict[str, str]] = {
    ("beat", "confident"): {
        "opening": "{company} delivered another strong quarter, and frankly, this is exactly what we expected from the team.",
        "revenue": "Revenue grew {revenue_growth_pct} year-over-year, comfortably ahead of where we guided.",
        "margins": "Margins moved {margin_direction}, and we see a clear path to sustaining that.",
        "guidance": "We're raising our outlook for next quarter -- the underlying demand trends give us real conviction here.",
        "closing": "We're confident in the setup going forward and see no reason to change course.",
    },
    ("beat", "measured"): {
        "opening": "{company} posted a solid beat this quarter.",
        "revenue": "Revenue came in at {revenue_growth_pct} growth, ahead of consensus.",
        "margins": "Margins were {margin_direction}, broadly in line with our internal plan.",
        "guidance": "We're maintaining our prior guidance range for now while we validate the trend holds.",
        "closing": "Encouraging quarter, though we want to see another one before getting more aggressive.",
    },
    ("inline", "measured"): {
        "opening": "{company} delivered a quarter largely in line with expectations.",
        "revenue": "Revenue growth of {revenue_growth_pct} matched our internal forecast.",
        "margins": "Margins were {margin_direction}, consistent with the prior few quarters.",
        "guidance": "Guidance is unchanged -- we're executing the plan as laid out.",
        "closing": "Nothing dramatic to report; steady execution continues.",
    },
    ("inline", "cautious"): {
        "opening": "{company} met expectations this quarter, though we're watching a few areas closely.",
        "revenue": "Revenue grew {revenue_growth_pct}, in line, but the mix underneath was mixed.",
        "margins": "Margins moved {margin_direction}, and we're monitoring cost pressure.",
        "guidance": "We're holding guidance steady but want to flag some uncertainty heading into next quarter.",
        "closing": "We'd characterize the outlook as cautiously stable rather than accelerating.",
    },
    ("miss", "cautious"): {
        "opening": "{company} fell short of expectations this quarter.",
        "revenue": "Revenue growth of {revenue_growth_pct} came in below what we'd guided to.",
        "margins": "Margins were {margin_direction}, reflecting some of the same pressures.",
        "guidance": "We're taking a more conservative view on next quarter until we see stabilization.",
        "closing": "This wasn't the quarter we wanted, but we believe the underlying business is sound.",
    },
    ("miss", "defensive"): {
        "opening": "{company} had a difficult quarter that fell short of consensus.",
        "revenue": "Revenue growth of {revenue_growth_pct} missed our internal target.",
        "margins": "Margins moved {margin_direction} amid a challenging operating environment.",
        "guidance": "We're pulling back our near-term guidance while we work through these headwinds.",
        "closing": "We acknowledge the results are disappointing and are taking steps to address it.",
    },
    ("miss", "evasive"): {
        "opening": "{company}'s results this quarter were, in a word, complicated.",
        "revenue": "Revenue growth landed at {revenue_growth_pct} -- there were a number of moving pieces here.",
        "margins": "On margins, {margin_direction} movement reflects a range of factors we're still unpacking.",
        "guidance": "We're not in a position to provide specific guidance today given the uncertainty.",
        "closing": "We'll have more clarity to share as the situation develops.",
    },
}


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


def _performance_bucket(eps: float, consensus_eps: float) -> str:
    """EPS vs. consensus, with a small tolerance band for 'inline'."""
    if consensus_eps == 0:
        return "inline"
    surprise_pct = (eps - consensus_eps) / abs(consensus_eps)
    if surprise_pct > 0.02:
        return "beat"
    if surprise_pct < -0.02:
        return "miss"
    return "inline"


def _mgmt_band(management_quality: float) -> str:
    if management_quality >= MGMT_QUALITY_STRONG_THRESHOLD:
        return "strong"
    if management_quality <= MGMT_QUALITY_WEAK_THRESHOLD:
        return "weak"
    return "mid"


# Ordered worst -> best; tone nudges below move one step toward "confident",
# nudges up move one step toward "evasive".
_TONE_ORDER = ["evasive", "defensive", "cautious", "measured", "confident"]


def _nudge_tone(tone: str, steps: int) -> str:
    idx = _TONE_ORDER.index(tone)
    idx = max(0, min(len(_TONE_ORDER) - 1, idx + steps))
    return _TONE_ORDER[idx]


def _tone_nudge_from_score(score: float, strong_threshold: float, weak_threshold: float) -> int:
    """A strong moat/market score nudges tone one step more confident; a weak
    one nudges it one step more cautious. Kept to a single step so the
    bucket x management-quality matrix stays the dominant signal."""
    if score >= strong_threshold:
        return 1
    if score <= weak_threshold:
        return -1
    return 0


def _revenue_growth_pct(current_revenue: float, prior_revenue: Optional[float]) -> float:
    if not prior_revenue or prior_revenue <= 0:
        return 0.0
    return (current_revenue - prior_revenue) / prior_revenue


def _margin_direction(current_margin: Optional[float], prior_margin: Optional[float]) -> str:
    if current_margin is None or prior_margin is None:
        return "roughly flat"
    delta = current_margin - prior_margin
    if delta > 0.005:
        return "higher"
    if delta < -0.005:
        return "lower"
    return "roughly flat"


def _market_context_statement(company_name: str, market_performance: float) -> str:
    """A management remark acknowledging how the stock itself traded over
    the quarter, independent of the fundamentals commentary above."""
    pct = f"{market_performance * 100:+.1f}%"
    if market_performance >= MARKET_PERFORMANCE_STRONG_THRESHOLD:
        return f"The market has been rewarding that execution -- shares moved {pct} over the quarter."
    if market_performance <= MARKET_PERFORMANCE_WEAK_THRESHOLD:
        return f"We're aware the stock hasn't reflected that -- shares moved {pct} over the quarter -- and we don't take that lightly."
    return f"Shares were roughly flat over the quarter ({pct}), tracking in line with our results."


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
    """Build (but do not add/commit) a ConCall row for one company's quarter.

    Deterministic given its inputs (aside from a small rng-driven jitter on
    the guidance figure), matching engine.news_manager.generate_news's
    template + placeholder-substitution style rather than any LLM call.

    `moat_score` (0-100, CompanyFactorScore.moat_score) and
    `market_performance` (quarter close-to-close stock return, fraction) are
    optional tie-breakers layered on top of the bucket x management-quality
    tone matrix: a wide moat or a quarter the market rewarded nudges the tone
    one step more confident, a thin moat or a quarter the market punished
    nudges it one step more cautious. Either can be omitted (e.g. no prior
    quarter close to diff against) and the base tone matrix is used as-is.

    `previous_concall` (this company's most recent prior ConCall, if any) is
    the sole input needed for multi-quarter trend awareness -- its
    trend_context is chained forward (see _chain_streak) rather than
    re-querying multiple quarters of history. `prior_balance_sheet` /
    `prior_cash_flow` (previous quarter's rows) are used only for the new
    capex/debt commentary's up/down/flat framing.
    """
    eps = float(income_stmt.eps)
    consensus_eps = float(consensus.consensus_eps) if consensus is not None else eps

    bucket = _performance_bucket(eps, consensus_eps)
    mgmt_band = _mgmt_band(management_quality)
    tone = _TONE_MATRIX[(bucket, mgmt_band)]

    tone_nudge = 0
    if moat_score is not None:
        tone_nudge += _tone_nudge_from_score(
            moat_score, MOAT_SCORE_STRONG_THRESHOLD, MOAT_SCORE_WEAK_THRESHOLD
        )
    if market_performance is not None:
        tone_nudge += _tone_nudge_from_score(
            market_performance, MARKET_PERFORMANCE_STRONG_THRESHOLD, MARKET_PERFORMANCE_WEAK_THRESHOLD
        )
    if tone_nudge != 0:
        base_tone = tone
        tone = _nudge_tone(tone, tone_nudge)
        # Nudged tone may not have a template for this bucket (e.g. "beat" has
        # no "defensive"/"evasive" entries) -- walk back toward base_tone,
        # which always has a template, rather than risk a KeyError.
        step_back = -1 if tone_nudge > 0 else 1
        while (bucket, tone) not in _STATEMENT_TEMPLATES and tone != base_tone:
            tone = _nudge_tone(tone, step_back)

    tone_score = TONE_SCORE[tone]

    revenue = float(income_stmt.revenue)
    prior_revenue = float(prior_income_stmt.revenue) if prior_income_stmt is not None else None
    revenue_growth = _revenue_growth_pct(revenue, prior_revenue)

    current_margin = float(income_stmt.gross_profit) / revenue if revenue else None
    prior_margin = (
        float(prior_income_stmt.gross_profit) / float(prior_income_stmt.revenue)
        if prior_income_stmt is not None and float(prior_income_stmt.revenue) > 0
        else None
    )
    margin_direction = _margin_direction(current_margin, prior_margin)

    # Guidance: blend the tone's baseline direction with the quarter's actual
    # growth rate and a mild growth_potential (0-100) tilt, then add small
    # rng jitter so two companies with an identical bucket/tone don't guide
    # to the exact same number. Kept in the same small-magnitude band as
    # other growth deltas in engine.orchestrator (GROWTH_RATE_CLAMP_MIN/MAX
    # is [-0.40, 0.60]) since this is added there as one signal among several.
    growth_potential_tilt = (growth_potential - 50.0) / 100.0  # roughly [-0.5, 0.5]
    guidance_revenue_growth = max(
        -0.25,
        min(
            0.25,
            (tone_score * 0.05) + (revenue_growth * 0.3) + (growth_potential_tilt * 0.05) + rng.gauss(0, 0.01),
        ),
    )

    # driver_deltas: effect_profile-shaped dict mirroring MarketEvent's
    # convention (see db/models/events.py, db/seeds/seed_events.py), scaled
    # down since this is a routine quarterly signal rather than a discrete
    # news event -- kept small enough that it never dominates event-driven
    # moves if a future consumer applies it the same way.
    driver_deltas = {
        "guidance": round(tone_score * 0.15, 4),
        "earnings_surprise": round(
            max(-0.5, min(0.5, (eps - consensus_eps) / abs(consensus_eps) if consensus_eps else 0.0)) * 0.3, 4
        ),
    }

    replacements = {
        "{company}": company.name,
        "{revenue_growth_pct}": f"{revenue_growth * 100:+.1f}%",
        "{eps}": f"{eps:.2f}",
        "{consensus_eps}": f"{consensus_eps:.2f}",
        "{margin_direction}": margin_direction,
    }
    template = _STATEMENT_TEMPLATES[(bucket, tone)]
    statements: dict[str, str] = {}
    for section, text in template.items():
        rendered = text
        for key, val in replacements.items():
            rendered = rendered.replace(key, val)
        statements[section] = rendered

    if market_performance is not None:
        statements["market_context"] = _market_context_statement(company.name, market_performance)

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
