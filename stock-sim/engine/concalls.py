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
