import type { CompanyGridItem, ScreenerClause, ScreenerQuery, ScreenerSort } from "@/lib/api/types";
import type { ColumnKey, Density, MarketFilterState } from "@/lib/market/types";
import type { SmartQueryClause } from "@/lib/market/smartQuery";

export const SCREENER_QUERY_VERSION = 1;

export const SCREENER_DEFAULT_COLUMNS = [
  "ticker",
  "name",
  "industry_name",
  "price",
  "day_change_pct",
  "market_cap",
  "iv_gap_pct",
  "intrinsic_value",
  "volatility",
  "avg_volume_20d",
  "rsi_14",
  "return_1m_pct",
  "financial_quality",
  "growth_potential",
];

const COLUMN_TO_METRIC: Partial<Record<ColumnKey, string>> = {
  industry: "industry_name",
  price: "price",
  prevClose: "prev_close",
  dayChange: "day_change_pct",
  dayChangeAbs: "day_change_abs",
  ivGap: "iv_gap_pct",
  iv: "intrinsic_value",
  marketCap: "market_cap",
  marketCapCategory: "market_cap_category",
  volatility: "volatility",
  volume: "avg_volume_20d",
  high52w: "high_52w",
  low52w: "low_52w",
  pctOffHigh: "pct_off_high",
};

function addRange(clauses: ScreenerClause[], metric: string, range: { min: number; max: number } | null) {
  if (!range) return;
  if (Number.isFinite(range.min)) clauses.push({ metric, operator: ">=", value: range.min });
  if (Number.isFinite(range.max)) clauses.push({ metric, operator: "<=", value: range.max });
}

export function columnKeyToMetric(key: string): string {
  return COLUMN_TO_METRIC[key as ColumnKey] ?? key;
}

/** Converts the legacy terminal filter state into the one serializable query
 * contract used by API execution, saved screens, notebooks, and exports. */
export function marketFiltersToQuery(
  filters: MarketFilterState,
  sort: { key: string | null; direction: "asc" | "desc" | null; secondary?: { key: string; direction: "asc" | "desc" } | null },
  columns: string[],
  options: { timelineId?: number; asOfDate?: string | null; freeText?: string; pageSize?: number; smartClauses?: SmartQueryClause[]; smartLogic?: "all" | "any"; extraColumns?: string[] } = {},
): ScreenerQuery {
  const clauses: ScreenerClause[] = [];
  if (filters.industries.length > 0) clauses.push({ metric: "industry_name", operator: "in", value: filters.industries });
  if (filters.marketCapCategory.length > 0) clauses.push({ metric: "market_cap_category", operator: "in", value: filters.marketCapCategory });
  addRange(clauses, "price", filters.price);
  addRange(clauses, "market_cap", filters.marketCap);
  addRange(clauses, "day_change_pct", filters.dayChangePct);
  addRange(clauses, "volatility", filters.volatility);
  addRange(clauses, "iv_gap_pct", filters.ivGapPct);
  addRange(clauses, "intrinsic_value", filters.iv);
  addRange(clauses, "avg_volume_20d", filters.volume);
  const text = options.freeText?.trim();
  const smartMetricMap: Record<string, string> = {
    marketCap: "market_cap",
    price: "price",
    dayChangePct: "day_change_pct",
    volatility: "volatility",
    ivGapPct: "iv_gap_pct",
    intrinsicValue: "intrinsic_value",
    volume: "avg_volume_20d",
    rsi14: "rsi_14",
    sma20Pct: "sma_20_pct",
    return1mPct: "return_1m_pct",
    relativeStrengthPct: "relative_strength_pct",
    managementQuality: "management_quality",
    moatScore: "moat_score",
    financialQuality: "financial_quality",
    fcfQuality: "fcf_quality",
    growthPotential: "growth_potential",
    intrinsicScore: "intrinsic_score",
    fairPe: "fair_pe",
  };
  for (const clause of options.smartClauses ?? []) {
    const metric = smartMetricMap[clause.metricKey];
    if (metric) clauses.push({ metric, operator: clause.op, value: clause.value });
  }

  const sorts: ScreenerSort[] = [];
  if (sort.key && sort.direction) sorts.push({ metric: columnKeyToMetric(sort.key), direction: sort.direction });
  if (sort.secondary) sorts.push({ metric: columnKeyToMetric(sort.secondary.key), direction: sort.secondary.direction });

  const smartMetrics = (options.smartClauses ?? []).map((clause) => smartMetricMap[clause.metricKey]).filter(Boolean);
  const requestedColumns = [...columns.map(columnKeyToMetric), ...smartMetrics, ...(options.extraColumns ?? []).map(columnKeyToMetric)];
  return {
    version: SCREENER_QUERY_VERSION,
    timeline_id: options.timelineId ?? 1,
    as_of_date: options.asOfDate ?? null,
    universe: { type: "all", industry_names: [], tickers: [] },
    logic: options.smartLogic ?? "all",
    clauses,
    sort: sorts,
    columns: Array.from(new Set((requestedColumns.length > 0 ? requestedColumns : SCREENER_DEFAULT_COLUMNS.map(columnKeyToMetric)))),
    page_size: options.pageSize ?? 100,
    offset: 0,
    query_text: text || null,
  };
}

