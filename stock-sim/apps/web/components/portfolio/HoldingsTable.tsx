"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, LayoutGrid, Rows3, Table2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useGridSort } from "@/lib/grid/useGridSort";
import type { GridColumn, SortState } from "@/lib/grid/types";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MiniAreaSpark } from "@/components/dashboard/primitives/MiniAreaSpark";
import { withWeights, withDayChange, type HoldingWithDayChange } from "@/lib/portfolio/holdingsMath";
import { usePriceHistory } from "@/lib/api/hooks/useCompany";
import { cn, cssVar, formatPct, formatPrice, trendColorClass } from "@/lib/utils";
import type { CompanyGridItem, HoldingResponse } from "@/lib/api/types";

export interface HoldingsTableProps {
  holdings: HoldingResponse[];
  totalValue: number;
  /** Market grid companies (already fetched by the Holdings page for the health strip) — joined
   * in here to source real per-holding day-change %, never fabricated or refetched. */
  companies?: CompanyGridItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

/** A note-for-note reuse of `useGridSort`'s asc/desc/none algorithm — this array exists purely to
 * supply sortable keys, not to render (this table draws its own header/rows so it can stay on
 * Meridian tokens without touching `lib/grid/*`'s legacy-token presentation, which is shared with
 * the Leaderboard table and out of scope here). */
const SORT_KEYS: GridColumn<HoldingWithDayChange>[] = [
  { key: "ticker", header: "", width: 0, sortable: true },
  { key: "company_name", header: "", width: 0, sortable: true },
  { key: "quantity", header: "", width: 0, sortable: true },
  { key: "avg_cost_basis", header: "", width: 0, sortable: true },
  { key: "current_price", header: "", width: 0, sortable: true },
  { key: "market_value", header: "", width: 0, sortable: true },
  { key: "weight", header: "", width: 0, sortable: true },
  { key: "unrealized_pnl", header: "", width: 0, sortable: true },
  { key: "unrealized_pnl_pct", header: "", width: 0, sortable: true },
  { key: "dayChange", header: "", width: 0, sortable: true },
];

const HEADER_STYLE: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  borderBottom: "1px solid var(--mer-stroke-hairline)",
  backgroundColor: "var(--mer-surface-2)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const STICKY_TICKER_STYLE: React.CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 20,
  backgroundColor: "var(--mer-surface-2)",
};

const ROW_ALT_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 255, 0.015)",
};

const ROW_HOVER_STYLE = "group flex cursor-pointer items-center border-b transition-all duration-150 hover:bg-[rgba(255,255,255,0.04)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]";

const PNILL_POSITIVE: React.CSSProperties = {
  backgroundColor: "rgba(34, 197, 94, 0.08)",
  color: "var(--positive)",
  borderRadius: "4px",
  padding: "1px 6px",
};

const PNILL_NEGATIVE: React.CSSProperties = {
  backgroundColor: "rgba(239, 68, 68, 0.08)",
  color: "var(--negative)",
  borderRadius: "4px",
  padding: "1px 6px",
};

interface HeaderCellProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  align?: "left" | "right";
}

function HeaderCell({ label, sortKey, sort, onSort, align = "left" }: HeaderCellProps) {
  const isSorted = sort.key === sortKey;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSort(sortKey)}
      className={cn(
        "flex shrink-0 cursor-pointer select-none items-center gap-1 px-3 py-2.5 text-micro font-medium uppercase transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-[-2px]",
        align === "right" && "justify-end text-right",
        isSorted ? "text-mer-accent-500" : "text-mer-ink-tertiary hover:text-mer-ink-secondary"
      )}
    >
      <span>{label}</span>
      {isSorted && sort.direction === "asc" && <ArrowUp size={11} />}
      {isSorted && sort.direction === "desc" && <ArrowDown size={11} />}
    </div>
  );
}

function HoldingSparkline({ ticker }: { ticker: string }) {
  const history = usePriceHistory(ticker);
  const data = React.useMemo(() => {
    const rows = history.data ?? [];
    return rows.slice(-30).map((item, i) => ({ time: i, value: Number(item.close) }));
  }, [history.data]);
  if (data.length < 2) return <span className="text-micro text-mer-ink-tertiary">—</span>;
  const positive = data[data.length - 1].value >= data[0].value;
  return <MiniAreaSpark data={data} height={24} color={positive ? cssVar('--positive') : cssVar('--negative')} />;
}

