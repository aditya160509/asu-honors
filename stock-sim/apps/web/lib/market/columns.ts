import type { ColumnDef } from "@/lib/market/types";

export const COLUMN_DEFS: ColumnDef[] = [
  {
    key: "industry",
    header: "Industry",
    width: 160,
    align: "left",
    sortAccessor: (r) => r.industry_name,
    group: "fundamental",
  },
  {
    key: "price",
    header: "Price",
    width: 88,
    align: "right",
    sortAccessor: (r) => Number(r.current_price),
    group: "price",
  },
  {
    key: "prevClose",
    header: "Prev Close",
    width: 88,
    align: "right",
    sortAccessor: (r) => (r.prev_close == null ? null : Number(r.prev_close)),
    group: "price",
  },
  {
    key: "dayChange",
    header: "Day Chg %",
    width: 120,
    align: "right",
    sortAccessor: (r) => (r.day_change_pct == null ? null : Number(r.day_change_pct)),
    group: "price",
  },
  {
    key: "ivGap",
    header: "IV Gap %",
    width: 88,
    align: "right",
    sortAccessor: (r) => r.ivGapPct,
    group: "valuation",
  },
  {
    key: "iv",
    header: "Intrinsic Val",
    width: 96,
    align: "right",
    sortAccessor: (r) => (r.intrinsic_value == null ? null : Number(r.intrinsic_value)),
    group: "valuation",
  },
  {
    key: "marketCap",
    header: "Mkt Cap",
    width: 96,
    align: "right",
    sortAccessor: (r) => (r.market_cap == null ? null : Number(r.market_cap)),
    group: "fundamental",
  },
  {
    key: "marketCapCategory",
    header: "Cap Class",
    width: 80,
    align: "left",
    sortAccessor: (r) => r.marketCapCategory,
    group: "fundamental",
  },
  {
    key: "volatility",
    header: "Vol",
    width: 72,
    align: "right",
    sortAccessor: (r) => (r.volatility == null ? null : Number(r.volatility)),
    group: "fundamental",
  },
  {
    key: "volume",
    header: "Avg Vol",
    width: 80,
    align: "right",
    sortAccessor: (r) => (r.avg_volume_20d == null ? null : Number(r.avg_volume_20d)),
    group: "fundamental",
  },
  {
    key: "high52w",
    header: "52W High",
    width: 80,
    align: "right",
    sortAccessor: (r) => (r.high_52w == null ? null : Number(r.high_52w)),
    group: "price",
  },
  {
    key: "low52w",
    header: "52W Low",
    width: 80,
    align: "right",
    sortAccessor: (r) => (r.low_52w == null ? null : Number(r.low_52w)),
    group: "price",
  },
  {
    key: "pctOffHigh",
    header: "% Off High",
    width: 80,
    align: "right",
    sortAccessor: (r) => r.pctOffHigh,
    group: "price",
  },
];

export const DEFAULT_ROW_HEIGHT: Record<"comfortable" | "compact", number> = {
  comfortable: 38,
  compact: 26,
};

export const PINNED_COLUMN_WIDTH = 210;

export const COLUMN_GROUPS = [
  { key: "price", label: "Price" },
  { key: "valuation", label: "Valuation" },
  { key: "fundamental", label: "Fundamentals" },
] as const;
