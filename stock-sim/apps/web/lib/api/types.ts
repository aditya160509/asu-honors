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
  display_name?: string;
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

// ---------------------------------------------------------------------------
// Market Explorer / Screener workspace
// ---------------------------------------------------------------------------

export type ScreenerOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains" | "in" | "is_null" | "not_null";

export interface ScreenerUniverse {
  type: "all" | "industry" | "watchlist" | "tickers";
  industry_names?: string[];
  tickers?: string[];
  watchlist_id?: number | null;
}

export interface ScreenerClause {
  metric: string;
  operator: ScreenerOperator;
  value?: string | number | boolean | Array<string | number> | null;
}

export interface ScreenerSort {
  metric: string;
  direction: "asc" | "desc";
}

export interface ScreenerQuery {
  version: number;
  timeline_id: number;
  as_of_date?: string | null;
  universe: ScreenerUniverse;
  logic: "all" | "any";
  clauses: ScreenerClause[];
  sort: ScreenerSort[];
  columns: string[];
  page_size: number;
  offset: number;
  query_text?: string | null;
}

export interface ScreenerMetric {
  key: string;
  label: string;
  aliases: string[];
  category: string;
  unit: string;
  value_type: "number" | "text";
  timeframe: string;
  null_policy: string;
  calculation_version: string;
  operators: string[];
}

export interface ScreenerProvenance {
  source: string;
  source_ids: string[];
  formula?: string | null;
  calculation_version: string;
  timeline_id: number;
  as_of_date: string;
  generated_at: string;
  missing_reason?: string | null;
}

export interface ScreenerRow {
  company: CompanyGridItem;
  metrics: Record<string, string | number | null>;
  ranks: Record<string, number>;
  provenance: Record<string, ScreenerProvenance>;
}

export interface ScreenerQueryResponse {
  rows: ScreenerRow[];
  total: number;
  offset: number;
  page_size: number;
  query: ScreenerQuery;
  query_fingerprint: string;
  timeline_id: number;
  as_of_date: string;
}

export interface ScreenerPreset {
  id: string;
  name: string;
  description: string;
  query: ScreenerQuery;
}

export interface ScreenerHeatmapCell {
  key: string;
  label: string;
  count: number;
  size_value: number | null;
  color_value: number | null;
  color_metric: string;
  size_metric: string;
  query_fingerprint: string;
}

export interface ScreenerRanking {
  ticker: string;
  name: string;
  industry_name: string;
  metric: string;
  value: string | number | null;
  rank: number;
  percentile: number | null;
  provenance: ScreenerProvenance | null;
}

export interface ScreenerHeatmapRequest {
  query: ScreenerQuery;
  color_metric: string;
  size_metric: string;
}

export interface ScreenerRankingRequest {
  query: ScreenerQuery;
  metric: string;
  direction: "asc" | "desc";
  limit: number;
}

export interface ScreenerExposurePoint {
  ticker: string;
  name: string;
  industry_name: string;
  exposures: Record<string, number | null>;
  provenance: Record<string, ScreenerProvenance>;
}

export interface ScreenerNewsCluster {
  theme: string;
  label: string;
  count: number;
  average_severity: number | null;
  sentiment_counts: Record<string, number>;
  first_date: string;
  last_date: string;
  sample_headlines: string[];
  source_ids: string[];
}

export interface ScreenerNewsClustersResponse {
  clusters: ScreenerNewsCluster[];
  timeline_id: number;
  as_of_date: string;
  provenance: ScreenerProvenance;
}

export interface ScreenerTranscriptMatch {
  call_id: number;
  fiscal_period: string;
  call_date: string;
  tone: string;
  tone_score: number;
  section: string;
  snippet: string;
  matched_terms: string[];
  source_ids: string[];
}

export interface ScreenerTranscriptSearchResponse {
  ticker: string;
  query: string;
  matches: ScreenerTranscriptMatch[];
  timeline_id: number;
  as_of_date: string;
  provenance: ScreenerProvenance;
}

export interface ScreenerEventImpact {
  event_instance_id: number;
  event_id: number;
  name: string;
  category: string;
  sentiment: string;
  sim_date: string;
  severity: number;
  return_1d_pct: number | null;
  return_5d_pct: number | null;
  return_20d_pct: number | null;
  source_ids: string[];
}

