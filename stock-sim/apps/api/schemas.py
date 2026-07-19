"""Pydantic request/response models for the API (Phase 5 plan section 2)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# --------------------------------------------------------------------------
# 2.1 Auth Schemas
# --------------------------------------------------------------------------


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 bytes")
        return v


class OtpRequestBody(BaseModel):
    purpose: str
    # For pre-authentication purposes (register verification) the caller identifies
    # the account by email; authenticated purposes ignore this and use the token.
    email: Optional[str] = None


class OtpVerifyBody(BaseModel):
    purpose: str
    code: str
    email: Optional[str] = None


class OtpVerifyResponse(BaseModel):
    verified: bool


class MessageResponse(BaseModel):
    message: str


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
    id: int
    ticker: str
    name: str
    industry_name: str
    current_price: Decimal
    prev_close: Optional[Decimal] = None
    day_change_pct: Optional[float] = None
    intrinsic_value: Optional[Decimal] = None
    market_cap: Optional[Decimal] = None
    volatility: Optional[Decimal] = None
    market_liquidity_score: Optional[Decimal] = None
    avg_volume_20d: Optional[int] = None
    high_52w: Optional[Decimal] = None
    low_52w: Optional[Decimal] = None


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
    usp: Optional[str] = None
    employee_count: Optional[int] = None
    founded_year: Optional[int] = None
    headquarters: Optional[str] = None
    ceo: Optional[str] = None
    shares_outstanding: int
    free_float_pct: float
    latest_price: Optional[Decimal] = None
    latest_iv: Optional[Decimal] = None
    pe_ratio: Optional[float] = None
    market_cap: Optional[Decimal] = None
    volatility: Optional[Decimal] = None
    market_liquidity_score: Optional[Decimal] = None
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
    order_type: str = "market"
    quantity: int
    limit_price: Optional[Decimal] = None
    timeline_id: int = 1

    @field_validator("side")
    @classmethod
    def side_valid(cls, v: str) -> str:
        if v not in ("buy", "sell"):
            raise ValueError("side must be 'buy' or 'sell'")
        return v

    @field_validator("order_type")
    @classmethod
    def order_type_valid(cls, v: str) -> str:
        if v not in ("market", "limit"):
            raise ValueError("order_type must be 'market' or 'limit'")
        return v

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v

    @model_validator(mode="after")
    def limit_requires_price(self) -> "OrderRequest":
        if self.order_type == "limit" and self.limit_price is None:
            raise ValueError("limit_price is required for limit orders")
        return self


class OrderResponse(BaseModel):
    id: int
    portfolio_id: int
    company_id: int
    ticker: str
    sim_date: date
    side: str
    order_type: str = "market"
    status: str = "filled"
    quantity: int
    filled_quantity: int = 0
    limit_price: Optional[Decimal] = None
    # Avg fill price / fees — populated once filled, null while an order is still open.
    price: Optional[Decimal] = None
    fees: Optional[Decimal] = None
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


class SectorAllocation(BaseModel):
    sector: str
    value: Decimal
    pct: float


class PortfolioAnalyticsResponse(BaseModel):
    total_value: Decimal
    cash_balance: Decimal
    total_return_pct: float
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    num_positions: int
    win_rate: Optional[float] = None
    allocation_by_sector: list[SectorAllocation]
    cash_allocation_pct: float
    # Risk metrics derived from the reconstructed daily portfolio-value series.
    # None (not zero) whenever there is insufficient history to compute them.
    beta: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    volatility_pct: Optional[float] = None
    max_drawdown_pct: Optional[float] = None


class TransactionItem(BaseModel):
    id: int
    sim_date: date
    ticker: str
    side: str
    quantity: int
    price: Decimal
    fees: Decimal
    realized_pnl: Optional[Decimal] = None


# --------------------------------------------------------------------------
# Phase 2 — Portfolio history, dividends, goals, named watchlists
# --------------------------------------------------------------------------


class PortfolioHistoryPoint(BaseModel):
    sim_date: date
    total_value: Decimal
    cash: Decimal
    holdings_value: Decimal


class BenchmarkPoint(BaseModel):
    sim_date: date
    value: Decimal


class PortfolioHistoryResponse(BaseModel):
    range: str
    points: list[PortfolioHistoryPoint]
    # Equal-weight market composite (avg close across all companies in the
    # timeline) — the only benchmark the sim data model supports today.
    benchmark: list[BenchmarkPoint]


class DividendReceipt(BaseModel):
    ticker: str
    company_name: str
    declared_date: date
    ex_date: date
    payment_date: date
    amount_per_share: Decimal
    shares_held: int
    total_amount: Decimal


class UpcomingDividend(BaseModel):
    ticker: str
    company_name: str
    declared_date: date
    ex_date: date
    payment_date: date
    amount_per_share: Decimal
    shares_held: int
    estimated_total: Decimal


class PortfolioDividendsResponse(BaseModel):
    received: list[DividendReceipt]
    upcoming: list[UpcomingDividend]
    total_received: Decimal
    trailing_12m_received: Decimal


class CompanyDividendItem(BaseModel):
    declared_date: date
    ex_date: date
    payment_date: date
    amount_per_share: Decimal


class CompanyDividendsResponse(BaseModel):
    history: list[CompanyDividendItem]
    trailing_12m_yield_pct: Optional[float] = None


class GoalCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    target_value: Decimal = Field(gt=0)
    target_date: date


class GoalUpdateRequest(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=60)
    target_value: Optional[Decimal] = Field(default=None, gt=0)
    target_date: Optional[date] = None


class GoalResponse(BaseModel):
    id: int
    label: str
    target_value: Decimal
    target_date: date
    achieved_at: Optional[datetime] = None
    created_at: datetime
    current_value: Decimal
    progress_pct: float


class WatchlistEntry(BaseModel):
    company_id: int
    ticker: str
    name: str
    sort_order: int


class WatchlistGroupResponse(BaseModel):
    id: int
    name: str
    sort_order: int
    items: list[WatchlistEntry]


class WatchlistGroupCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class WatchlistGroupRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class WatchlistReorderRequest(BaseModel):
    company_ids: list[int]


class WatchlistAddRequest(BaseModel):
    company_id: int


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
    news_type: str = "both"
    company_name: Optional[str] = None
    industry_name: Optional[str] = None


# --------------------------------------------------------------------------
# 2.4b Con-Call Schemas
# --------------------------------------------------------------------------


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
