"""Pydantic request/response models for the API (Phase 5 plan section 2)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# --------------------------------------------------------------------------
# 2.1 Auth Schemas
# --------------------------------------------------------------------------


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreateRequest(BaseModel):
    email: str
    password: str
    display_name: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 bytes")
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    starting_cash: Decimal

    model_config = {"from_attributes": True}


# --------------------------------------------------------------------------
# 2.2 Market Data Schemas
# --------------------------------------------------------------------------


class CompanyGridItem(BaseModel):
    ticker: str
    name: str
    industry_name: str
    current_price: Decimal
    prev_close: Optional[Decimal] = None
    day_change_pct: Optional[float] = None
    intrinsic_value: Optional[Decimal] = None
    market_cap: Optional[Decimal] = None
    volatility: Optional[Decimal] = None


class MarketGridResponse(BaseModel):
    companies: list[CompanyGridItem]
    sim_date: date
    cycle_phase: str


class PriceHistoryItem(BaseModel):
    sim_date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    intrinsic_value: Optional[Decimal] = None


class DriverBreakdown(BaseModel):
    driver_key: str
    value: float
    weight: float
    contribution: float


class CompanyDetail(BaseModel):
    id: int
    ticker: str
    name: str
    industry_name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    shares_outstanding: int
    free_float_pct: float
    latest_price: Optional[Decimal] = None
    latest_iv: Optional[Decimal] = None
    pe_ratio: Optional[float] = None
    market_cap: Optional[Decimal] = None
    driver_breakdowns: list[DriverBreakdown] = Field(default_factory=list)


class FinancialStatementResponse(BaseModel):
    fiscal_period: str
    income_statement: Optional[dict] = None
    balance_sheet: Optional[dict] = None
    cash_flow_statement: Optional[dict] = None


class ValuationResponse(BaseModel):
    intrinsic_value: Decimal
    fair_pe: Decimal
    intrinsic_score: float
    management_quality: float
    moat_score: float
    financial_quality: float
    fcf_quality: float
    growth_potential: float


class CycleStateResponse(BaseModel):
    sim_date: date
    cycle_phase: str
    market_factor_return: float
    gdp_growth: float
    interest_rate: float
    market_sentiment: float


# --------------------------------------------------------------------------
# 2.3 Trading Schemas
# --------------------------------------------------------------------------


class OrderRequest(BaseModel):
    ticker: str
    side: str
    quantity: int
    order_type: str = "market"
    timeline_id: int = 1

    @field_validator("side")
    @classmethod
    def side_valid(cls, v: str) -> str:
        if v not in ("buy", "sell"):
            raise ValueError("side must be 'buy' or 'sell'")
        return v

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v


class OrderResponse(BaseModel):
    id: int
    portfolio_id: int
    company_id: int
    sim_date: date
    side: str
    quantity: int
    price: Decimal
    fees: Decimal
    realized_pnl: Optional[Decimal] = None


class HoldingResponse(BaseModel):
    ticker: str
    company_name: str
    quantity: int
    avg_cost_basis: Decimal
    current_price: Decimal
    market_value: Decimal
    unrealized_pnl: Decimal
    unrealized_pnl_pct: float


class PortfolioResponse(BaseModel):
    id: int
    cash_balance: Decimal
    total_value: Decimal
    holdings: list[HoldingResponse]
    day_change_pct: Optional[float] = None


class TransactionItem(BaseModel):
    id: int
    sim_date: date
    ticker: str
    side: str
    quantity: int
    price: Decimal
    realized_pnl: Optional[Decimal] = None


class WatchlistItem(BaseModel):
    company_id: int
    ticker: str
    name: str


class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    total_value: Decimal
    return_pct: float


# --------------------------------------------------------------------------
# 2.4 News Schemas
# --------------------------------------------------------------------------


class NewsItem(BaseModel):
    id: int
    sim_date: date
    headline: str
    body: str
    sentiment: str
    severity: float
    company_name: Optional[str] = None
    industry_name: Optional[str] = None


# --------------------------------------------------------------------------
# 2.5 Simulation Schemas
# --------------------------------------------------------------------------


class AdvanceRequest(BaseModel):
    timeline_id: int = 1
    days: int = 1

    @field_validator("days")
    @classmethod
    def days_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("days must be positive")
        return v


class AdvanceResponse(BaseModel):
    ticks_executed: int
    new_sim_date: date
    tick_count: int
    cycle_phase: Optional[str] = None


class TimelineCreateRequest(BaseModel):
    name: str
    parent_timeline_id: int
    branch_point_sim_date: date
    rng_seed: Optional[int] = None
    scenario_overrides: Optional[dict] = None


class TimelineResponse(BaseModel):
    id: int
    name: str
    is_live: bool
    parent_timeline_id: Optional[int] = None
    branch_point_sim_date: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EventInjectRequest(BaseModel):
    event_id: int
    timeline_id: int = 1
    scope_type: str
    scope_ref: int
    sim_date: Optional[date] = None
    severity_override: Optional[float] = None


class EventInstanceResponse(BaseModel):
    id: int
    event_id: int
    timeline_id: int
    scope_type: str
    scope_ref: int
    sim_date: date
    resolved_severity: float
    expires_on: date

    model_config = {"from_attributes": True}


class ConfigUpdateRequest(BaseModel):
    key: str
    value: str
    scope: str = "global"
    scope_id: Optional[int] = None


class ConfigParameterResponse(BaseModel):
    key: str
    value: str
    scope: str
    scope_id: Optional[int] = None
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class SimulationStateResponse(BaseModel):
    timeline_id: int
    current_sim_date: date
    tick_count: int
    is_running: bool
