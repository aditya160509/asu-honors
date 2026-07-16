"use client";

import * as React from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Toolbar } from "@/components/market/Toolbar";
import { SavedScreensBar } from "@/components/market/SavedScreensBar";
import { StatsBar } from "@/components/market/StatsBar";
import { ColumnPresets, COLUMN_PRESETS } from "@/components/market/ColumnPresets";
import { HeatmapView } from "@/components/market/HeatmapView";
import { FilterRail } from "@/components/market/FilterRail";
import { ExplorerTable, type SortState } from "@/components/market/ExplorerTable";
import { ExplorerSkeleton, ExplorerErrorState, ExplorerEmptyFiltered, ExplorerEmptyUniverse } from "@/components/market/ExplorerStates";
import { PreviewDrawer } from "@/components/market/PreviewDrawer";
import { TopMoversBar } from "@/components/market/TopMoversBar";
import { CompareDrawer } from "@/components/market/CompareDrawer";
import { SectorBreakdown } from "@/components/market/SectorBreakdown";
import { ComparisonOverlay } from "@/components/market/ComparisonOverlay";
import { DistributionHistogram } from "@/components/market/DistributionHistogram";
import { COLUMN_DEFS } from "@/lib/market/columns";
import { applyFilters, boundsFor, emptyFilterState, enrichCompanies, industriesOf } from "@/lib/market/filters";
import { useColumnVisibility } from "@/lib/market/useColumnVisibility";
import { useSavedScreens } from "@/lib/market/useSavedScreens";
import { useWatchlistToggle } from "@/lib/market/useWatchlistToggle";
import { useScreenerKeyboard } from "@/lib/market/useScreenerKeyboard";
import { exportCompaniesCsv } from "@/lib/market/exportCsv";
import { cn } from "@/lib/utils";
import type { CompanyGridItem } from "@/lib/api/types";
import type { ColumnKey, Density, EnrichedCompany, MarketFilterState } from "@/lib/market/types";

const MAX_COMPARE = 4;
const PAGE_SIZE = 50;
const DENSITY_KEY = "market-explorer:density";
const RAIL_KEY = "market-explorer:rail-collapsed";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function sortRows(rows: EnrichedCompany[], sort: SortState): EnrichedCompany[] {
  const comparators: { accessor: (row: EnrichedCompany) => number | string | null; dir: number }[] = [];

  if (sort.key && sort.direction) {
    const col = COLUMN_DEFS.find((c) => c.key === sort.key);
    comparators.push({
      accessor: (row) => (sort.key === "ticker" ? row.ticker : col ? col.sortAccessor(row) : null),
      dir: sort.direction === "asc" ? 1 : -1,
    });
  }

  if (sort.secondary?.key && sort.secondary?.direction) {
    const col = COLUMN_DEFS.find((c) => c.key === sort.secondary!.key);
    comparators.push({
      accessor: (row) => (sort.secondary!.key === "ticker" ? row.ticker : col ? col.sortAccessor(row) : null),
      dir: sort.secondary!.direction === "asc" ? 1 : -1,
    });
  }

  if (comparators.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const { accessor, dir } of comparators) {
      const av = accessor(a);
      const bv = accessor(b);
      if (av == null && bv == null) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        const cmp = av.localeCompare(bv) * dir;
        if (cmp !== 0) return cmp;
      } else {
        const cmp = (Number(av) - Number(bv)) * dir;
        if (cmp !== 0) return cmp;
      }
    }
    return 0;
  });
}

export interface MarketExplorerProps {
  companies: CompanyGridItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

export function MarketExplorer({ companies, loading, error, onRetry }: MarketExplorerProps) {
  const enriched = React.useMemo(() => enrichCompanies(companies), [companies]);
  const bounds = React.useMemo(() => boundsFor(enriched), [enriched]);
  const industries = React.useMemo(() => industriesOf(enriched), [enriched]);

  const prevPricesRef = React.useRef<Map<string, number>>(new Map());
  const changedTickers = React.useMemo(() => {
    const changed = new Set<string>();
    for (const c of enriched) {
      const prev = prevPricesRef.current.get(c.ticker);
      const cur = Number(c.current_price);
      if (prev != null && prev !== cur) changed.add(c.ticker);
    }
    return changed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched]);
  React.useEffect(() => {
    const map = new Map<string, number>();
    for (const c of enriched) map.set(c.ticker, Number(c.current_price));
    prevPricesRef.current = map;
  }, [enriched]);

  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<MarketFilterState>(emptyFilterState());
  const [sort, setSort] = React.useState<SortState>({ key: null, direction: null });
  const [density, setDensity] = React.useState<Density>(() => readLocal(DENSITY_KEY, "compact" as Density));
  const [railCollapsed, setRailCollapsed] = React.useState<boolean>(() => readLocal(RAIL_KEY, false));
  const [selectedTickers, setSelectedTickers] = React.useState<Set<string>>(new Set());
  const [previewTicker, setPreviewTicker] = React.useState<string | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"table" | "heatmap">("table");
  const [activePreset, setActivePreset] = React.useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);

