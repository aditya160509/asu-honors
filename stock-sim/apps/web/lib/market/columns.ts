import type { ColumnDef } from "@/lib/market/types";

export const COLUMN_DEFS: ColumnDef[] = [
  {
    key: "industry",
    header: "Industry",
    width: 150,
    align: "left",
    sortAccessor: (r) => r.industry_name,
  },
  {
    key: "price",
    header: "Price",
    width: 96,
    align: "right",
    sortAccessor: (r) => Number(r.current_price),
  },
  {
    key: "prevClose",
    header: "Prev Close",
    width: 96,
    align: "right",
    sortAccessor: (r) => (r.prev_close == null ? null : Number(r.prev_close)),
  },
  {
    key: "dayChange",
    header: "Day Chg",
    width: 130,
    align: "right",
    sortAccessor: (r) => (r.day_change_pct == null ? null : Number(r.day_change_pct)),
  },
  {
    key: "ivGap",
    header: "IV Gap %",
    width: 96,
    align: "right",
    sortAccessor: (r) => r.ivGapPct,
  },
  {
    key: "marketCap",
    header: "Mkt Cap",
    width: 100,
    align: "right",
    sortAccessor: (r) => (r.market_cap == null ? null : Number(r.market_cap)),
  },
  {
    key: "volatility",
    header: "Volatility",
    width: 90,
    align: "right",
    sortAccessor: (r) => (r.volatility == null ? null : Number(r.volatility)),
  },
];

export const DEFAULT_ROW_HEIGHT: Record<"comfortable" | "compact", number> = {
  comfortable: 40,
  compact: 28,
};

export const PINNED_COLUMN_WIDTH = 220;
