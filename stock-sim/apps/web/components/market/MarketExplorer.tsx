"use client";

import * as React from "react";
import { toast } from "sonner";
import { Toolbar } from "@/components/market/Toolbar";
import { SavedScreensBar } from "@/components/market/SavedScreensBar";
import { FilterRail } from "@/components/market/FilterRail";
import { ExplorerTable, type SortState } from "@/components/market/ExplorerTable";
import { ExplorerSkeleton, ExplorerErrorState, ExplorerEmptyFiltered, ExplorerEmptyUniverse } from "@/components/market/ExplorerStates";
import { PreviewDrawer } from "@/components/market/PreviewDrawer";
import { CompareDrawer } from "@/components/market/CompareDrawer";
import { COLUMN_DEFS } from "@/lib/market/columns";
import { applyFilters, boundsFor, emptyFilterState, enrichCompanies, industriesOf } from "@/lib/market/filters";
import { useColumnVisibility } from "@/lib/market/useColumnVisibility";
import { useSavedScreens } from "@/lib/market/useSavedScreens";
import { useWatchlistToggle } from "@/lib/market/useWatchlistToggle";
import { exportCompaniesCsv } from "@/lib/market/exportCsv";
import type { CompanyGridItem } from "@/lib/api/types";
import type { Density, EnrichedCompany, MarketFilterState } from "@/lib/market/types";

const MAX_COMPARE = 4;
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
  if (!sort.key || !sort.direction) return rows;
  const dir = sort.direction === "asc" ? 1 : -1;
  const col = COLUMN_DEFS.find((c) => c.key === sort.key);
  const accessor = (row: EnrichedCompany): number | string | null => {
    if (sort.key === "ticker") return row.ticker;
    return col ? col.sortAccessor(row) : null;
  };
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
    return (Number(av) - Number(bv)) * dir;
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
  const [density, setDensity] = React.useState<Density>(() => readLocal(DENSITY_KEY, "comfortable" as Density));
  const [railCollapsed, setRailCollapsed] = React.useState<boolean>(() => readLocal(RAIL_KEY, false));
  const [selectedTickers, setSelectedTickers] = React.useState<Set<string>>(new Set());
  const [previewTicker, setPreviewTicker] = React.useState<string | null>(null);
  const [compareOpen, setCompareOpen] = React.useState(false);

  const savedScreens = useSavedScreens();
  const columnState = useColumnVisibility(COLUMN_DEFS);
  const watchlist = useWatchlistToggle();

  React.useEffect(() => {
    localStorage.setItem(DENSITY_KEY, JSON.stringify(density));
  }, [density]);
  React.useEffect(() => {
    localStorage.setItem(RAIL_KEY, JSON.stringify(railCollapsed));
  }, [railCollapsed]);

  const filtered = React.useMemo(() => applyFilters(enriched, filters, query), [enriched, filters, query]);
  const sorted = React.useMemo(() => sortRows(filtered, sort), [filtered, sort]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      const next: SortState["direction"] = prev.direction === "asc" ? "desc" : prev.direction === "desc" ? null : "asc";
      return { key: next ? key : null, direction: next };
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

  function handleSaveScreen() {
    const name = window.prompt("Name this screen");
    if (name && name.trim()) {
      savedScreens.saveScreen(name.trim(), filters, sort.key, sort.direction);
    }
  }

  function handleResetFilters() {
    setFilters(emptyFilterState());
    savedScreens.setActiveId("__all");
  }

  const visibleColumns = columnState.orderedVisible;

  const showSkeleton = Boolean(loading);
  const showError = Boolean(error) && !loading;
  const isTrulyEmpty = !loading && !error && enriched.length === 0;
  const isFilteredEmpty = !loading && !error && enriched.length > 0 && sorted.length === 0;

  return (
    <>
      <div className="flex h-[calc(100vh-176px)] min-h-[520px] flex-col overflow-hidden rounded-md border border-border bg-bg-secondary">
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
        />
        <SavedScreensBar
          screens={savedScreens.screens}
          activeId={savedScreens.activeId}
          onSelect={handleSelectScreen}
          onRemove={savedScreens.removeScreen}
        />
        <div className="flex flex-1 overflow-hidden">
          <FilterRail
            industries={industries}
            bounds={bounds}
            filters={filters}
            onChange={setFilters}
            collapsed={railCollapsed}
            onToggleCollapsed={() => setRailCollapsed((v) => !v)}
            onSave={handleSaveScreen}
          />

          {showSkeleton ? (
            <ExplorerSkeleton columns={visibleColumns} density={density} />
          ) : showError ? (
            <ExplorerErrorState onRetry={onRetry} />
          ) : isTrulyEmpty ? (
            <ExplorerEmptyUniverse />
          ) : isFilteredEmpty ? (
            <ExplorerEmptyFiltered onReset={handleResetFilters} />
          ) : (
            <ExplorerTable
              rows={sorted}
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
    </>
  );
}
