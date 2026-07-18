"""Section 6.O -- quarterly conference-call (con-call / earnings-call) records.

One ConCall row is created per (company_id, fiscal_period) at the same quarter
boundary where engine.orchestrator._refresh_fundamentals generates that
quarter's IncomeStatement/BalanceSheet/CashFlowStatement rows -- see
engine/concalls.py for the generation logic and
engine.orchestrator._refresh_fundamentals for the call site.

The `guidance_revenue_growth` and `tone_score` fields are the forward-looking
signal this subsystem hands to the next quarter's financial generation: they
are read back by engine.orchestrator._load_concall_guidance_signal (see
"guidance_signal" plumbed into _generate_fake_quarterly_financials) as one of
several small inputs to next quarter's revenue-growth roll, so a confident/
bullish call nudges next quarter's growth up and a cautious/defensive call
nudges it down. `driver_deltas` mirrors MarketEvent.effect_profile's shape
(a flat dict of DRIVER_KEYS / factor-score-key -> small delta) for any
downstream consumer that wants event-style effects rather than a single
guidance scalar.
"""
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin, utcnow

try:
    from sqlalchemy.dialects.postgresql import JSONB as JSONType
except ImportError:  # pragma: no cover
    from sqlalchemy import JSON as JSONType


class ConCall(Base, TimestampMixin):
    """A quarterly earnings/conference call for one company, one fiscal period.

    Tone and guidance are derived deterministically from that quarter's actual
    financial performance (revenue growth vs. trailing trend, margin
    direction, EPS vs. consensus) and the company's management_quality /
    growth_potential factor scores -- see engine/concalls.py::generate_concall.
    """

    __tablename__ = "con_calls"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(10), nullable=False)
    call_date: Mapped[date] = mapped_column(Date, nullable=False)

    # "beat" | "inline" | "miss" -- EPS vs. ConsensusEstimate.consensus_eps for
    # this fiscal_period, the bucket the template selection is keyed off.
    performance_bucket: Mapped[str] = mapped_column(String(10), nullable=False)

    # "confident" | "measured" | "cautious" | "defensive" | "evasive" -- derived
    # from performance_bucket x management_quality band, see engine/concalls.py.
    tone: Mapped[str] = mapped_column(String(20), nullable=False)

    # Numeric mirror of `tone` on a [-1, 1] scale (confident=+1 .. evasive=-1),
    # the primary field the financials-history workstream reads back as
    # `guidance_signal` (see engine.orchestrator._load_concall_guidance_signal).
    tone_score: Mapped[float] = mapped_column(Numeric, nullable=False)

    # Management's forward-looking next-quarter revenue growth guidance, as a
    # fraction (e.g. 0.03 = +3% QoQ guided). Same [-1, 1]-ish small-magnitude
    # scale as other growth deltas in engine.orchestrator; consumed as an
    # alternate/complementary signal to tone_score.
    guidance_revenue_growth: Mapped[float] = mapped_column(Numeric, nullable=False)

    # Structured management commentary, one short string per talking point
    # (opening remarks, revenue commentary, margin commentary, guidance,
    # closing/Q&A tone) -- rendered by the frontend as a transcript list.
    statements: Mapped[dict] = mapped_column(JSONType, nullable=False)

    # effect_profile-shaped dict of small deltas (DRIVER_KEYS / factor-score
    # keys -> float), mirroring db.models.events.MarketEvent.effect_profile so
    # any future event-style consumer (e.g. _apply_factor_effects_to_company)
    # could apply con-call tone the same way it applies event effects, without
    # requiring this model to know about that mechanism.
    driver_deltas: Mapped[dict] = mapped_column(JSONType, nullable=False)

    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("company_id", "fiscal_period", name="uq_con_calls_company_period"),
        CheckConstraint(
            "performance_bucket in ('beat', 'inline', 'miss')", name="ck_con_calls_performance_bucket"
        ),
        CheckConstraint(
            "tone in ('confident', 'measured', 'cautious', 'defensive', 'evasive')",
            name="ck_con_calls_tone",
        ),
        CheckConstraint("tone_score >= -1 and tone_score <= 1", name="ck_con_calls_tone_score_range"),
    )