export interface ScreenerEventImpactResponse {
  ticker: string;
  events: ScreenerEventImpact[];
  timeline_id: number;
  as_of_date: string;
  provenance: ScreenerProvenance;
}

export interface FormulaValue {
  ticker: string;
  value: number | null;
  missing_reason: string | null;
}

export interface FormulaEvaluateResponse {
  formula: string;
  values: FormulaValue[];
  provenance: ScreenerProvenance;
}

export type ScreenerViewMode = "table" | "heatmap" | "rank" | "research" | "notebook" | "correlation" | "breadth" | "exposure";

export interface SavedScreenResponse {
  id: number;
  name: string;
  description: string | null;
  query: ScreenerQuery;
  columns: string[];
  sort: ScreenerSort[];
  view_mode: ScreenerViewMode;
  timeline_id: number;
  as_of_date: string | null;
  visibility: "private" | "shared";
  version: number;
  fingerprint: string;
  created_at: string;
  updated_at: string;
}

export interface DcfRequest {
  revenue_growth?: number;
  ebitda_margin?: number;
  tax_rate?: number;
  reinvestment_rate?: number;
  wacc?: number;
  terminal_growth?: number;
  projection_years?: number;
  net_debt?: number;
  shares_outstanding?: number | null;
  sensitivity_step?: number;
}

export interface DcfSensitivityCell {
  wacc: number;
  terminal_growth: number;
  per_share_value: number | null;
}

export interface DcfResponse {
  ticker: string;
  base_revenue: number;
  enterprise_value: number;
  equity_value: number;
  per_share_value: number | null;
  projected_free_cash_flows: number[];
  assumptions: Required<Omit<DcfRequest, "shares_outstanding">> & { shares_outstanding: number | null };
  sensitivity: DcfSensitivityCell[];
  provenance: ScreenerProvenance;
}

export interface CorrelationResponse {
  tickers: string[];
  dates: string[];
  matrix: Array<Array<number | null>>;
  method: string;
  lookback: number;
  provenance: ScreenerProvenance;
}

export interface BreadthPoint {
  sim_date: string;
  advances: number;
  declines: number;
  unchanged: number;
  new_highs: number;
  new_lows: number;
  above_sma20: number;
  total: number;
}

export interface BreadthResponse {
  points: BreadthPoint[];
  timeline_id: number;
  as_of_date: string;
  provenance: ScreenerProvenance;
}

