import type { CompanyGridItem } from "@/lib/api/types";
import type { EnrichedCompany, MarketFilterState, RangeValue, SavedScreen } from "@/lib/market/types";

export function enrichCompanies(companies: CompanyGridItem[]): EnrichedCompany[] {
  return companies.map((c) => ({
    ...c,
    ivGapPct:
      c.intrinsic_value && Number(c.intrinsic_value) > 0
        ? ((Number(c.current_price) - Number(c.intrinsic_value)) / Number(c.intrinsic_value)) * 100
        : null,
  }));
}

export function industriesOf(companies: EnrichedCompany[]): string[] {
  return Array.from(new Set(companies.map((c) => c.industry_name))).sort();
}

function boundsOf(values: number[]): RangeValue {
  if (values.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

export interface FilterBounds {
  price: RangeValue;
  marketCap: RangeValue;
  dayChangePct: RangeValue;
  volatility: RangeValue;
  ivGapPct: RangeValue;
}

export function boundsFor(companies: EnrichedCompany[]): FilterBounds {
  return {
    price: boundsOf(companies.map((c) => Number(c.current_price)).filter((n) => !Number.isNaN(n))),
    marketCap: boundsOf(companies.map((c) => Number(c.market_cap)).filter((n) => !Number.isNaN(n))),
    dayChangePct: boundsOf(companies.map((c) => Number(c.day_change_pct)).filter((n) => !Number.isNaN(n))),
    volatility: boundsOf(companies.map((c) => Number(c.volatility)).filter((n) => !Number.isNaN(n))),
    ivGapPct: boundsOf(companies.map((c) => c.ivGapPct).filter((n): n is number => n != null)),
  };
}

export function emptyFilterState(): MarketFilterState {
  return { industries: [], price: null, marketCap: null, dayChangePct: null, volatility: null, ivGapPct: null };
}

function inRange(value: number | null, range: RangeValue | null): boolean {
  if (!range) return true;
  if (value == null) return false;
  return value >= range.min && value <= range.max;
}

export function applyFilters(
  companies: EnrichedCompany[],
  filters: MarketFilterState,
  query: string
): EnrichedCompany[] {
  const q = query.trim().toLowerCase();
  return companies.filter((c) => {
    if (q && !(c.ticker.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q))) return false;
    if (filters.industries.length > 0 && !filters.industries.includes(c.industry_name)) return false;
    if (!inRange(Number(c.current_price), filters.price)) return false;
    if (!inRange(Number(c.market_cap), filters.marketCap)) return false;
    if (!inRange(c.day_change_pct == null ? null : Number(c.day_change_pct), filters.dayChangePct)) return false;
    if (!inRange(c.volatility == null ? null : Number(c.volatility), filters.volatility)) return false;
    if (!inRange(c.ivGapPct, filters.ivGapPct)) return false;
    return true;
  });
}

export function activeFilterGroupCount(filters: MarketFilterState, bounds: FilterBounds): number {
  let n = 0;
  if (filters.industries.length > 0) n++;
  if (filters.price && (filters.price.min > bounds.price.min || filters.price.max < bounds.price.max)) n++;
  if (filters.marketCap && (filters.marketCap.min > bounds.marketCap.min || filters.marketCap.max < bounds.marketCap.max))
    n++;
  if (
    filters.dayChangePct &&
    (filters.dayChangePct.min > bounds.dayChangePct.min || filters.dayChangePct.max < bounds.dayChangePct.max)
  )
    n++;
  if (filters.volatility && (filters.volatility.min > bounds.volatility.min || filters.volatility.max < bounds.volatility.max))
    n++;
  if (filters.ivGapPct && (filters.ivGapPct.min > bounds.ivGapPct.min || filters.ivGapPct.max < bounds.ivGapPct.max))
    n++;
  return n;
}

/** Computed default screens — always populated, never an empty pill row. */
export function builtinScreens(): SavedScreen[] {
  const base = emptyFilterState();
  return [
    { id: "__all", name: "All", builtin: true, filters: base, sortKey: null, sortDirection: null },
    {
      id: "__gainers",
      name: "Top Gainers",
      builtin: true,
      filters: base,
      sortKey: "day_change_pct",
      sortDirection: "desc",
    },
    {
      id: "__losers",
      name: "Top Losers",
      builtin: true,
      filters: base,
      sortKey: "day_change_pct",
      sortDirection: "asc",
    },
    {
      id: "__volatile",
      name: "Most Volatile",
      builtin: true,
      filters: base,
      sortKey: "volatility",
      sortDirection: "desc",
    },
    {
      id: "__undervalued",
      name: "Undervalued",
      builtin: true,
      filters: { ...base, ivGapPct: { min: -1000, max: -5 } },
      sortKey: "ivGapPct",
      sortDirection: "asc",
    },
    {
      id: "__overvalued",
      name: "Overvalued",
      builtin: true,
      filters: { ...base, ivGapPct: { min: 5, max: 1000 } },
      sortKey: "ivGapPct",
      sortDirection: "desc",
    },
  ];
}
