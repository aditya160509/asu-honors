from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.models.base import Base, TimestampMixin, utcnow


class CompanyFactorScore(Base, TimestampMixin):
    __tablename__ = "company_factor_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(10), nullable=False)
    management_quality: Mapped[float] = mapped_column(Numeric, nullable=False)
    moat_score: Mapped[float] = mapped_column(Numeric, nullable=False)
    financial_quality: Mapped[float] = mapped_column(Numeric, nullable=False)
    fcf_quality: Mapped[float] = mapped_column(Numeric, nullable=False)
    growth_potential: Mapped[float] = mapped_column(Numeric, nullable=False)
    intrinsic_score: Mapped[float] = mapped_column(Numeric, nullable=False)
    fair_pe: Mapped[float] = mapped_column(Numeric, nullable=False)
    intrinsic_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Snapshot of {field} as of the last quarterly refresh, never touched by
    # event effects. management_quality/growth_potential/fcf_quality have no
    # other source of truth to re-derive from (unlike moat_score/
    # financial_quality, which are normally recomputed fresh from MoatSubscore/
    # FinancialQualitySubscore), so event-driven deltas are computed against
    # this base each tick rather than compounding on the mutated effective
    # column -- see engine.orchestrator._apply_factor_effects_to_company.
    management_quality_base: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    growth_potential_base: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    fcf_quality_base: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    # moat_score/financial_quality are normally re-derived fresh from
    # MoatSubscore/FinancialQualitySubscore each tick, so they don't need
    # these to avoid compounding in the common case -- but a company with no
    # subscore rows yet has nothing to re-derive from, so these serve as the
    # same fallback anchor for that edge case (see
    # _apply_factor_effects_to_company and
    # _apply_timeline_factor_score_overrides in engine/orchestrator.py).
    moat_score_base: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    financial_quality_base: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "company_id", "fiscal_period", "timeline_id", name="uq_company_factor_scores_company_period"
        ),
        CheckConstraint(
            "management_quality >= 0 and management_quality <= 100", name="ck_cfs_management_quality_range"
        ),
        CheckConstraint("moat_score >= 0 and moat_score <= 100", name="ck_cfs_moat_score_range"),
        CheckConstraint(
            "financial_quality >= 0 and financial_quality <= 100", name="ck_cfs_financial_quality_range"
        ),
        CheckConstraint("fcf_quality >= 0 and fcf_quality <= 100", name="ck_cfs_fcf_quality_range"),
        CheckConstraint(
            "growth_potential >= 0 and growth_potential <= 100", name="ck_cfs_growth_potential_range"
        ),
        CheckConstraint("intrinsic_score >= 0 and intrinsic_score <= 100", name="ck_cfs_intrinsic_score_range"),
        # branch_service.create_branch clones every row for a parent
        # timeline via filter_by(timeline_id=parent_id) -- unsupported by
        # the company_id-leading UniqueConstraint above, so it degrades to a
        # sequential scan as history grows, independent of company count.
        Index("ix_company_factor_scores_timeline_id", "timeline_id"),
    )


class MoatSubscore(Base, TimestampMixin):
    __tablename__ = "moat_subscores"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    subfactor_key: Mapped[str] = mapped_column(String(80), nullable=False)
    score: Mapped[float] = mapped_column(Numeric, nullable=False)
    # Undecayed value as of seed time / last explicit reset, never touched by
    # event effects -- see CompanyFactorScore's *_base columns for the same pattern.
    score_base: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "company_id", "subfactor_key", "timeline_id", name="uq_moat_subscores_company_subfactor"
        ),
        CheckConstraint("score >= 0 and score <= 100", name="ck_moat_subscores_score_range"),
        Index("ix_moat_subscores_timeline_id", "timeline_id"),
    )


class FinancialQualitySubscore(Base, TimestampMixin):
    __tablename__ = "financial_quality_subscores"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    timeline_id: Mapped[int] = mapped_column(ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    fiscal_period: Mapped[str] = mapped_column(String(10), nullable=False)
    subfactor_key: Mapped[str] = mapped_column(String(80), nullable=False)
    raw_metric_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    peer_percentile: Mapped[float] = mapped_column(Numeric, nullable=False)
    subscore: Mapped[float] = mapped_column(Numeric, nullable=False)
    applied_weight: Mapped[float] = mapped_column(Numeric, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "fiscal_period",
            "subfactor_key",
            "timeline_id",
            name="uq_fq_subscores_company_period_subfactor",
        ),
        CheckConstraint("peer_percentile >= 0 and peer_percentile <= 100", name="ck_fq_subscores_percentile_range"),
        CheckConstraint("subscore >= 0 and subscore <= 100", name="ck_fq_subscores_subscore_range"),
        CheckConstraint("applied_weight >= 0 and applied_weight <= 1", name="ck_fq_subscores_weight_range"),
        Index("ix_financial_quality_subscores_timeline_id", "timeline_id"),
    )
