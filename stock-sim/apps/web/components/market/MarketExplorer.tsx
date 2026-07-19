"use client";

import * as React from "react";
import { CommandLine } from "@/components/market/CommandLine";
import { StatusLine } from "@/components/market/StatusLine";
import { ScreenerToolbar } from "@/components/market/ScreenerToolbar";
import { TopMoversBar } from "@/components/market/TopMoversBar";
import { MarketTickerTape } from "@/components/market/MarketTickerTape";
import { SentimentStrip } from "@/components/market/SentimentStrip";
import { FilterOverlay } from "@/components/market/FilterOverlay";
import { HelpOverlay } from "@/components/market/HelpOverlay";
import { DetailPanel } from "@/components/market/DetailPanel";
import { CompareDrawer } from "@/components/market/CompareDrawer";
import { ColumnManager } from "@/components/market/ColumnManager";
import { HeatmapView } from "@/components/market/HeatmapView";
import { ExplorerTable, type SortState } from "@/components/market/ExplorerTable";
import { ExplorerSkeleton, ExplorerErrorState, ExplorerEmptyFiltered, ExplorerEmptyUniverse } from "@/components/market/ExplorerStates";
import { COLUMN_DEFS, DEFAULT_HIDDEN_KEYS } from "@/lib/market/columns";
import { activeFilterGroupCount, boundsFor, emptyFilterState, enrichCompanies, industriesOf } from "@/lib/market/filters";
import {
  filtersToCommandText,
  parseCommandLine,
  removeTokenFromText,
  upsertTokensOfKey,
} from "@/lib/market/commandGrammar";
import { sectorToken } from "@/lib/market/sectorAbbrev";
import { useColumnVisibility } from "@/lib/market/useColumnVisibility";
import { useSavedScreens } from "@/lib/market/useSavedScreens";
import { useWatchlistToggle } from "@/lib/market/useWatchlistToggle";
import { useScreenerKeyboard } from "@/lib/market/useScreenerKeyboard";
import { exportCompaniesCsv } from "@/lib/market/exportCsv";
import type { CompanyGridItem } from "@/lib/api/types";
import type { ColumnKey, Density, EnrichedCompany } from "@/lib/market/types";

const DENSITY_KEY = "market-explorer:density";

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
  /** Set when showing a historical "time machine" snapshot instead of the
   * live grid — surfaces via StatusLine's existing DELAYED-badge slot. */
  historicalDate?: string | null;
  /** Rendered at the right edge of the toolbar row (e.g. the time-machine picker). */
  timeMachine?: React.ReactNode;
}