  const savedScreens = useSavedScreens();
  const columnState = useColumnVisibility(COLUMN_DEFS);
  const watchlist = useWatchlistToggle();

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  function handlePresetChange(columns: ColumnKey[]) {
    const preset = COLUMN_PRESETS.find((p) => {
      const sortedA = [...p.columns].sort();
      const sortedB = [...columns].sort();
      return sortedA.length === sortedB.length && sortedA.every((k, i) => k === sortedB[i]);
    });
    setActivePreset(preset?.key ?? null);

    for (const key of columnState.order) {
      const shouldShow = columns.includes(key);
      const isCurrentlyHidden = columnState.hidden.includes(key);
      if (shouldShow && isCurrentlyHidden) columnState.toggle(key);
      if (!shouldShow && !isCurrentlyHidden) columnState.toggle(key);
    }
  }

  React.useEffect(() => {
    localStorage.setItem(DENSITY_KEY, JSON.stringify(density));
  }, [density]);
  React.useEffect(() => {
    localStorage.setItem(RAIL_KEY, JSON.stringify(railCollapsed));
  }, [railCollapsed]);

  const filtered = React.useMemo(() => applyFilters(enriched, filters, query), [enriched, filters, query]);
  const sorted = React.useMemo(() => sortRows(filtered, sort), [filtered, sort]);

