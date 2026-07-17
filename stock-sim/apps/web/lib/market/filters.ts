import type { CompanyGridItem } from "@/lib/api/types";
import type { EnrichedCompany, MarketFilterState, RangeValue, SavedScreen } from "@/lib/market/types";

export function marketCapCategory(marketCap: number | null): string {
  if (marketCap == null || marketCap <= 0) return "Unknown";
  if (marketCap >= 200e9) return "Mega";
  if (marketCap >= 10e9) return "Large";
  if (marketCap >= 2e9) return "Mid";
  if (marketCap >= 300e6) return "Small";
  return "Micro";
}

const CAP_CATEGORIES = ["Mega", "Large", "Mid", "Small", "Micro"];

export function enrichCompanies(companies: CompanyGridItem[]): EnrichedCompany[] {
  return companies.map((c) => ({
    ...c,
    day_change_pct: c.day_change_pct,
    ivGapPct:
      c.intrinsic_value && Number(c.intrinsic_value) > 0
        ? ((Number(c.current_price) - Number(c.intrinsic_value)) / Number(c.intrinsic_value)) * 100
        : null,
    marketCapCategory: marketCapCategory(c.market_cap),
    pctOffHigh:
      c.high_52w && Number(c.high_52w) > 0
        ? ((Number(c.current_price) - Number(c.high_52w)) / Number(c.high_52w)) * 100
        : null,
  }));
}

export function industriesOf(companies: EnrichedCompany[]): string[] {
  return Array.from(new Set(companies.map((c) => c.industry_name))).sort();
}

export function capCategoriesOf(): string[] {
  return CAP_CATEGORIES;
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
  iv: RangeValue;
  volume: RangeValue;
}

export function boundsFor(companies: EnrichedCompany[]): FilterBounds {
  return {
    price: boundsOf(companies.map((c) => Number(c.current_price)).filter((n) => !Number.isNaN(n))),
    marketCap: boundsOf(companies.map((c) => Number(c.market_cap)).filter((n) => !Number.isNaN(n))),
    dayChangePct: boundsOf(companies.map((c) => c.day_change_pct).filter((n): n is number => n != null)),
    volatility: boundsOf(companies.map((c) => Number(c.volatility)).filter((n) => !Number.isNaN(n))),
    ivGapPct: boundsOf(companies.map((c) => c.ivGapPct).filter((n): n is number => n != null)),
    iv: boundsOf(companies.map((c) => Number(c.intrinsic_value)).filter((n) => !Number.isNaN(n) && n > 0)),
    volume: boundsOf(companies.map((c) => Number(c.avg_volume_20d)).filter((n) => !Number.isNaN(n))),
  };
}

export function emptyFilterState(): MarketFilterState {
  return {
    industries: [],
    price: null,
    marketCap: null,
    dayChangePct: null,
    volatility: null,
    ivGapPct: null,
    iv: null,
    volume: null,
    marketCapCategory: [],
  };
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
    if (filters.marketCapCategory.length > 0 && !filters.marketCapCategory.includes(c.marketCapCategory)) return false;
    if (!inRange(Number(c.current_price), filters.price)) return false;
    if (!inRange(Number(c.market_cap), filters.marketCap)) return false;
    if (!inRange(c.day_change_pct == null ? null : Number(c.day_change_pct), filters.dayChangePct)) return false;
    if (!inRange(c.volatility == null ? null : Number(c.volatility), filters.volatility)) return false;
    if (!inRange(c.ivGapPct, filters.ivGapPct)) return false;
    if (!inRange(c.intrinsic_value == null ? null : Number(c.intrinsic_value), filters.iv)) return false;
    if (!inRange(c.avg_volume_20d == null ? null : Number(c.avg_volume_20d), filters.volume)) return false;
    return true;
  });
}

export function activeFilterGroupCount(filters: MarketFilterState, bounds: FilterBounds): number {
  let n = 0;
  if (filters.industries.length > 0) n++;
  if (filters.marketCapCategory.length > 0) n++;
  if (filters.price && (filters.price.min > bounds.price.min || filters.price.max < bounds.price.max)) n++;
  if (filters.marketCap && (filters.marketCap.min > bounds.marketCap.min || filters.marketCap.max < bounds.marketCap.max)) n++;
  if (filters.dayChangePct && (filters.dayChangePct.min > bounds.dayChangePct.min || filters.dayChangePct.max < bounds.dayChangePct.max)) n++;
  if (filters.volatility && (filters.volatility.min > bounds.volatility.min || filters.volatility.max < bounds.volatility.max)) n++;
  if (filters.ivGapPct && (filters.ivGapPct.min > bounds.ivGapPct.min || filters.ivGapPct.max < bounds.ivGapPct.max)) n++;
  if (filters.iv && (filters.iv.min > bounds.iv.min || filters.iv.max < bounds.iv.max)) n++;
  if (filters.volume && (filters.volume.min > bounds.volume.min || filters.volume.max < bounds.volume.max)) n++;
  return n;
}