export interface ResearchNotebookBlockResponse {
  id: number;
  notebook_id: number;
  block_type: string;
  position: number;
  payload: Record<string, unknown>;
  provenance: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ResearchNotebookResponse {
  id: number;
  title: string;
  description: string | null;
  query: Record<string, unknown>;
  visibility: "private" | "shared";
  version: number;
  blocks: ResearchNotebookBlockResponse[];
  created_at: string;
  updated_at: string;
}

export interface ChartAnnotationResponse {
  id: number;
  ticker: string;
  timeline_id: number;
  timeframe: string;
  tool: string;
  anchors: Array<Record<string, unknown>>;
  style: Record<string, unknown>;
  evidence: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
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

export interface DriverHistoryItem extends DriverBreakdown {
  sim_date: string;
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

export type MarketSessionPhase = "closed" | "pre_market" | "open_auction" | "open" | "close_auction" | "after_hours";
export type MarketSessionStatus = "scheduled" | "open" | "halted" | "closed";

export interface MarketSessionResponse {
  id: number;
  timeline_id: number;
  sim_date: string;
  phase: MarketSessionPhase;
  status: MarketSessionStatus;
  session_start: string;
  session_end: string;
  current_tick: number;
  total_ticks: number;
  opening_auction_price: number | null;
  closing_auction_price: number | null;
  halt_reason: string | null;
  halt_until: string | null;
  volatility_pause_count: number;
}

export interface MarketOrderBookLevel {
  price: number;
  quantity: number;
}

export interface MarketOrderBookResponse {
  timeline_id: number;
  company_id: number;
  ticker: string;
  sim_date: string;
  tick_index: number;
  tick_at: string;
  phase: string;
  mid_price: number;
  bid_price: number;
  ask_price: number;
  spread_bps: number;
  bid_size: number;
  ask_size: number;
  volume: number;
  order_imbalance: number;
  slippage_bps: number;
  regime: string;
  is_halted: boolean;
  halt_reason: string | null;
  depth: {
    bids?: MarketOrderBookLevel[];
    asks?: MarketOrderBookLevel[];
    total_bid_depth?: number;
    total_ask_depth?: number;
  };
}

export interface MarketRegimeResponse {
  timeline_id: number;
  sim_date: string;
  regime: string;
  realized_volatility: number;
  market_return: number;
  breadth: number;
  liquidity_index: number;
  drawdown: number;
  sector_leadership: Record<string, number>;
}

export interface MarketNewsBulletinResponse {
  id: number;
  timeline_id: number;
  sim_date: string;
  event_type: string;
  headline: string;
  body: string;
  sentiment: string;
  severity: number;
  source: string;
  source_event_id: number | null;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Trading
// ---------------------------------------------------------------------------

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled";

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
  value_at_risk_pct: number | null;
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

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export interface AdvanceRequest {
  timeline_id?: number;
  days?: number;
  mode?: "interactive" | "bulk";
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
  target_scope_type?: "company" | "industry" | null;
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

export interface EnsembleCreateRequest extends TimelineCreateRequest {
  primitive: "sensitivity_sweep" | "monte_carlo";
  label?: string | null;
  sweep_target_type?: TimelineOverrideTargetType | null;
  sweep_target_key?: string | null;
  sweep_values?: number[] | null;
  member_count?: number;
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
  requested_ticks: number;
  completed_ticks: number;
  progress_pct: number;
  failure_error: string | null;
  recovery_action: string | null;
}

export interface TimelineAnalyticsResponse {
  timeline_id: number;
  market_path: Array<{ sim_date: string; price: number; intrinsic_value: number; volume: number; order_imbalance: number }>;
  breadth: { advancers: number; decliners: number; unchanged: number };
  sector_performance: Array<{ sector: string; return_pct: number; company_count: number }>;
  best_companies: Array<{ company_id: number; ticker: string; name: string; sector: string; return_pct: number; final_close: number; final_intrinsic_value: number }>;
  worst_companies: Array<{ company_id: number; ticker: string; name: string; sector: string; return_pct: number; final_close: number; final_intrinsic_value: number }>;
  annualized_volatility_pct: number | null;
  max_drawdown_pct: number | null;
  volume_change_pct: number | null;
  liquidity_change: number | null;
  risk_decomposition: Array<{ driver_key: string; contribution: number; share_pct: number }>;
  comparison: { timeline_id: number; mean_price_delta_pct: number | null; companies_compared: number } | null;
}

export interface TimelineDiffEntry {
  target_type: TimelineOverrideTargetType;
  target_key: string;
  target_scope_id: number | null;
  target_scope_type: "company" | "industry" | null;
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

export interface TimelineRenameRequest {
  name: string;
}

export interface TimelineGroupResponse {
  id: number;
  primitive: "sensitivity_sweep" | "monte_carlo";
  label: string | null;
  owner_user_id: number | null;
  created_at: string;
  member_timeline_ids: number[];
}

export interface EnsembleCreateResponse {
  group: TimelineGroupResponse;
  timelines: TimelineResponse[];
}

export interface DistributionResponse {
  metric: string;
  count: number;
  mean: number | null;
  median: number | null;
  percentiles: Record<string, number>;
  histogram_bins: number[];
  histogram_counts: number[];
  samples: Array<{ timeline_id: number; sweep_value: string | null; value: number; status: string }>;
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

export type NotificationType = "branch_ready" | "branch_failed" | "price_alert" | "watchlist_mover";

export interface NotificationResponse {
  id: number;
  notification_type: NotificationType;
  payload: Record<string, unknown>;
  sim_date: string;
  read_at: string | null;
  created_at: string;
}

export interface MarkAllReadResponse {
  marked_count: number;
}

export type PriceAlertDirection = "above" | "below";

export interface PriceAlertCreateRequest {
  company_id: number;
  timeline_id: number;
  target_price: number;
  direction: PriceAlertDirection;
}

export interface PriceAlertResponse {
  id: number;
  company_id: number;
  timeline_id: number;
  target_price: number;
  direction: PriceAlertDirection;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}
