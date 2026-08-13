import type { EnrichedCompany } from "@/lib/market/types";

/**
 * Smart Query: a separate, natural-language criteria parser for the screener.
 * Unlike commandGrammar's compact tokens (`cap:mega`, `chg>5`), this accepts
 * free sentences like:
 *   "market cap less than $500 Mil and day change > 5 and volatility < 30"
 * It compiles the text into a list of clauses (metric, operator, value), with
 * explicit top-level AND/OR logic, then exposes a single predicate over EnrichedCompany. The
 * parsed clauses are also fed into the versioned server query object by the
 * Market Explorer, so natural language and manual controls share execution.
 */

export type ComparisonOp = ">" | ">=" | "<" | "<=" | "=";

export interface SmartQueryClause {
  raw: string;
  metricKey: MetricKey;
  metricLabel: string;
  op: ComparisonOp;
  value: number;
  valid: true;
}

export interface SmartQueryError {
  raw: string;
  valid: false;
  reason: string;
}

export type SmartQueryToken = SmartQueryClause | SmartQueryError;

export interface SmartQueryResult {
  clauses: SmartQueryClause[];
  errors: SmartQueryError[];
  logic: "all" | "any";
  predicate: (c: EnrichedCompany) => boolean;
}

export type MetricKey =
  | "marketCap"
  | "price"
  | "dayChangePct"
  | "volatility"
  | "ivGapPct"
  | "intrinsicValue"
  | "volume"
  | "rsi14"
  | "sma20Pct"
  | "return1mPct"
  | "relativeStrengthPct"
  | "managementQuality"
  | "moatScore"
  | "financialQuality"
  | "fcfQuality"
  | "growthPotential"
  | "intrinsicScore"
  | "fairPe";

export const SMART_QUERY_METRIC_KEYS = ["marketCap", "price", "dayChangePct", "volatility", "ivGapPct", "intrinsicValue", "volume", "rsi14", "sma20Pct", "return1mPct", "relativeStrengthPct", "managementQuality", "moatScore", "financialQuality", "fcfQuality", "growthPotential", "intrinsicScore", "fairPe"] as const;

interface MetricDef {
  key: MetricKey;
  label: string;
  aliases: string[];
  accessor: (c: EnrichedCompany) => number | null;
  /** True when the metric's natural values are already "per 100" (e.g. a 0-100
   * quality score) so bare "60" means 60, not a unit-scaled dollar figure. */
  unitScaled: boolean;
}

