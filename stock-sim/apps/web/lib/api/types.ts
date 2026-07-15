// Hand-written TypeScript types mirroring apps/api/schemas.py exactly.
// Decimal -> number, date -> string (ISO date), datetime -> string (ISO datetime).

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface MessageResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export type OtpPurpose = "login" | "register" | "password_reset";

export interface OtpRequestBody {
  purpose: OtpPurpose;
  email?: string;
}

export interface OtpVerifyBody {
  purpose: OtpPurpose;
  code: string;
  email?: string;
}

export interface OtpVerifyResponse {
  verified: boolean;
  reason?: "invalid" | "expired" | "locked";
  attempts_remaining?: number;
}

export interface UserCreateRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface UserResponse {
  id: number;
  email: string;
  display_name: string;
  role: string;
  starting_cash: number;
}

// ---------------------------------------------------------------------------
// Market Data
// ---------------------------------------------------------------------------

export interface CompanyGridItem {
  ticker: string;
  name: string;
  industry_name: string;
  current_price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  intrinsic_value: number | null;
  market_cap: number | null;
  volatility: number | null;
  avg_volume_20d: number | null;
  high_52w: number | null;
  low_52w: number | null;
}

export interface MarketGridResponse {
  companies: CompanyGridItem[];
  sim_date: string;
  cycle_phase: string;
}

export interface PriceHistoryItem {
  sim_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  intrinsic_value: number | null;
}

export interface DriverBreakdown {
  driver_key: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface CompanyDetail {
  id: number;
  ticker: string;
  name: string;
  industry_name: string;
  description: string | null;
  logo_url: string | null;
  shares_outstanding: number;
  free_float_pct: number;
  latest_price: number | null;
  latest_iv: number | null;
  pe_ratio: number | null;
  market_cap: number | null;
  driver_breakdowns: DriverBreakdown[];
}

export interface FinancialStatementResponse {
  fiscal_period: string;
  income_statement: Record<string, unknown> | null;
  balance_sheet: Record<string, unknown> | null;
  cash_flow_statement: Record<string, unknown> | null;
}

export interface ValuationResponse {
  intrinsic_value: number;
  fair_pe: number;
  intrinsic_score: number;
  management_quality: number;
  moat_score: number;
  financial_quality: number;
  fcf_quality: number;
  growth_potential: number;
}

export interface CycleStateResponse {
  sim_date: string;
  cycle_phase: string;
  market_factor_return: number;
  gdp_growth: number;
  interest_rate: number;
  market_sentiment: number;
}

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

export type OrderSide = "buy" | "sell";

export interface OrderRequest {
  ticker: string;
  side: OrderSide;
  quantity: number;
  timeline_id?: number;
}

export interface OrderResponse {
  id: number;
  portfolio_id: number;
  company_id: number;
  sim_date: string;
  side: string;
  quantity: number;
  price: number;
  fees: number;
  realized_pnl: number | null;
}

export interface HoldingResponse {
  ticker: string;
  company_name: string;
  quantity: number;
  avg_cost_basis: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

export interface PortfolioResponse {
  id: number;
  cash_balance: number;
  total_value: number;
  holdings: HoldingResponse[];
  day_change_pct: number | null;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  pct: number;
}

export interface PortfolioAnalyticsResponse {
  total_value: number;
  cash_balance: number;
  total_return_pct: number;
  unrealized_pnl: number;
  realized_pnl: number;
  num_positions: number;
  win_rate: number | null;
  allocation_by_sector: SectorAllocation[];
  cash_allocation_pct: number;
}

export interface TransactionItem {
  id: number;
  sim_date: string;
  ticker: string;
  side: string;
  quantity: number;
  price: number;
  realized_pnl: number | null;
}

export interface WatchlistAddRequest {
  company_id: number;
}

export interface WatchlistItem {
  company_id: number;
  ticker: string;
  name: string;
}

export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  total_value: number;
  return_pct: number;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export interface NewsItem {
  id: number;
  sim_date: string;
  headline: string;
  body: string;
  sentiment: string;
  severity: number;
  company_name: string | null;
  industry_name: string | null;
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export interface AdvanceRequest {
  timeline_id?: number;
  days?: number;
}

export interface AdvanceResponse {
  ticks_executed: number;
  new_sim_date: string;
  tick_count: number;
  cycle_phase: string | null;
}

export interface TimelineCreateRequest {
  name: string;
  parent_timeline_id: number;
  branch_point_sim_date: string;
  rng_seed?: number | null;
  scenario_overrides?: Record<string, unknown> | null;
}

export interface TimelineResponse {
  id: number;
  name: string;
  is_live: boolean;
  parent_timeline_id: number | null;
  branch_point_sim_date: string | null;
  created_at: string;
}

export interface EventInjectRequest {
  event_id: number;
  timeline_id?: number;
  scope_type: string;
  scope_ref: number;
  sim_date?: string | null;
  severity_override?: number | null;
}

export interface EventInstanceResponse {
  id: number;
  event_id: number;
  timeline_id: number;
  scope_type: string;
  scope_ref: number;
  sim_date: string;
  resolved_severity: number;
  expires_on: string;
}

export interface ConfigUpdateRequest {
  key: string;
  value: string;
  scope?: string;
  scope_id?: number | null;
}

export interface ConfigParameterResponse {
  key: string;
  value: string;
  scope: string;
  scope_id: number | null;
  description: string | null;
}

export interface SimulationStateResponse {
  timeline_id: number;
  current_sim_date: string;
  tick_count: number;
  is_running: boolean;
}