const COL_WIDTHS = {
  ticker: 88,
  name: 220,
  spark: 96,
  qty: 72,
  avgCost: 92,
  price: 92,
  value: 108,
  weight: 76,
  pnl: 112,
  pnlPct: 84,
  dayChange: 84,
};

function DensityToggle({ density, onChange }: { density: "comfortable" | "compact"; onChange: (d: "comfortable" | "compact") => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md" style={{ backgroundColor: "var(--mer-surface-3)", padding: "2px" }}>
      <button
        type="button"
        onClick={() => onChange("comfortable")}
        aria-pressed={density === "comfortable"}
        aria-label="Comfortable row density"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-sm transition-all duration-150",
          density === "comfortable"
            ? "bg-mer-accent-500 text-white shadow-[0_0_8px_rgba(62,111,224,0.3)]"
            : "text-mer-ink-tertiary hover:text-mer-ink-primary"
        )}
      >
        <Rows3 size={13} />
      </button>
      <button
        type="button"
        onClick={() => onChange("compact")}
        aria-pressed={density === "compact"}
        aria-label="Compact row density"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-sm transition-all duration-150",
          density === "compact"
            ? "bg-mer-accent-500 text-white shadow-[0_0_8px_rgba(62,111,224,0.3)]"
            : "text-mer-ink-tertiary hover:text-mer-ink-primary"
        )}
      >
        <LayoutGrid size={13} />
      </button>
    </div>
  );
}

/**
 * Institutional dense holdings grid — built fresh rather than extending `lib/grid/VirtualGrid`
 * (which is shared with the Leaderboard table and still on legacy tokens), so this can be fully
 * Meridian-styled without touching shared infrastructure outside Portfolio's scope. Not virtualized:
 * a simulated portfolio realistically holds a handful to a few dozen positions, well within what a
 * plain scrollable table handles without a windowing layer.
 */