const METRICS: MetricDef[] = [
  {
    key: "marketCap",
    label: "Market Cap",
    aliases: ["market cap", "marketcap", "market capitalization", "mcap", "cap"],
    accessor: (c) => (c.market_cap == null ? null : Number(c.market_cap)),
    unitScaled: true,
  },
  {
    key: "price",
    label: "Price",
    aliases: ["price", "stock price", "share price", "current price"],
    accessor: (c) => Number(c.current_price),
    unitScaled: true,
  },
  {
    key: "dayChangePct",
    label: "Day Change %",
    aliases: ["day change", "change", "day change pct", "price change", "chg"],
    accessor: (c) => (c.day_change_pct == null ? null : Number(c.day_change_pct)),
    unitScaled: false,
  },
  {
    key: "volatility",
    label: "Volatility",
    aliases: ["volatility", "vol"],
    accessor: (c) => (c.volatility == null ? null : Number(c.volatility)),
    unitScaled: false,
  },
  {
    key: "ivGapPct",
    label: "IV Gap %",
    aliases: ["iv gap", "ivgap", "intrinsic value gap", "valuation gap"],
    accessor: (c) => c.ivGapPct,
    unitScaled: false,
  },
  {
    key: "intrinsicValue",
    label: "Intrinsic Value",
    aliases: ["intrinsic value", "iv", "fair value"],
    accessor: (c) => (c.intrinsic_value == null ? null : Number(c.intrinsic_value)),
    unitScaled: true,
  },
  {
    key: "volume",
    label: "Volume",
    aliases: ["volume", "avg volume", "average volume", "20d volume"],
    accessor: (c) => (c.avg_volume_20d == null ? null : Number(c.avg_volume_20d)),
    unitScaled: true,
  },
  ...([
    ["rsi14", "RSI (14)", ["rsi", "rsi 14"], "rsi_14"],
    ["sma20Pct", "Distance from SMA 20", ["sma", "sma 20", "distance from sma"], "sma_20_pct"],
    ["return1mPct", "1M Return", ["1m return", "monthly return", "one month return"], "return_1m_pct"],
    ["relativeStrengthPct", "Relative Strength", ["relative strength", "rs"], "relative_strength_pct"],
    ["managementQuality", "Management Quality", ["management quality", "management"], "management_quality"],
    ["moatScore", "Moat", ["moat", "moat score"], "moat_score"],
    ["financialQuality", "Financial Quality", ["financial quality", "quality"], "financial_quality"],
    ["fcfQuality", "FCF Quality", ["fcf quality", "cash flow quality"], "fcf_quality"],
    ["growthPotential", "Growth Potential", ["growth", "growth potential"], "growth_potential"],
    ["intrinsicScore", "Intrinsic Score", ["intrinsic score", "value score"], "intrinsic_score"],
    ["fairPe", "Fair P/E", ["fair pe", "fair p/e"], "fair_pe"],
  ] as Array<[MetricKey, string, string[], string]>).map(([key, label, aliases, serverKey]) => ({
    key,
    label,
    aliases,
    accessor: (c: EnrichedCompany) => {
      const value = c.screenerMetrics?.[serverKey];
      return value == null ? null : Number(value);
    },
    unitScaled: false,
  })),
];

const SERVER_ONLY_METRICS = new Set<MetricKey>([
  "rsi14", "sma20Pct", "return1mPct", "relativeStrengthPct", "managementQuality", "moatScore", "financialQuality", "fcfQuality", "growthPotential", "intrinsicScore", "fairPe",
]);

// Longest alias first so "market cap" matches before a hypothetical "market".
const SORTED_METRICS = [...METRICS].sort(
  (a, b) => Math.max(...b.aliases.map((s) => s.length)) - Math.max(...a.aliases.map((s) => s.length))
);

const OP_WORDS: { pattern: RegExp; op: ComparisonOp }[] = [
  { pattern: />=|at least|no less than|minimum of|min/i, op: ">=" },
  { pattern: /<=|at most|no more than|maximum of|max/i, op: "<=" },
  { pattern: />|greater than|more than|above|over|exceeds?/i, op: ">" },
  { pattern: /<|less than|below|under/i, op: "<" },
  { pattern: /=|==|equals?|is/i, op: "=" },
];