export function activeFilterChips(filters: MarketFilterState, bounds: FilterBounds): { label: string; onRemove: () => void }[] {
  const chips: { label: string; onRemove: () => void }[] = [];
  const base = emptyFilterState();

  for (const ind of filters.industries) {
    chips.push({
      label: ind,
      onRemove: () => {},
    });
  }
  for (const cat of filters.marketCapCategory) {
    chips.push({
      label: `${cat} Cap`,
      onRemove: () => {},
    });
  }
  if (filters.price && (filters.price.min > bounds.price.min || filters.price.max < bounds.price.max)) {
    chips.push({
      label: `Price $${filters.price.min.toFixed(0)}–$${filters.price.max.toFixed(0)}`,
      onRemove: () => {},
    });
  }
  if (filters.ivGapPct && (filters.ivGapPct.min > bounds.ivGapPct.min || filters.ivGapPct.max < bounds.ivGapPct.max)) {
    chips.push({
      label: `IV Gap ${filters.ivGapPct.min >= 0 ? "+" : ""}${filters.ivGapPct.min.toFixed(1)}% to ${filters.ivGapPct.max >= 0 ? "+" : ""}${filters.ivGapPct.max.toFixed(1)}%`,
      onRemove: () => {},
    });
  }
  if (filters.volatility && (filters.volatility.min > bounds.volatility.min || filters.volatility.max < bounds.volatility.max)) {
    chips.push({
      label: `Vol ${filters.volatility.min.toFixed(2)}–${filters.volatility.max.toFixed(2)}`,
      onRemove: () => {},
    });
  }
  return chips;
}

/** Computed default screens — always populated, never an empty pill row. */
export function builtinScreens(): SavedScreen[] {
  const base = emptyFilterState();
  return [
    { id: "__all", name: "All", builtin: true, icon: "◆", filters: base, sortKey: null, sortDirection: null },
    {
      id: "__gainers",
      name: "Top Gainers",
      builtin: true,
      icon: "▲",
      filters: base,
      sortKey: "dayChange",
      sortDirection: "desc",
    },
    {
      id: "__losers",
      name: "Top Losers",
      builtin: true,
      icon: "▼",
      filters: base,
      sortKey: "dayChange",
      sortDirection: "asc",
    },
    {
      id: "__volatile",
      name: "Most Volatile",
      builtin: true,
      icon: "⚡",
      filters: base,
      sortKey: "volatility",
      sortDirection: "desc",
    },
    {
      id: "__undervalued",
      name: "Undervalued",
      builtin: true,
      icon: "◎",
      filters: { ...base, ivGapPct: { min: -1000, max: -3 } },
      sortKey: "ivGap",
      sortDirection: "asc",
    },
    {
      id: "__overvalued",
      name: "Overvalued",
      builtin: true,
      icon: "◉",
      filters: { ...base, ivGapPct: { min: 3, max: 1000 } },
      sortKey: "ivGap",
      sortDirection: "desc",
    },
    {
      id: "__mega",
      name: "Mega Cap",
      builtin: true,
      filters: { ...base, marketCapCategory: ["Mega"] },
      sortKey: "marketCap",
      sortDirection: "desc",
    },
    {
      id: "__large",
      name: "Large Cap",
      builtin: true,
      filters: { ...base, marketCapCategory: ["Large"] },
      sortKey: "marketCap",
      sortDirection: "desc",
    },
    {
      id: "__mid",
      name: "Mid Cap",
      builtin: true,
      filters: { ...base, marketCapCategory: ["Mid"] },
      sortKey: "marketCap",
      sortDirection: "desc",
    },
    {
      id: "__small",
      name: "Small Cap",
      builtin: true,
      filters: { ...base, marketCapCategory: ["Small", "Micro"] },
      sortKey: "marketCap",
      sortDirection: "desc",
    },
    {
      id: "__cheap",
      name: "Cheap (<$10)",
      builtin: true,
      filters: { ...base, price: { min: 0, max: 10 } },
      sortKey: "price",
      sortDirection: "asc",
    },
    {
      id: "__premium",
      name: "Premium (>$50)",
      builtin: true,
      filters: { ...base, price: { min: 50, max: 10000 } },
      sortKey: "price",
      sortDirection: "desc",
    },
  ];
}
