import type { CompanyGridItem } from "@/lib/api/types";

export interface RangeValue {
  min: number;
  max: number;
}

export interface MarketFilterState {
  industries: string[];
  price: RangeValue | null;
  marketCap: RangeValue | null;
  dayChangePct: RangeValue | null;
  volatility: RangeValue | null;
  ivGapPct: RangeValue | null;
  iv: RangeValue | null;
  volume: RangeValue | null;
  marketCapCategory: string[];
}

export type ColumnKey =
  | "industry"
  | "price"
  | "prevClose"
  | "dayChange"
  | "dayChangeAbs"
  | "ivGap"
  | "iv"
  | "marketCap"
  | "marketCapCategory"
  | "volatility"
  | "volume"
  | "high52w"
  | "low52w"
  | "pctOffHigh"
  | "spark";

export interface ColumnDef {
  key: ColumnKey;
  header: string;
  width: number;
  align: "left" | "right";
  sortAccessor: (row: EnrichedCompany) => number | string | null;
  group?: "valuation" | "price" | "fundamental";
}

/** CompanyGridItem plus client-derived fields shared across filters/sort/columns/export. */
export interface EnrichedCompany extends CompanyGridItem {
  ivGapPct: number | null;
  marketCapCategory: string;
  pctOffHigh: number | null;
}

export interface SortEntry {
  key: string;
  direction: "asc" | "desc";
}

export type Density = "comfortable" | "compact";

export interface SavedScreen {
  id: string;
  name: string;
  builtin?: boolean;
  icon?: string;
  filters: MarketFilterState;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc" | null;
}