export function MarketExplorer({ companies, loading, error, onRetry, historicalDate, timeMachine }: MarketExplorerProps) {
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

  const [commandText, setCommandText] = React.useState("");
  const [sort, setSort] = React.useState<SortState>({ key: null, direction: null });
  const [density, setDensity] = React.useState<Density>(() => readLocal(DENSITY_KEY, "compact" as Density));
  const [selectedTickers, setSelectedTickers] = React.useState<Set<string>>(new Set());
  const [detailTicker, setDetailTicker] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"table" | "heatmap">("table");
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const [filterOverlayOpen, setFilterOverlayOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
  const [sortLetterMode, setSortLetterMode] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [toolbarQuery, setToolbarQuery] = React.useState("");
  const [showHighlights, setShowHighlights] = React.useState(false);
  const [showSentiment, setShowSentiment] = React.useState(false);

  const savedScreens = useSavedScreens();
  const columnState = useColumnVisibility(COLUMN_DEFS, DEFAULT_HIDDEN_KEYS);
  const watchlist = useWatchlistToggle();

  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const toolbarSearchInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    localStorage.setItem(DENSITY_KEY, JSON.stringify(density));
  }, [density]);

  // The command line's text is parsed live, but committing it to the table
  // on every keystroke (a) never lets a `>command` in progress apply its
  // (empty) "filters" and (b) briefly commits an empty filter set during the
  // one render where the field is cleared right before typing the next `>`
  // command — clobbering whatever was applied a moment earlier. A 150ms
  // debounce (which the terminal spec asks for anyway, for the Filter
  // Overlay) fixes both: a `>` landing within the window cancels the
  // pending commit before it ever applies.
  const parsed = React.useMemo(() => parseCommandLine(commandText, industries), [commandText, industries]);
  const isCommandMode = commandText.trim().startsWith(">");
  const [activeFilters, setActiveFilters] = React.useState(emptyFilterState());
  const [freeText, setFreeText] = React.useState("");
  const [activeTokens, setActiveTokens] = React.useState<typeof parsed.tokens>([]);

  React.useEffect(() => {
    if (isCommandMode) return;
    const id = setTimeout(() => {
      setActiveFilters(parsed.filters);
      setFreeText(parsed.freeText);
      setActiveTokens(parsed.tokens);
    }, 150);
    return () => clearTimeout(id);
  }, [isCommandMode, parsed]);

  const filtered = React.useMemo(() => {
    const q = freeText.trim().toLowerCase();
    const tq = toolbarQuery.trim().toLowerCase();
    return enriched.filter((c) => {
      if (q && !(c.ticker.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q))) return false;
      if (tq && !(c.ticker.toLowerCase().startsWith(tq) || c.name.toLowerCase().includes(tq))) return false;
      if (activeFilters.industries.length > 0 && !activeFilters.industries.includes(c.industry_name)) return false;
      if (activeFilters.marketCapCategory.length > 0 && !activeFilters.marketCapCategory.includes(c.marketCapCategory)) return false;
      const inRange = (value: number | null, range: { min: number; max: number } | null) =>
        !range || (value != null && value >= range.min && value <= range.max);
      if (!inRange(Number(c.current_price), activeFilters.price)) return false;
      if (!inRange(c.market_cap == null ? null : Number(c.market_cap), activeFilters.marketCap)) return false;
      if (!inRange(c.day_change_pct == null ? null : Number(c.day_change_pct), activeFilters.dayChangePct)) return false;
      if (!inRange(c.volatility == null ? null : Number(c.volatility), activeFilters.volatility)) return false;
      if (!inRange(c.ivGapPct, activeFilters.ivGapPct)) return false;
      if (!inRange(c.intrinsic_value == null ? null : Number(c.intrinsic_value), activeFilters.iv)) return false;
      if (!inRange(c.avg_volume_20d == null ? null : Number(c.avg_volume_20d), activeFilters.volume)) return false;
      return true;
    });
  }, [enriched, activeFilters, freeText, toolbarQuery]);

  const sorted = React.useMemo(() => sortRows(filtered, sort), [filtered, sort]);

  React.useEffect(() => {
    setFocusedIndex((i) => Math.min(i, Math.max(sorted.length - 1, 0)));
  }, [sorted.length]);

  const rowGetter = React.useCallback((index: number) => sorted[index] ?? null, [sorted]);

  // Screen name / modified-dot in the status line.
  const activeScreen = savedScreens.screens.find((s) => s.id === savedScreens.activeId) ?? savedScreens.screens[0];
  const screenModified = React.useMemo(() => {
    if (!activeScreen) return false;
    if (sort.key !== (activeScreen.sortKey ?? null) || sort.direction !== (activeScreen.sortDirection ?? null)) return true;
    return JSON.stringify(activeFilters) !== JSON.stringify(activeScreen.filters);
  }, [activeScreen, activeFilters, sort]);

  function loadScreen(id: string) {
    const screen = savedScreens.screens.find((s) => s.id === id);
    if (!screen) return;
    savedScreens.setActiveId(id);
    setCommandText(filtersToCommandText(screen.filters));
    setSort({ key: screen.sortKey ?? null, direction: screen.sortDirection ?? null });
  }

  function handleCommand(name: string, args: string) {
    // Every command except `load` is a momentary action — the command line
    // should snap back to whatever filters were actually active before the
    // `>` was typed, not go blank (that would look like the screen reset).
    // `load` is the one command that's *supposed* to change what's shown, so
    // it sets its own text instead of falling through to the restore below.
    switch (name) {
      case "save":
        if (args) savedScreens.saveScreen(args, activeFilters, sort.key, sort.direction);
        break;
      case "load": {
        const target = savedScreens.screens.find((s) => s.name.toLowerCase() === args.toLowerCase());
        if (target) loadScreen(target.id);
        return;
      }
      case "cols":
        setColumnManagerOpen(true);
        break;
      case "export":
        exportCompaniesCsv(sorted, columnState.orderedVisible);
        break;
      case "hmp":
        setViewMode("heatmap");
        break;
      case "tbl":
        setViewMode("table");
        break;
      case "dense":
        setDensity((d) => (d === "compact" ? "comfortable" : "compact"));
        break;
      case "help":
        setHelpOpen(true);
        break;
      default:
        break;
    }
    setCommandText(filtersToCommandText(activeFilters));
  }

  function handleRemoveToken(raw: string) {
    setCommandText((t) => removeTokenFromText(t, raw));
  }

  function handleSectorClick(industryName: string) {
    if (activeFilters.industries.includes(industryName)) return;
    setCommandText((t) => upsertTokensOfKey(t, "sector", [...activeFilters.industries, industryName].map((i) => `sector:${sectorToken(i)}`)));
  }

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
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  // `s` then a column letter (A, B, C…) sorts by that column — a lightweight
  // Bloomberg-menu-style two-key path, independent of clicking headers.
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;
      if (sortLetterMode) {
        const letter = e.key.toUpperCase();
        const idx = letter.charCodeAt(0) - 65;
        const col = columnState.orderedVisible[idx];
        if (col) toggleSort(col.key, e.shiftKey);
        setSortLetterMode(false);
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === "s") {
        setSortLetterMode(true);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [sortLetterMode, columnState.orderedVisible]);

  useScreenerKeyboard({
    focusedIndex,
    setFocusedIndex,
    totalRows: sorted.length,
    onActivateRow: setDetailTicker,
    onToggleSelect: toggleSelect,
    onToggleWatch: watchlist.toggle,
    searchInputRef,
    rowGetter,
    onEsc: () => {
      if (helpOpen) setHelpOpen(false);
      else if (filterOverlayOpen) setFilterOverlayOpen(false);
      else if (detailTicker) setDetailTicker(null);
    },
    onSelectScreenByFKey: (index) => {
      const screen = savedScreens.screens[index];
      if (screen) loadScreen(screen.id);
    },
    onToggleDensity: () => setDensity((d) => (d === "compact" ? "comfortable" : "compact")),
    onToggleFilters: () => setFilterOverlayOpen((v) => !v),
  });

  const visibleColumns = columnState.orderedVisible;

  const showSkeleton = Boolean(loading);
  const showError = Boolean(error) && !loading;
  const isTrulyEmpty = !loading && !error && enriched.length === 0;
  const isFilteredEmpty = !loading && !error && enriched.length > 0 && sorted.length === 0;

  return (
    <div className="mv-terminal relative flex flex-1 flex-col overflow-hidden bg-[var(--term-bg)]">
      <CommandLine
        value={commandText}
        onChange={setCommandText}
        onCommand={handleCommand}
        industries={industries}
        resultCount={sorted.length}
        totalCount={enriched.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        inputRef={searchInputRef}
      />
      <ScreenerToolbar
        query={toolbarQuery}
        onQueryChange={setToolbarQuery}
        searchInputRef={toolbarSearchInputRef}
        columns={COLUMN_DEFS}
        columnOrder={columnState.order}
        hiddenColumns={columnState.hidden}
        onToggleColumn={columnState.toggle}
        onMoveColumn={columnState.move}
        onResetColumns={columnState.reset}
        density={density}
        onDensityChange={setDensity}
        onExport={() => exportCompaniesCsv(sorted, columnState.orderedVisible)}
        compareCount={selectedTickers.size}
        onOpenCompare={() => setCompareOpen(true)}
        sort={sort}
        onSort={toggleSort}
        showHighlights={showHighlights}
        onToggleHighlights={() => setShowHighlights((v) => !v)}
        showSentiment={showSentiment}
        onToggleSentiment={() => setShowSentiment((v) => !v)}
        filtersOpen={filterOverlayOpen}
        onToggleFilters={() => setFilterOverlayOpen((v) => !v)}
        activeFilterCount={activeFilterGroupCount(activeFilters, bounds)}
        rightSlot={timeMachine}
      />

      <StatusLine
        tokens={activeTokens}
        onRemoveToken={handleRemoveToken}
        screenName={activeScreen?.name ?? "All"}
        screenModified={screenModified}
        companies={sorted}
        compareCount={selectedTickers.size}
        onOpenCompare={() => setCompareOpen(true)}
        stale={Boolean(historicalDate)}
        staleSince={historicalDate ?? null}
        staleLabel="HISTORICAL"
      />

      {showHighlights && (
        <>
          <MarketTickerTape companies={sorted} onActivateRow={setDetailTicker} />
          <div className="border-b border-[var(--term-hairline)] bg-[var(--term-bg)] px-4 py-2">
            <TopMoversBar companies={sorted} onActivateRow={setDetailTicker} />
          </div>
        </>
      )}

      {showSentiment && <SentimentStrip companies={sorted} />}

      <div className="relative flex flex-1 overflow-hidden">
        {filterOverlayOpen && (
          <FilterOverlay
            open={filterOverlayOpen}
            onClose={() => setFilterOverlayOpen(false)}
            industries={industries}
            companies={enriched}
            bounds={bounds}
            filters={activeFilters}
            commandText={commandText}
            onCommandTextChange={setCommandText}
          />
        )}

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className={detailTicker ? "flex w-[55%] shrink-0 flex-col overflow-hidden" : "flex flex-1 flex-col overflow-hidden"}>
            {showSkeleton ? (
              <ExplorerSkeleton columns={visibleColumns} density={density} />
            ) : showError ? (
              <ExplorerErrorState onRetry={onRetry} />
            ) : isTrulyEmpty ? (
              <ExplorerEmptyUniverse />
            ) : isFilteredEmpty ? (
              <ExplorerEmptyFiltered onReset={() => setCommandText("")} />
            ) : viewMode === "heatmap" ? (
              <HeatmapView companies={sorted} onActivateRow={setDetailTicker} />
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
                onActivateRow={setDetailTicker}
                changedTickers={changedTickers}
                onSectorClick={handleSectorClick}
              />
            )}
          </div>

          {detailTicker && (
            <DetailPanel
              ticker={detailTicker}
              watched={watchlist.watchedTickers.has(detailTicker)}
              onToggleWatch={watchlist.toggle}
              onClose={() => setDetailTicker(null)}
              gridRow={enriched.find((c) => c.ticker === detailTicker)}
            />
          )}
        </div>
      </div>

      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      <CompareDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        tickers={Array.from(selectedTickers)}
        companies={enriched}
        onRemove={toggleSelect}
      />

      <div className="pointer-events-none absolute right-4 top-[74px] opacity-0">
        <ColumnManager
          columns={COLUMN_DEFS}
          order={columnState.order}
          hidden={columnState.hidden}
          onToggle={columnState.toggle}
          onMove={columnState.move}
          onReset={columnState.reset}
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
        />
      </div>
    </div>
  );
}