  // Reset to first page whenever filters, search, or sort change
  React.useEffect(() => {
    setPage(0);
  }, [filtered.length, sort.key, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = React.useMemo(
    () => sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [sorted, safePage]
  );

  React.useEffect(() => {
    setFocusedIndex((i) => Math.min(i, Math.max(pageRows.length - 1, 0)));
  }, [pageRows.length]);

  const rowGetter = React.useCallback(
    (index: number) => pageRows[index] ?? null,
    [pageRows]
  );

  useScreenerKeyboard({
    focusedIndex,
    setFocusedIndex,
    totalRows: sorted.length,
    onActivateRow: setPreviewTicker,
    onToggleSelect: toggleSelect,
    onToggleWatch: watchlist.toggle,
    searchInputRef,
    rowGetter,
    onEsc: () => {
      if (previewTicker) setPreviewTicker(null);
    },
    onSelectPreset: (index) => {
      const preset = COLUMN_PRESETS[index];
      if (preset) {
        setActivePreset(preset.key);
        columnState.reset();
        for (const key of COLUMN_DEFS.map((c) => c.key)) {
          if (!preset.columns.includes(key)) {
            columnState.toggle(key);
          }
        }
      }
    },
  });

  function toggleSort(key: string, shiftKey?: boolean) {
    setSort((prev) => {
      if (shiftKey) {
        if (prev.key === key) return prev;
        if (prev.secondary?.key === key) {
          const nextDir = prev.secondary.direction === "asc" ? "desc" : null;
          return { ...prev, secondary: nextDir ? { key, direction: nextDir } : null };
        }
        return { ...prev, secondary: { key, direction: "asc" } };
      }
      if (prev.key !== key) return { key, direction: "asc", secondary: null };
      const next: SortState["direction"] = prev.direction === "asc" ? "desc" : prev.direction === "desc" ? null : "asc";
      return { key: next ? key : null, direction: next, secondary: null };
    });
  }

  function toggleSelect(ticker: string) {
    setSelectedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        if (next.size >= MAX_COMPARE) {
          toast.info(`You can compare up to ${MAX_COMPARE} companies at a time.`);
          return prev;
        }
        next.add(ticker);
      }
      return next;
    });
  }

  function handleSelectScreen(id: string) {
    savedScreens.setActiveId(id);
    const screen = savedScreens.screens.find((s) => s.id === id);
    if (screen) {
      setFilters(screen.filters);
      setSort({ key: screen.sortKey ?? null, direction: screen.sortDirection ?? null });
    }
  }

  function handleResetFilters() {
    setFilters(emptyFilterState());
    savedScreens.setActiveId("__all");
  }

  function removeFilter(type: string, value?: string) {
    setFilters((prev) => {
      if (type === "industry" && value) {
        return { ...prev, industries: prev.industries.filter((i) => i !== value) };
      }
      if (type === "capCategory" && value) {
        return { ...prev, marketCapCategory: prev.marketCapCategory.filter((c) => c !== value) };
      }
      if (type === "price") return { ...prev, price: null };
      if (type === "marketCap") return { ...prev, marketCap: null };
      if (type === "dayChangePct") return { ...prev, dayChangePct: null };
      if (type === "volatility") return { ...prev, volatility: null };
      if (type === "ivGapPct") return { ...prev, ivGapPct: null };
      if (type === "iv") return { ...prev, iv: null };
      return prev;
    });
  }

  // Build active filter chips
  const filterChips: { label: string; type: string; value?: string }[] = [];
  for (const ind of filters.industries) {
    filterChips.push({ label: ind, type: "industry", value: ind });
  }
  for (const cat of filters.marketCapCategory) {
    filterChips.push({ label: `${cat} Cap`, type: "capCategory", value: cat });
  }
  if (filters.price) {
    filterChips.push({ label: `Price $${filters.price.min.toFixed(0)}–$${filters.price.max.toFixed(0)}`, type: "price" });
  }
  if (filters.ivGapPct && (filters.ivGapPct.min > bounds.ivGapPct.min || filters.ivGapPct.max < bounds.ivGapPct.max)) {
    filterChips.push({ label: `IV Gap ${filters.ivGapPct.min >= 0 ? "+" : ""}${filters.ivGapPct.min.toFixed(1)}% to ${filters.ivGapPct.max >= 0 ? "+" : ""}${filters.ivGapPct.max.toFixed(1)}%`, type: "ivGapPct" });
  }
  if (filters.volatility && (filters.volatility.min > bounds.volatility.min || filters.volatility.max < bounds.volatility.max)) {
    filterChips.push({ label: `Vol ${filters.volatility.min.toFixed(3)}–${filters.volatility.max.toFixed(3)}`, type: "volatility" });
  }
  if (filters.dayChangePct && (filters.dayChangePct.min > bounds.dayChangePct.min || filters.dayChangePct.max < bounds.dayChangePct.max)) {
    filterChips.push({ label: `Day Chg ${filters.dayChangePct.min >= 0 ? "+" : ""}${filters.dayChangePct.min.toFixed(1)}% to ${filters.dayChangePct.max >= 0 ? "+" : ""}${filters.dayChangePct.max.toFixed(1)}%`, type: "dayChangePct" });
  }
  if (filters.iv && (filters.iv.min > bounds.iv.min || filters.iv.max < bounds.iv.max)) {
    filterChips.push({ label: `IV $${filters.iv.min.toFixed(0)}–$${filters.iv.max.toFixed(0)}`, type: "iv" });
  }
  if (filters.marketCap && (filters.marketCap.min > bounds.marketCap.min || filters.marketCap.max < bounds.marketCap.max)) {
    const fmtCap = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${(n / 1e6).toFixed(0)}M`;
    filterChips.push({ label: `Mkt Cap ${fmtCap(filters.marketCap.min)}–${fmtCap(filters.marketCap.max)}`, type: "marketCap" });
  }

  const visibleColumns = columnState.orderedVisible;

  const showSkeleton = Boolean(loading);
  const showError = Boolean(error) && !loading;
  const isTrulyEmpty = !loading && !error && enriched.length === 0;
  const isFilteredEmpty = !loading && !error && enriched.length > 0 && sorted.length === 0;
  const hasActiveFilters = filterChips.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-bg-secondary">
        <Toolbar
          query={query}
          onQueryChange={setQuery}
          resultCount={sorted.length}
          totalCount={enriched.length}
          columns={COLUMN_DEFS}
          columnOrder={columnState.order}
          hiddenColumns={columnState.hidden}
          onToggleColumn={columnState.toggle}
          onMoveColumn={columnState.move}
          onResetColumns={columnState.reset}
          density={density}
          onDensityChange={setDensity}
          onExport={() => exportCompaniesCsv(sorted, visibleColumns)}
          compareCount={selectedTickers.size}
          onOpenCompare={() => setCompareOpen(true)}
          sort={sort}
          onSort={toggleSort}
          searchInputRef={searchInputRef}
        />
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
          <ColumnPresets onPresetChange={handlePresetChange} activePreset={activePreset} />
          <div className="flex items-center rounded-md border border-border p-0.5" role="radiogroup" aria-label="View mode">
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "table"}
              onClick={() => setViewMode("table")}
              className={cn(
                "h-7 rounded px-3 text-xs font-medium transition-all",
                viewMode === "table" ? "bg-bg-hover text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              TABLE
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "heatmap"}
              onClick={() => setViewMode("heatmap")}
              className={cn(
                "h-7 rounded px-3 text-xs font-medium transition-all",
                viewMode === "heatmap" ? "bg-bg-hover text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              HEATMAP
            </button>
          </div>
        </div>
        <TopMoversBar companies={enriched} onActivateRow={setPreviewTicker} />
        <StatsBar companies={sorted} />
        <SavedScreensBar
          screens={savedScreens.screens}
          activeId={savedScreens.activeId}
          onSelect={handleSelectScreen}
          onRemove={savedScreens.removeScreen}
        />

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 px-3 py-1.5 scrollbar-none">
            <span className="text-micro text-text-tertiary shrink-0">Filters:</span>
            {filterChips.map((chip, i) => (
              <button
                key={`${chip.type}-${chip.value ?? i}`}
                onClick={() => removeFilter(chip.type, chip.value)}
                className="flex shrink-0 items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-micro text-accent hover:bg-accent/20 transition-colors"
              >
                {chip.label}
                <X size={10} />
              </button>
            ))}
            {filterChips.length > 1 && (
              <button
                onClick={handleResetFilters}
                className="shrink-0 text-micro text-text-tertiary hover:text-negative transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <FilterRail
            industries={industries}
            bounds={bounds}
            filters={filters}
            onChange={setFilters}
            collapsed={railCollapsed}
            onToggleCollapsed={() => setRailCollapsed((v) => !v)}
          />

          {showSkeleton ? (
            <ExplorerSkeleton columns={visibleColumns} density={density} />
          ) : showError ? (
            <ExplorerErrorState onRetry={onRetry} />
          ) : isTrulyEmpty ? (
            <ExplorerEmptyUniverse />
          ) : isFilteredEmpty ? (
            <ExplorerEmptyFiltered onReset={handleResetFilters} />
          ) : viewMode === "heatmap" ? (
            <HeatmapView companies={sorted} onActivateRow={setPreviewTicker} />
          ) : (
            <ExplorerTable
              rows={pageRows}
              columns={visibleColumns}
              density={density}
              sort={sort}
              onSort={toggleSort}
              selectedTickers={selectedTickers}
              onToggleSelect={toggleSelect}
              watchedTickers={watchlist.watchedTickers}
              onToggleWatch={watchlist.toggle}
              onActivateRow={setPreviewTicker}
              changedTickers={changedTickers}
            />
          )}
        </div>
      </div>

      {/* Pagination bar */}
      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-micro text-text-tertiary">
            {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-6 rounded px-2 text-micro font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - safePage) <= 2)
              .reduce<(number | "ellipsis")[]>((acc, i, idx, arr) => {
                if (idx > 0 && i - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                acc.push(i);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e${idx}`} className="px-1 text-text-tertiary">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={cn(
                      "h-6 min-w-[24px] rounded px-1.5 text-micro font-medium transition-colors",
                      item === safePage
                        ? "bg-accent/15 text-accent"
                        : "text-text-secondary hover:bg-bg-hover"
                    )}
                  >
                    {item + 1}
                  </button>
                )
              )}
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="h-6 rounded px-2 text-micro font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Analytics toggle + collapsible panel */}
      <div className="flex items-center justify-end px-1 pt-1">
        <button
          type="button"
          onClick={() => setAnalyticsOpen((v) => !v)}
          className="text-micro font-medium text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {analyticsOpen ? "Hide Analytics" : "Show Analytics"}
        </button>
      </div>

      {analyticsOpen && (
        <div className="mt-1 space-y-3 rounded-md border border-border bg-bg-secondary p-3 pb-6">
          {selectedTickers.size > 0 && (
            <ComparisonOverlay
              companies={enriched}
              selectedTickers={Array.from(selectedTickers)}
              onRemoveTicker={toggleSelect}
            />
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SectorBreakdown companies={sorted} />
            <DistributionHistogram companies={sorted} metric="price" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DistributionHistogram companies={sorted} metric="dayChange" height={150} />
            <DistributionHistogram companies={sorted} metric="ivGap" height={150} />
            <DistributionHistogram companies={sorted} metric="volatility" height={150} />
          </div>
        </div>
      )}

      <PreviewDrawer
        ticker={previewTicker}
        onClose={() => setPreviewTicker(null)}
        watched={previewTicker ? watchlist.watchedTickers.has(previewTicker) : false}
        onToggleWatch={watchlist.toggle}
      />

      <CompareDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        tickers={Array.from(selectedTickers)}
        companies={enriched}
        onRemove={toggleSelect}
      />
    </div>
  );
}
