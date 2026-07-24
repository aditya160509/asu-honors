"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, ExternalLink, Star } from "lucide-react";
import gsap from "gsap";
import { PriceChart, type IndicatorKey } from "@/components/charts/PriceChart";
import { ChartTypePicker } from "@/components/ui/ChartTypePicker";
import { IndicatorPicker } from "@/components/ui/IndicatorPicker";
import { DrawingToolbar } from "@/components/ui/DrawingToolbar";
import { DrawingManager } from "@/lib/charts/drawing/DrawingManager";
import { INDICATOR_REGISTRY, type IndicatorType } from "@/lib/charts/indicators";
import type { DrawingToolType } from "@/lib/charts/drawing/types";
import type { ChartType } from "@/lib/charts/types";
import { useCompany, usePriceHistory, useValuation } from "@/lib/api/hooks/useCompany";
import { useNews } from "@/lib/api/hooks/useNews";
import { useConCalls } from "@/lib/api/hooks/useConCalls";
import { buildConCallMarkers } from "@/lib/companies/conCallMarkers";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface DetailPanelProps {
  ticker: string;
  watched: boolean;
  onToggleWatch: (ticker: string) => void;
  onClose: () => void;
  /** 52-week range lives on the market-grid row, not the company-detail
   * response — reuse what the table already fetched instead of a second call. */
  gridRow?: EnrichedCompany;
}

const BLOCKS = "▁▂▃▄▅▆▇█";

/** Text-drawn 52-week range slider — Bloomberg-style ASCII gauge instead of
 * a graphical progress bar, consistent with the all-mono terminal aesthetic. */
function RangeGauge({ low, high, current }: { low: number | null; high: number | null; current: number | null }) {
  if (low == null || high == null || current == null || high <= low) {
    return <span className="text-[var(--term-ink-tertiary)]">—</span>;
  }
  const pct = Math.max(0, Math.min(1, (current - low) / (high - low)));
  const steps = 24;
  const filled = Math.round(pct * steps);
  const bar = Array.from({ length: steps }, (_, i) => (i < filled ? BLOCKS[Math.min(7, Math.floor(((i + 1) / steps) * 8))] : "·")).join("");
  return (
    <span className="group/ticker tabular-nums transition-all duration-150">
      <span className="text-[var(--term-ink-tertiary)]">{formatPrice(low)} </span>
      <span className="text-[var(--term-accent)] transition-all duration-150 group-hover/ticker:text-[var(--term-ink-secondary)]">{bar}</span>
      <span className="text-[var(--term-ink-tertiary)]"> {formatPrice(high)}</span>
      <span className="ml-1.5 text-[10px] text-[var(--term-ink-tertiary)] opacity-0 transition-opacity duration-150 group-hover/ticker:opacity-100">{(pct * 100).toFixed(1)}%</span>
    </span>
  );
}