function parseUnitValue(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const m = cleaned.match(/^([+-]?\d+(?:\.\d+)?)\s*(k|thousand|m|mil|million|b|bil|billion|%)?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const unit = m[2]?.toLowerCase();
  if (unit === "k" || unit === "thousand") n *= 1e3;
  else if (unit === "m" || unit === "mil" || unit === "million") n *= 1e6;
  else if (unit === "b" || unit === "bil" || unit === "billion") n *= 1e9;
  return n;
}

function findMetric(text: string): MetricDef | null {
  const normalized = text.trim().toLowerCase();
  for (const metric of SORTED_METRICS) {
    for (const alias of metric.aliases) {
      if (normalized === alias) return metric;
    }
  }
  return null;
}

/** Splits "market cap less than $500 Mil and day change > 5 and volatility < 30"
 * into clause fragments on top-level `and`/`&&`/`,` boundaries. */
function splitClauses(text: string, logic: "all" | "any"): string[] {
  const boundary = logic === "any" ? /\s*(?:,|\|\||\bor\b)\s*/i : /\s*(?:,|&&|\band\b)\s*/i;
  return text
    .split(boundary)
    .map((s) => s.trim())
    .filter(Boolean);
}

const CLAUSE_PATTERN =
  /^(.*?)\s*(>=|<=|==|=|>|<|greater than|more than|above|over|exceeds?|less than|below|under|at least|no less than|minimum of|at most|no more than|maximum of|equals?|is)\s*(.+)$/i;

function parseClause(raw: string): SmartQueryToken {
  const trimmed = raw.trim();
  if (!trimmed) return { raw, valid: false, reason: "Empty clause" };

  const match = trimmed.match(CLAUSE_PATTERN);
  if (!match) {
    return { raw, valid: false, reason: "Could not find a comparison (e.g. 'PE > 50')" };
  }

  const [, metricTextRaw, opTextRaw, valueTextRaw] = match;
  const metricText = metricTextRaw
    .replace(/^(companies|stocks)\s+(with|where|having)\s+/i, "")
    .replace(/^(with|where|having)\s+/i, "")
    .trim();

  const metric = findMetric(metricText);
  if (!metric) {
    return { raw, valid: false, reason: `Unknown metric "${metricText || opTextRaw}"` };
  }

  const opEntry = OP_WORDS.find((o) => o.pattern.test(opTextRaw) && new RegExp(`^(?:${o.pattern.source})$`, "i").test(opTextRaw.trim()));
  if (!opEntry) {
    return { raw, valid: false, reason: `Unknown comparison "${opTextRaw}"` };
  }

  const valueText = valueTextRaw.trim().replace(/\.$/, "");
  const value = metric.unitScaled ? parseUnitValue(valueText) : parseFloat(valueText.replace(/%$/, ""));
  if (value == null || Number.isNaN(value)) {
    return { raw, valid: false, reason: `Could not parse value "${valueText}"` };
  }

  return {
    raw,
    valid: true,
    metricKey: metric.key,
    metricLabel: metric.label,
    op: opEntry.op,
    value,
  };
}

function compare(actual: number, op: ComparisonOp, target: number): boolean {
  switch (op) {
    case ">":
      return actual > target;
    case ">=":
      return actual >= target;
    case "<":
      return actual < target;
    case "<=":
      return actual <= target;
    case "=":
      return actual === target;
  }
}

/** Parses a natural-language smart query into clauses + a ready-to-use
 * predicate. Unparseable fragments are reported as errors but don't block
 * the clauses that did parse. */
export function parseSmartQuery(text: string): SmartQueryResult {
  const clauses: SmartQueryClause[] = [];
  const errors: SmartQueryError[] = [];
  const hasOr = /\s*(?:\|\||\bor\b)\s*/i.test(text);
  const hasAnd = /\s*(?:&&|\band\b)\s*/i.test(text);
  // Mixed precedence requires nested groups, which are not represented in
  // the v1 query contract. Report it instead of silently changing meaning;
  // a pure OR expression is supported end-to-end through logic="any".
  const logic: "all" | "any" = hasOr && !hasAnd ? "any" : "all";

  if (text.trim()) {
    for (const fragment of splitClauses(text, logic)) {
      const token = parseClause(fragment);
      if (token.valid) clauses.push(token);
      else errors.push(token);
    }
    if (hasOr && hasAnd) errors.push({ raw: text, valid: false, reason: "Mixing AND and OR requires explicit groups; use one connector per query." });
  }

  const metricByKey = new Map(METRICS.map((m) => [m.key, m]));
  const predicate = (c: EnrichedCompany): boolean => {
    const matches = clauses.map((clause) => {
      const metric = metricByKey.get(clause.metricKey);
      if (!metric) return true;
      const actual = metric.accessor(c);
      // Before the server response arrives, preserve the legacy optimistic
      // grid instead of flashing an empty table for a server-only metric.
      if (actual == null && SERVER_ONLY_METRICS.has(clause.metricKey) && !c.screenerMetrics) return true;
      if (actual == null) return false;
      return compare(actual, clause.op, clause.value);
    });
    return logic === "any" ? matches.some(Boolean) : matches.every(Boolean);
  };

  return { clauses, errors, logic, predicate };
}

export function smartQueryMetricLabels(): string[] {
  return METRICS.map((m) => m.label);
}
