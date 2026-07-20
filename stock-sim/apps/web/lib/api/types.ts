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
  id: number;
  ticker: string;
  name: string;
  industry_name: string;
  current_price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  intrinsic_value: number | null;
  market_cap: number | null;
  volatility: number | null;
  market_liquidity_score: number | null;
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
  usp: string | null;
  employee_count: number | null;
  founded_year: number | null;
  headquarters: string | null;
  ceo: string | null;
  shares_outstanding: number;
  free_float_pct: number;
  latest_price: number | null;
  latest_iv: number | null;
  pe_ratio: number | null;
  market_cap: number | null;
  volatility: number | null;
  market_liquidity_score: number | null;
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

export interface CompanyDividendItem {
  declared_date: string;
  ex_date: string;
  payment_date: string;
  amount_per_share: number;
}

export interface CompanyDividendsResponse {
  history: CompanyDividendItem[];
  trailing_12m_yield_pct: number | null;
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
export type OrderType = "market" | "limit";
export type OrderStatus = "open" | "filled" | "cancelled";

export interface OrderRequest {
  ticker: string;
  side: OrderSide;
  order_type?: OrderType;
  quantity: number;
  limit_price?: number;
  timeline_id?: number;
}

export interface OrderResponse {
  id: number;
  portfolio_id: number;
  company_id: number;
  ticker: string;
  sim_date: string;
  side: string;
  order_type: OrderType;
  status: OrderStatus;
  quantity: number;
  filled_quantity: number;
  limit_price: number | null;
  /** Avg fill price / fees — null while the order is still open. */
  price: number | null;
  fees: number | null;
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
  beta: number | null;
  sharpe_ratio: number | null;
  volatility_pct: number | null;
  max_drawdown_pct: number | null;
}

export interface TransactionItem {
  id: number;
  sim_date: string;
  ticker: string;
  side: string;
  quantity: number;
  price: number;
  fees: number;
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

// ---------------------------------------------------------------------------
// Portfolio Phase 2 — history, dividends, goals, named watchlists
// ---------------------------------------------------------------------------

export type PerformanceRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";

export interface PortfolioHistoryPoint {
  sim_date: string;
  total_value: number;
  cash: number;
  holdings_value: number;
}

export interface BenchmarkPoint {
  sim_date: string;
  value: number;
}

export interface PortfolioHistoryResponse {
  range: string;
  points: PortfolioHistoryPoint[];
  benchmark: BenchmarkPoint[];
}

export interface DividendReceipt {
  ticker: string;
  company_name: string;
  declared_date: string;
  ex_date: string;
  payment_date: string;
  amount_per_share: number;
  shares_held: number;
  total_amount: number;
}

export interface UpcomingDividend {
  ticker: string;
  company_name: string;
  declared_date: string;
  ex_date: string;
  payment_date: string;
  amount_per_share: number;
  shares_held: number;
  estimated_total: number;
}

export interface PortfolioDividendsResponse {
  received: DividendReceipt[];
  upcoming: UpcomingDividend[];
  total_received: number;
  trailing_12m_received: number;
}

export interface GoalCreateRequest {
  label: string;
  target_value: number;
  target_date: string;
}

export interface GoalUpdateRequest {
  label?: string;
  target_value?: number;
  target_date?: string;
}

export interface GoalResponse {
  id: number;
  label: string;
  target_value: number;
  target_date: string;
  achieved_at: string | null;
  created_at: string;
  current_value: number;
  progress_pct: number;
}

export interface WatchlistEntry {
  company_id: number;
  ticker: string;
  name: string;
  sort_order: number;
}

export interface WatchlistGroupResponse {
  id: number;
  name: string;
  sort_order: number;
  items: WatchlistEntry[];
}

export interface TransactionFilters {
  ticker?: string;
  side?: "buy" | "sell";
  date_from?: string;
  date_to?: string;
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
  news_type: string;
  company_name: string | null;
  industry_name: string | null;
}

// ---------------------------------------------------------------------------
// Con-Calls
// ---------------------------------------------------------------------------

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

export type TimelinePrimitive =
  | "manual"
  | "structural_override"
  | "macro_shock"
  | "sensitivity_sweep"
  | "monte_carlo"
  | "liquidity_scenario";

export type TimelineOverrideTargetType =
  | "factor_score"
  | "config"
  | "event"
  | "cycle_transition"
  | "driver_bias";

export interface TimelineOverrideSpec {
  target_type: TimelineOverrideTargetType;
  target_key: string;
  override_value: string;
  effective_from_sim_date: string;
  target_scope_id?: number | null;
  effective_to_sim_date?: string | null;
}

export interface TimelineCreateRequest {
  name: string;
  parent_timeline_id: number;
  branch_point_sim_date: string;
  rng_seed?: number | null;
  primitive?: TimelinePrimitive;
  overrides?: TimelineOverrideSpec[] | null;
  fast_forward_days?: number;
}

export interface TimelineResponse {
  id: number;
  name: string;
  is_live: boolean;
  parent_timeline_id: number | null;
  branch_point_sim_date: string | null;
  primitive: TimelinePrimitive | null;
  status: "pending" | "running" | "ready" | "failed" | "archived";
  pinned: boolean;
  timeline_group_id: number | null;
  created_at: string;
}

export interface BranchCostEstimateResponse {
  fast_forward_days: number;
  company_count: number;
  estimated_compute_ms: number;
}

export interface TimelineStatusResponse {
  id: number;
  status: TimelineResponse["status"];
  current_sim_date: string | null;
  tick_count: number | null;
  last_touched_at: string | null;
}

export interface TimelineDiffEntry {
  target_type: TimelineOverrideTargetType;
  target_key: string;
  target_scope_id: number | null;
  left_value: string | null;
  right_value: string | null;
}

export interface TimelineDiffResponse {
  left_timeline_id: number;
  right_timeline_id: number;
  entries: TimelineDiffEntry[];
}

export interface TimelineExtendRequest {
  days: number;
}

export interface TimelineGroupResponse {
  id: number;
  primitive: "sensitivity_sweep" | "monte_carlo";
  label: string | null;
  owner_user_id: number | null;
  created_at: string;
  member_timeline_ids: number[];
}

export interface DistributionResponse {
  metric: string;
  count: number;
  mean: number | null;
  median: number | null;
  percentiles: Record<string, number>;
  histogram_bins: number[];
  histogram_counts: number[];
}

export type ScenarioTemplateCategory = "macro" | "sector" | "company" | "liquidity";

export interface ScenarioTemplateResponse {
  id: number;
  name: string;
  description: string | null;
  category: ScenarioTemplateCategory;
  effect_profile: Record<string, unknown>;
  default_duration_days: number | null;
  editable_params: Record<string, unknown> | null;
  created_at: string;
}

export interface ScenarioTemplateCreateRequest {
  name: string;
  description?: string | null;
  category: ScenarioTemplateCategory;
  effect_profile: Record<string, unknown>;
  default_duration_days?: number | null;
  editable_params?: Record<string, unknown> | null;
}

export interface AuditLogEntryResponse {
  id: number;
  actor_user_id: number | null;
  action: string;
  timeline_id: number | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
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