function Field({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="group flex items-baseline justify-between gap-2 rounded-sm px-1 py-[3px] transition-all duration-150 hover:bg-white/[0.03]">
      <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">{label}</span>
      <span
        className={cn(
          "num text-right text-[13px] tabular-nums transition-colors duration-150",
          tone === "up" ? "text-[var(--term-up)]" : tone === "down" ? "text-[var(--term-down)]" : "text-[var(--term-ink)]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function DetailPanel({ ticker, watched, onToggleWatch, onClose, gridRow }: DetailPanelProps) {
  const company = useCompany(ticker);
  const history = usePriceHistory(ticker);
  const valuation = useValuation(ticker);
  const news = useNews({ companyId: company.data?.id, limit: 3 });
  const conCalls = useConCalls({ ticker, limit: 8 });

  const [chartType, setChartType] = React.useState<ChartType>("candlestick");
  const [activeOverlays, setActiveOverlays] = React.useState<IndicatorType[]>(["sma20"]);
  const [drawingManager] = React.useState(() => new DrawingManager());
  const [activeDrawingTool, setActiveDrawingTool] = React.useState<DrawingToolType | null>(null);

  function toggleOverlay(type: IndicatorType) {
    setActiveOverlays((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  React.useEffect(() => {
    return drawingManager.subscribe(() => setActiveDrawingTool(drawingManager.activeTool));
  }, [drawingManager]);

  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    gsap.fromTo(el, { x: 320, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "back.out(1.7)" });
    return () => { gsap.killTweensOf(el); };
  }, []);

  // Sidebar-width panel — price overlays only (no sub-chart panes like RSI/MACD,
  // which need their own ~96px pane each and would crowd the Fields/News below).
  const priceIndicators = React.useMemo(
    () => activeOverlays.filter((t): t is IndicatorKey => INDICATOR_REGISTRY[t].type === "overlay"),
    [activeOverlays]
  );

  const conCallMarkers = React.useMemo(
    () => buildConCallMarkers(conCalls.data ?? [], history.data ?? []),
    [conCalls.data, history.data]
  );

  const price = company.data?.latest_price != null ? Number(company.data.latest_price) : null;
  const dayChangePct =
    history.data && history.data.length >= 2
      ? ((Number(history.data[history.data.length - 1].close) - Number(history.data[history.data.length - 2].close)) /
          Number(history.data[history.data.length - 2].close)) *
        100
      : null;
  const dayChangeAbs =
    history.data && history.data.length >= 2 && price != null
      ? price - Number(history.data[history.data.length - 2].close)
      : null;

  return (
    <div ref={panelRef} className="flex h-full w-full flex-col overflow-y-auto border-l border-[var(--term-hairline)] bg-[var(--term-bg)] font-mono will-change-[transform,opacity]">
      <div className="flex items-center justify-between border-b border-[var(--term-divider)] px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-[var(--term-ink)]">{ticker}</span>
          <span className="truncate text-[12px] text-[var(--term-ink-secondary)]" style={{ fontFamily: "var(--font-sans)" }}>
            {company.data?.name ?? "…"}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close detail panel (Esc)" className="text-[11px] uppercase tracking-[0.06em] text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink)]">
          Esc ×
        </button>
      </div>

      <div className="border-b border-[var(--term-hairline)] px-4 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[20px] font-semibold tabular-nums text-[var(--term-ink)]">{price != null ? formatPrice(price) : "—"}</span>
          {dayChangePct != null && (
            <span className={cn("tabular-nums text-[13px]", dayChangePct >= 0 ? "text-[var(--term-up)]" : "text-[var(--term-down)]")}>
              {dayChangePct >= 0 ? "▲" : "▼"} {formatPct(dayChangePct)}
            </span>
          )}
        </div>
      </div>

      <div className="border-b border-[var(--term-hairline)] px-2 py-1.5">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <ChartTypePicker value={chartType} onChange={setChartType} />
          <IndicatorPicker activeIndicators={activeOverlays} onToggle={toggleOverlay} />
        </div>
        <div className="flex h-44 gap-1.5">
          <div className="w-9 shrink-0 overflow-hidden rounded-sm border border-[var(--term-hairline)]">
            <DrawingToolbar manager={drawingManager} />
          </div>
          <div className="min-w-0 flex-1 transition-shadow duration-300 hover:shadow-[0_0_12px_var(--term-amber)]/15">
            <PriceChart
              data={history.data ?? []}
              loading={history.isLoading}
              error={history.isError}
              onRetry={() => history.refetch()}
              ticker={ticker}
              height={176}
              chartType={chartType}
              indicators={priceIndicators}
              drawingManager={drawingManager}
              activeDrawingTool={activeDrawingTool}
              events={conCallMarkers}
            />
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--term-hairline)] px-4 py-[7px]">
        <Field label="Price" value={price != null ? formatPrice(price) : "—"} />
        <Field label="Chg" value={dayChangeAbs != null ? formatPrice(dayChangeAbs) : "—"} tone={dayChangeAbs != null ? (dayChangeAbs >= 0 ? "up" : "down") : undefined} />
        <div className="flex items-baseline justify-between gap-2 py-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">Range 52W</span>
          <RangeGauge low={gridRow?.low_52w != null ? Number(gridRow.low_52w) : null} high={gridRow?.high_52w != null ? Number(gridRow.high_52w) : null} current={price} />
        </div>
        <Field label="Mkt Cap" value={formatLarge(company.data?.market_cap ?? null)} />
        <Field label="P/E" value={company.data?.pe_ratio != null ? Number(company.data.pe_ratio).toFixed(2) : "—"} />
        <Field
          label="IV Gap"
          value={
            company.data?.latest_iv && Number(company.data.latest_iv) > 0 && price != null
              ? formatPct(((price - Number(company.data.latest_iv)) / Number(company.data.latest_iv)) * 100)
              : "—"
          }
        />
        <Field label="Intr Val" value={formatPrice(company.data?.latest_iv ?? null)} />
        {valuation.data && (
          <>
            <Field label="Intr Score" value={valuation.data.intrinsic_score.toFixed(1)} />
            <Field label="Moat" value={valuation.data.moat_score.toFixed(1)} />
          </>
        )}
      </div>

      <div className="flex-1 border-b border-[var(--term-hairline)] px-4 py-2">
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">News</div>
        {news.isLoading ? (
          <div className="text-[12px] text-[var(--term-ink-tertiary)]">…</div>
        ) : news.data && news.data.length > 0 ? (
          <div className="flex flex-col gap-1">
            {news.data.map((n) => (
              <div key={n.id} className="group cursor-pointer rounded-sm border-l-2 border-transparent px-1 py-[2px] text-[12px] leading-snug transition-all duration-150 hover:border-[var(--term-amber)] hover:bg-white/[0.03]" style={{ fontFamily: "var(--font-sans)" }}>
                <span className="text-[var(--term-ink-tertiary)]">{n.sim_date} </span>
                <span className="text-[var(--term-ink-secondary)] transition-colors duration-150 group-hover:text-[var(--term-ink)]">{n.headline}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[var(--term-ink-tertiary)]">No news yet.</div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3 pt-2">
        <Link
          href={`/companies/${ticker}`}
          className="group flex h-10 items-center justify-center gap-1.5 rounded-sm border border-[var(--term-divider)] text-[13px] font-medium text-[var(--term-ink)] transition-all duration-200 hover:border-[var(--term-amber)] hover:text-[var(--term-amber)]"
        >
          <ExternalLink size={15} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          Open Full
        </Link>
        <button
          type="button"
          onClick={() => onToggleWatch(ticker)}
          aria-pressed={watched}
          className={cn(
            "group flex h-10 items-center justify-center gap-1.5 rounded-sm border text-[13px] font-medium transition-all duration-200",
            watched
              ? "border-[var(--term-amber)] bg-[var(--term-amber)]/10 text-[var(--term-amber)]"
              : "border-[var(--term-divider)] text-[var(--term-ink)] hover:border-[var(--term-amber)] hover:text-[var(--term-amber)]"
          )}
        >
          <Star size={15} className="transition-all duration-200" fill={watched ? "currentColor" : "transparent"} />
          {watched ? "Watching" : "Watch"}
        </button>
        <button
          type="button"
          disabled
          title="Price alerts are coming soon"
          className="flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-sm border border-[var(--term-divider)] text-[13px] font-medium text-[var(--term-ink-tertiary)] opacity-50"
        >
          <Bell size={15} />
          Alert
        </button>
      </div>
    </div>
  );
}