export function HoldingsTable({ holdings, totalValue, companies = [], loading, error, onRetry }: HoldingsTableProps) {
  const router = useRouter();
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");
  const rowHeight = density === "comfortable" ? 48 : 32;

  const weighted = React.useMemo(
    () => withDayChange(withWeights(holdings, totalValue), companies),
    [holdings, totalValue, companies]
  );
  const { sortedData, sort, toggleSort } = useGridSort(weighted, SORT_KEYS);

  const prevValuesRef = React.useRef<Map<string, number>>(new Map());
  const [changedTickers, setChangedTickers] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const prev = prevValuesRef.current;
    const changed = new Set<string>();
    for (const h of holdings) {
      const last = prev.get(h.ticker);
      if (last != null && last !== Number(h.market_value)) changed.add(h.ticker);
    }
    if (changed.size > 0) {
      setChangedTickers(changed);
      const t = window.setTimeout(() => setChangedTickers(new Set()), 900);
      prevValuesRef.current = new Map(holdings.map((h) => [h.ticker, Number(h.market_value)]));
      return () => window.clearTimeout(t);
    }
    prevValuesRef.current = new Map(holdings.map((h) => [h.ticker, Number(h.market_value)]));
  }, [holdings]);

  const summaryPnl = React.useMemo(() => {
    let totalPnl = 0;
    let totalPnlPct = 0;
    let count = 0;
    for (const h of holdings) {
      totalPnl += Number(h.unrealized_pnl);
      totalPnlPct += Number(h.unrealized_pnl_pct);
      count++;
    }
    return {
      totalValue: totalValue,
      totalPnl,
      avgPnlPct: count > 0 ? totalPnlPct / count : 0,
    };
  }, [holdings, totalValue]);

  return (
    <DashboardPanel
      eyebrow="Top Holdings"
      title="Positions"
      icon={Table2}
      noBodyPadding
      actions={!loading && !error && holdings.length > 0 ? <DensityToggle density={density} onChange={setDensity} /> : undefined}
    >
      {loading ? (
        <div className="flex flex-col gap-1.5 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={rowHeight - 8} />
          ))}
        </div>
      ) : error ? (
        <div className="p-4">
          <ErrorState message="Could not load holdings." onRetry={onRetry} />
        </div>
      ) : holdings.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No holdings yet." description="Start trading on the market page." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div style={HEADER_STYLE}>
              <div style={{ ...STICKY_TICKER_STYLE, width: COL_WIDTHS.ticker }}>
                <HeaderCell label="Ticker" sortKey="ticker" sort={sort} onSort={toggleSort} />
              </div>
              <div style={{ width: COL_WIDTHS.name }}>
                <HeaderCell label="Name" sortKey="company_name" sort={sort} onSort={toggleSort} />
              </div>
              <div
                className="flex items-center px-3 text-micro font-medium uppercase text-mer-ink-tertiary"
                style={{ width: COL_WIDTHS.spark }}
              >
                30D
              </div>
              <div style={{ width: COL_WIDTHS.qty }}>
                <HeaderCell label="Qty" sortKey="quantity" sort={sort} onSort={toggleSort} align="right" />
              </div>
              <div style={{ width: COL_WIDTHS.avgCost }}>
                <HeaderCell label="Avg Cost" sortKey="avg_cost_basis" sort={sort} onSort={toggleSort} align="right" />
              </div>
              <div style={{ width: COL_WIDTHS.price }}>
                <HeaderCell label="Price" sortKey="current_price" sort={sort} onSort={toggleSort} align="right" />
              </div>
              <div style={{ width: COL_WIDTHS.value }}>
                <HeaderCell label="Mkt Value" sortKey="market_value" sort={sort} onSort={toggleSort} align="right" />
              </div>
              <div style={{ width: COL_WIDTHS.weight }}>
                <HeaderCell label="Weight" sortKey="weight" sort={sort} onSort={toggleSort} align="right" />
              </div>
              <div style={{ width: COL_WIDTHS.pnl }}>
                <HeaderCell label="Unrealized P&L" sortKey="unrealized_pnl" sort={sort} onSort={toggleSort} align="right" />
              </div>
              <div style={{ width: COL_WIDTHS.pnlPct }}>
                <HeaderCell label="P&L %" sortKey="unrealized_pnl_pct" sort={sort} onSort={toggleSort} align="right" />
              </div>
              <div style={{ width: COL_WIDTHS.dayChange }}>
                <HeaderCell label="Day Chg" sortKey="dayChange" sort={sort} onSort={toggleSort} align="right" />
              </div>
            </div>

            <div>
              {sortedData.map((h, idx) => {
                const changed = changedTickers.has(h.ticker);
                const pnlPositive = Number(h.unrealized_pnl) >= 0;
                return (
                  <div
                    key={h.ticker}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/companies/${h.ticker}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/companies/${h.ticker}`)}
                    className={cn(
                      ROW_HOVER_STYLE,
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-[-2px]"
                    )}
                    style={{
                      height: rowHeight,
                      ...(idx % 2 === 1 ? ROW_ALT_STYLE : {}),
                      borderBottom: "1px solid var(--mer-stroke-hairline)",
                    }}
                  >
                    <div
                      className="sticky left-0 z-[5] flex h-full items-center px-3 group-hover:bg-[var(--mer-surface-3)]"
                      style={{
                        width: COL_WIDTHS.ticker,
                        backgroundColor: "var(--mer-surface-2)",
                      }}
                    >
                      <span
                        className="num text-small font-bold uppercase text-mer-ink-primary"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        {h.ticker}
                      </span>
                    </div>
                    <div className="flex items-center px-3 text-small text-mer-ink-secondary" style={{ width: COL_WIDTHS.name }}>
                      <span className="truncate">{h.company_name}</span>
                    </div>
                    <div className="flex items-center px-3" style={{ width: COL_WIDTHS.spark }}>
                      <HoldingSparkline ticker={h.ticker} />
                    </div>
                    <div
                      className="num flex items-center justify-end px-3 text-small text-mer-ink-primary"
                      style={{ width: COL_WIDTHS.qty, fontFamily: "var(--font-mono)" }}
                    >
                      {h.quantity.toLocaleString()}
                    </div>
                    <div
                      className="num flex items-center justify-end px-3 text-small text-mer-ink-secondary"
                      style={{ width: COL_WIDTHS.avgCost, fontFamily: "var(--font-mono)" }}
                    >
                      {formatPrice(h.avg_cost_basis)}
                    </div>
                    <div
                      className={cn("num flex items-center justify-end px-3 text-small text-mer-ink-primary", changed && "cell-flash")}
                      style={{ width: COL_WIDTHS.price, fontFamily: "var(--font-mono)" }}
                    >
                      {formatPrice(h.current_price)}
                    </div>
                    <div
                      className={cn("num flex items-center justify-end px-3 text-small font-medium text-mer-ink-primary", changed && "cell-flash")}
                      style={{ width: COL_WIDTHS.value, fontFamily: "var(--font-mono)" }}
                    >
                      {formatPrice(h.market_value)}
                    </div>
                    <div
                      className="num flex items-center justify-end px-3 text-small text-mer-ink-secondary"
                      style={{ width: COL_WIDTHS.weight, fontFamily: "var(--font-mono)" }}
                    >
                      {formatPct(h.weight)}
                    </div>
                    <div
                      className={cn("num flex items-center justify-end px-3 text-small font-medium", changed && "cell-flash")}
                      style={{
                        width: COL_WIDTHS.pnl,
                        fontFamily: "var(--font-mono)",
                        ...(pnlPositive ? PNILL_POSITIVE : PNILL_NEGATIVE),
                      }}
                    >
                      {formatPrice(h.unrealized_pnl)}
                    </div>
                    <div
                      className="num flex items-center justify-end px-3 text-small font-medium"
                      style={{
                        width: COL_WIDTHS.pnlPct,
                        fontFamily: "var(--font-mono)",
                        color: pnlPositive ? "var(--positive)" : "var(--negative)",
                      }}
                    >
                      {formatPct(h.unrealized_pnl_pct)}
                    </div>
                    <div
                      className={cn("num flex items-center justify-end px-3 text-small font-medium", trendColorClass(h.dayChange))}
                      style={{ width: COL_WIDTHS.dayChange }}
                    >
                      {formatPct(h.dayChange)}
                    </div>
                  </div>
                );
              })}
            </div>

            {sortedData.length > 0 && (
              <div
                className="flex items-center border-t"
                style={{
                  height: rowHeight,
                  borderTop: "1px solid var(--mer-stroke-emphasis)",
                  backgroundColor: "rgba(255, 255, 255, 0.025)",
                }}
              >
                <div
                  className="sticky left-0 z-[5] flex h-full items-center px-3"
                  style={{ width: COL_WIDTHS.ticker, backgroundColor: "var(--mer-surface-3)" }}
                >
                  <span className="text-micro font-semibold uppercase text-mer-ink-secondary" style={{ letterSpacing: "0.06em" }}>
                    Total
                  </span>
                </div>
                <div style={{ width: COL_WIDTHS.name }} />
                <div style={{ width: COL_WIDTHS.spark }} />
                <div style={{ width: COL_WIDTHS.qty }} />
                <div style={{ width: COL_WIDTHS.avgCost }} />
                <div style={{ width: COL_WIDTHS.price }} />
                <div
                  className="num flex items-center justify-end px-3 text-small font-semibold text-mer-ink-primary"
                  style={{ width: COL_WIDTHS.value, fontFamily: "var(--font-mono)" }}
                >
                  {formatPrice(summaryPnl.totalValue)}
                </div>
                <div style={{ width: COL_WIDTHS.weight }} />
                <div
                  className="num flex items-center justify-end px-3 text-small font-semibold"
                  style={{
                    width: COL_WIDTHS.pnl,
                    fontFamily: "var(--font-mono)",
                    ...(summaryPnl.totalPnl >= 0 ? PNILL_POSITIVE : PNILL_NEGATIVE),
                  }}
                >
                  {formatPrice(summaryPnl.totalPnl)}
                </div>
                <div
                  className="num flex items-center justify-end px-3 text-small font-semibold"
                  style={{
                    width: COL_WIDTHS.pnlPct,
                    fontFamily: "var(--font-mono)",
                    color: summaryPnl.avgPnlPct >= 0 ? "var(--positive)" : "var(--negative)",
                  }}
                >
                  {formatPct(summaryPnl.avgPnlPct)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
