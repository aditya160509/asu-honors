from typing import Optional

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.models.base import Base, TimestampMixin


class Industry(Base, TimestampMixin):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String)
    base_volatility: Mapped[float] = mapped_column(Numeric)
    cycle_sensitivity: Mapped[float] = mapped_column(Numeric)
    sector_beta_default: Mapped[float] = mapped_column(Numeric)
    subfactor_set: Mapped[str] = mapped_column(String(20), default="standard")

    companies: Mapped[list["Company"]] = relationship(back_populates="industry")
    pillar_weights: Mapped[list["IndustryPillarWeight"]] = relationship(back_populates="industry")
    factor_weights: Mapped[list["IndustryFactorWeight"]] = relationship(back_populates="industry")

    __table_args__ = (
        CheckConstraint("subfactor_set in ('standard', 'financials')", name="ck_industries_subfactor_set"),
    )


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    ticker: Mapped[str] = mapped_column(String(16), nullable=False, unique=True)
    industry_id: Mapped[int] = mapped_column(ForeignKey("industries.id", ondelete="RESTRICT"), nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String)
    usp: Mapped[Optional[str]] = mapped_column(String)
    employee_count: Mapped[Optional[int]] = mapped_column(BigInteger)
    founded_year: Mapped[Optional[int]] = mapped_column()
    headquarters: Mapped[Optional[str]] = mapped_column(String(120))
    ceo: Mapped[Optional[str]] = mapped_column(String(120))
    shares_outstanding: Mapped[int] = mapped_column(BigInteger)
    free_float_pct: Mapped[float] = mapped_column(Numeric)
    beta_market: Mapped[float] = mapped_column(Numeric(10, 4))
    beta_sector: Mapped[float] = mapped_column(Numeric(10, 4))

    # Denormalized latest values; source of truth lives in the time-series tables.
    current_price: Mapped[Optional[float]] = mapped_column(Numeric)
    intrinsic_value: Mapped[Optional[float]] = mapped_column(Numeric)
    intrinsic_score: Mapped[Optional[float]] = mapped_column(Numeric)
    fair_pe: Mapped[Optional[float]] = mapped_column(Numeric)
    market_cap: Mapped[Optional[float]] = mapped_column(Numeric)
    volatility: Mapped[Optional[float]] = mapped_column(Numeric)
    market_liquidity_score: Mapped[Optional[float]] = mapped_column(Numeric)

    industry: Mapped["Industry"] = relationship(back_populates="companies")

    __table_args__ = (
        CheckConstraint("free_float_pct >= 0 and free_float_pct <= 1", name="ck_companies_free_float_pct"),
        CheckConstraint(
            "intrinsic_score is null or (intrinsic_score >= 0 and intrinsic_score <= 100)",
            name="ck_companies_intrinsic_score_range",
        ),
    )


class FactorDefinition(Base, TimestampMixin):
    __tablename__ = "factor_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    factor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    pillar: Mapped[Optional[str]] = mapped_column(String(40))
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    formula_ref: Mapped[str] = mapped_column(String(80), nullable=False)
    default_weight: Mapped[Optional[float]] = mapped_column(Numeric)
    value_range: Mapped[Optional[str]] = mapped_column(String(20))

    __table_args__ = (
        CheckConstraint(
            "factor_type in ('intrinsic_top', 'moat_sub', 'fq_sub', 'price_driver')",
            name="ck_factor_definitions_factor_type",
        ),
        CheckConstraint(
            "direction in ('higher_better', 'lower_better', 'mid_band')",
            name="ck_factor_definitions_direction",
        ),
    )


class IndustryPillarWeight(Base, TimestampMixin):
    """Sum of weight per industry across pillars must equal 1.0.

    Not expressible as a single-row CHECK constraint in standard SQL; enforce
    at the application layer (e.g. a validation step on seed/config load).
    """

    __tablename__ = "industry_pillar_weights"

    id: Mapped[int] = mapped_column(primary_key=True)
    industry_id: Mapped[int] = mapped_column(ForeignKey("industries.id", ondelete="CASCADE"), nullable=False)
    pillar: Mapped[str] = mapped_column(String(40), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric, nullable=False)

    industry: Mapped["Industry"] = relationship(back_populates="pillar_weights")

    __table_args__ = (
        UniqueConstraint("industry_id", "pillar", name="uq_industry_pillar_weights_industry_pillar"),
        CheckConstraint("weight >= 0 and weight <= 1", name="ck_industry_pillar_weights_weight_range"),
    )


class IndustryFactorWeight(Base, TimestampMixin):
    __tablename__ = "industry_factor_weights"

    id: Mapped[int] = mapped_column(primary_key=True)
    industry_id: Mapped[int] = mapped_column(ForeignKey("industries.id", ondelete="CASCADE"), nullable=False)
    factor_key: Mapped[str] = mapped_column(String(80), ForeignKey("factor_definitions.key"), nullable=False)
    weight: Mapped[float] = mapped_column(Numeric, nullable=False)

    industry: Mapped["Industry"] = relationship(back_populates="factor_weights")

    __table_args__ = (
        UniqueConstraint("industry_id", "factor_key", name="uq_industry_factor_weights_industry_factor"),
        CheckConstraint("weight >= 0 and weight <= 1", name="ck_industry_factor_weights_weight_range"),
    )


class ConfigParameter(Base, TimestampMixin):
    __tablename__ = "config_parameters"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    value: Mapped[str] = mapped_column(String, nullable=False)
    scope: Mapped[str] = mapped_column(String(20), nullable=False, default="global")
    scope_id: Mapped[Optional[int]] = mapped_column()
    description: Mapped[Optional[str]] = mapped_column(String)

    __table_args__ = (
        UniqueConstraint("key", "scope", "scope_id", name="uq_config_parameters_key_scope"),
        CheckConstraint("scope in ('global', 'industry', 'company')", name="ck_config_parameters_scope"),
    )
