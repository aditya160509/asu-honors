import type { ColumnDef, ColumnKey } from "@/lib/market/types";

export const COLUMN_DEFS: ColumnDef[] = [
  {
    key: "industry",
    header: "Sector",
    width: 72,
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
    header: "Chg %",
    width: 90,
    align: "right",
    sortAccessor: (r) => (r.day_change_pct == null ? null : Number(r.day_change_pct)),
    group: "price",
  },
  {
    key: "dayChangeAbs",
    header: "Chg",
    width: 84,
    align: "right",
    sortAccessor: (r) => {
      if (r.day_change_pct == null || r.current_price == null) return null;
      const cur = Number(r.current_price);
      const pct = Number(r.day_change_pct);
      return cur - cur / (1 + pct / 100);
    },
    group: "price",
  },
  {
    key: "ivGap",
    header: "IVGap %",
    width: 84,
    align: "right",
    sortAccessor: (r) => r.ivGapPct,
    group: "valuation",
  },
  {
    key: "iv",
    header: "Intr Val",
    width: 88,
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
    key: "spark",
    header: "Spark",
    width: 88,
    align: "right",
    sortAccessor: () => null,
    group: "price",
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

/** "compact" is this page's Terminal density (⌘D / >dense) — 24px rows,
 * ~34 visible on a laptop viewport, per the Bloomberg-terminal rebuild spec. */
export const DEFAULT_ROW_HEIGHT: Record<"comfortable" | "compact", number> = {
  comfortable: 32,
  compact: 24,
};

export const PINNED_COLUMN_WIDTH = 190;

/** Default column set is Sector/Price/Chg%/Chg/IVGap%/Intr Val/Mkt Cap/Spark
 * (8 columns, matching TKR+COMPANY already pinned) — everything else here
 * stays available via the column manager but isn't shown until asked for. */
export const DEFAULT_HIDDEN_KEYS: ColumnKey[] = [
  "prevClose",
  "marketCapCategory",
  "volatility",
  "volume",
  "high52w",
  "low52w",
  "pctOffHigh",
];

export const COLUMN_GROUPS = [
  { key: "price", label: "Price" },
  { key: "valuation", label: "Valuation" },
  { key: "fundamental", label: "Fundamentals" },
] as const;