export function emptyScreenerQuery(options: { timelineId?: number; asOfDate?: string | null } = {}): ScreenerQuery {
  return marketFiltersToQuery(
    { industries: [], price: null, marketCap: null, dayChangePct: null, volatility: null, ivGapPct: null, iv: null, volume: null, marketCapCategory: [] },
    { key: null, direction: null },
    SCREENER_DEFAULT_COLUMNS,
    options,
  );
}

export function queryFingerprint(query: ScreenerQuery): string {
  return JSON.stringify(query, Object.keys(query).sort());
}

/** Best-effort bridge for loading server screens into the legacy terminal
 * command line. Unsupported research clauses remain available in the server
 * query and are surfaced by Research/Rank mode rather than being silently
 * discarded. */
export function screenerQueryToCommandText(query: ScreenerQuery): string {
  const parts: string[] = [];
  const industryClause = query.clauses.find((clause) => clause.metric === "industry_name" && clause.operator === "in");
  if (industryClause && Array.isArray(industryClause.value)) {
    for (const value of industryClause.value) parts.push(`sector:${String(value)}`);
  }
  const capClause = query.clauses.find((clause) => clause.metric === "market_cap_category" && clause.operator === "in");
  if (capClause && Array.isArray(capClause.value) && capClause.value.length > 0) parts.push(`cap:${capClause.value.map(String).join(",").toLowerCase()}`);
  const rangeTokens: Record<string, { min?: number; max?: number }> = {};
  for (const clause of query.clauses) {
    const key = clause.metric === "day_change_pct" ? "chg" : clause.metric === "iv_gap_pct" ? "ivgap" : clause.metric === "avg_volume_20d" ? "vol" : clause.metric;
    if (!["price", "chg", "ivgap", "vol"].includes(key) || typeof clause.value !== "number") continue;
    const range = (rangeTokens[key] ??= {});
    if (clause.operator === ">" || clause.operator === ">=") range.min = clause.value;
    if (clause.operator === "<" || clause.operator === "<=") range.max = clause.value;
  }
  for (const [key, range] of Object.entries(rangeTokens)) {
    if (range.min != null) parts.push(`${key}>${range.min}`);
    if (range.max != null) parts.push(`${key}<${range.max}`);
  }
  return parts.join(" ");
}

/** Adapts the server row back to the current table until the table itself is
 * metric-registry driven. This makes the migration additive and reversible. */
export function companyRowsFromScreener(rows: Array<{ company: CompanyGridItem; metrics: Record<string, string | number | null> }>): CompanyGridItem[] {
  return rows.map(({ company }) => company);
}

export function densityLabel(density: Density): string {
  return density === "compact" ? "Terminal" : "Comfortable";
}
