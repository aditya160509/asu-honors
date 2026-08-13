"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, ExternalLink, FileText, Search, ShieldCheck, Star } from "lucide-react";
import gsap from "gsap";
import { PriceChart, type IndicatorKey } from "@/components/charts/PriceChart";
import { ChartTypePicker } from "@/components/ui/ChartTypePicker";
import { IndicatorPicker } from "@/components/ui/IndicatorPicker";
import { DrawingToolbar } from "@/components/ui/DrawingToolbar";
import { DrawingManager } from "@/lib/charts/drawing/DrawingManager";
import { INDICATOR_REGISTRY, type IndicatorType } from "@/lib/charts/indicators";
import type { DrawingToolType } from "@/lib/charts/drawing/types";
import type { ChartType } from "@/lib/charts/types";
import { useCompany, useFinancialsHistory, usePriceHistory, useValuation } from "@/lib/api/hooks/useCompany";
import { useNews } from "@/lib/api/hooks/useNews";
import { useConCalls } from "@/lib/api/hooks/useConCalls";
import { useChartAnnotations, useDcf, useScreenerEventImpacts, useScreenerNewsClusters, useScreenerPeers, useScreenerTranscriptSearch } from "@/lib/api/hooks/useScreener";
import { buildConCallMarkers, buildEventImpactMarkers } from "@/lib/companies/conCallMarkers";
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
  /** Screener time-machine date; research calculations must not silently jump
   * back to the live timeline when a historical result is opened. */
  asOfDate?: string | null;
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

function statementNumber(value: unknown): string {
  if (value == null || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (Math.abs(numeric) >= 1_000_000) return formatLarge(numeric);
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function FinancialsDock({ history, loading }: { history: Array<{ fiscal_period: string; income_statement: Record<string, unknown> | null; balance_sheet: Record<string, unknown> | null; cash_flow_statement: Record<string, unknown> | null }>; loading: boolean }) {
  const rows = history.slice(0, 8);
  const fields = [
    ["Revenue", "income_statement", "revenue"],
    ["Gross profit", "income_statement", "gross_profit"],
    ["EBITDA", "income_statement", "ebitda"],
    ["Net profit", "income_statement", "net_profit"],
    ["EPS", "income_statement", "eps"],
    ["Free cash flow", "cash_flow_statement", "free_cash_flow"],
  ] as const;
  return (
    <div className="flex-1 overflow-y-auto border-b border-[var(--term-hairline)] px-3 py-2">
      <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">Financial statements</span><span className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">reported periods · timeline scoped</span></div>
      {loading ? <div className="font-mono text-[12px] text-[var(--term-ink-tertiary)]">Loading statements…</div> : rows.length === 0 ? <div className="font-mono text-[12px] text-[var(--term-ink-tertiary)]">No statement history for this company.</div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse font-mono text-[10px]">
            <thead><tr className="border-b border-[var(--term-divider)] text-[var(--term-ink-tertiary)]"><th className="px-1 py-1 text-left font-normal">Metric</th>{rows.map((row) => <th key={row.fiscal_period} className="px-1 py-1 text-right font-normal">{row.fiscal_period}</th>)}</tr></thead>
            <tbody>{fields.map(([label, statement, key]) => <tr key={key} className="border-b border-[var(--term-hairline)]"><td className="px-1 py-1 text-[var(--term-ink-secondary)]">{label}</td>{rows.map((row) => <td key={`${row.fiscal_period}-${key}`} className="px-1 py-1 text-right tabular-nums text-[var(--term-ink)]">{statementNumber(row[statement]?.[key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TranscriptDock({ ticker, calls, loading, asOfDate }: { ticker: string; calls: Array<{ id: number; fiscal_period: string; call_date: string; tone: string; tone_score: number; guidance_revenue_growth: number; statements: Record<string, string>; qa_transcript: Array<{ analyst_name: string; analyst_firm: string; question: string; answer: string }> }>; loading: boolean; asOfDate?: string | null }) {
  const [search, setSearch] = React.useState("");
  const transcriptSearch = useScreenerTranscriptSearch(ticker, search, { asOfDate });
  const searchActive = Boolean(search.trim());
  const filtered = searchActive ? [] : calls;
  return (
    <div className="flex-1 overflow-y-auto border-b border-[var(--term-hairline)] px-3 py-2">
      <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">Earnings transcript search</span><span className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">{searchActive ? `${transcriptSearch.data?.matches.length ?? 0} passages` : `${filtered.length} calls`}</span></div>
      <div className="mb-2 flex items-center gap-2 border border-[var(--term-divider)] px-2"><Search size={11} className="text-[var(--term-ink-tertiary)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guidance, margin, analyst question…" aria-label="Search earnings transcripts" className="h-7 min-w-0 flex-1 bg-transparent font-mono text-[11px] text-[var(--term-ink)] outline-none placeholder:text-[var(--term-ink-tertiary)]" /></div>
      {loading || (searchActive && transcriptSearch.isLoading) ? <div className="font-mono text-[12px] text-[var(--term-ink-tertiary)]">Searching transcript index…</div> : searchActive ? (transcriptSearch.data?.matches ?? []).length === 0 ? <div className="font-mono text-[12px] text-[var(--term-ink-tertiary)]">No matching transcript passages.</div> : <div className="space-y-2">{(transcriptSearch.data?.matches ?? []).map((match, index) => <article key={`${match.call_id}-${match.section}-${index}`} className="border border-[var(--term-divider)] p-2"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] font-semibold text-[var(--term-ink)]">{match.fiscal_period} · {match.section}</span><span className="font-mono text-[10px] uppercase text-[var(--term-amber)]">{match.tone}</span></div><div className="mt-1 font-mono text-[10px] text-[var(--term-ink-tertiary)]">{match.call_date} · tone {match.tone_score.toFixed(2)} · source {match.call_id}</div><p className="mt-1 font-sans text-[11px] leading-snug text-[var(--term-ink-secondary)]">{match.snippet}</p></article>)}</div> : filtered.length === 0 ? <div className="font-mono text-[12px] text-[var(--term-ink-tertiary)]">No transcript calls available.</div> : <div className="space-y-2">{filtered.map((call) => <article key={call.id} className="border border-[var(--term-divider)] p-2"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] font-semibold text-[var(--term-ink)]">{call.fiscal_period}</span><span className="font-mono text-[10px] uppercase text-[var(--term-amber)]">{call.tone}</span></div><div className="mt-1 font-mono text-[10px] text-[var(--term-ink-tertiary)]">{call.call_date} · guidance {formatPct(call.guidance_revenue_growth * 100)} · tone {call.tone_score.toFixed(2)}</div><p className="mt-1 font-sans text-[11px] leading-snug text-[var(--term-ink-secondary)]">{Object.values(call.statements ?? {})[0] ?? "Transcript available."}</p></article>)}</div>}
    </div>
  );
}

function DcfDock({ ticker, asOfDate }: { ticker: string; asOfDate?: string | null }) {
  const [assumptions, setAssumptions] = React.useState({ revenue_growth: 0.08, ebitda_margin: 0.22, tax_rate: 0.21, reinvestment_rate: 0.25, wacc: 0.09, terminal_growth: 0.025, projection_years: 5, sensitivity_step: 0.01 });
  const dcf = useDcf(ticker, assumptions, undefined, asOfDate);
  function update(key: keyof typeof assumptions, value: string) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) setAssumptions((previous) => ({ ...previous, [key]: key === "projection_years" ? Math.max(1, Math.min(15, Math.round(numeric))) : numeric }));
  }
  return (
    <div className="flex-1 overflow-y-auto border-b border-[var(--term-hairline)] px-3 py-2">
      <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">DCF scenario</span><span className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">independent from factor IV</span></div>
      <div className="grid grid-cols-2 gap-2">{([["revenue_growth", "Growth", "%"], ["ebitda_margin", "EBITDA margin", "%"], ["wacc", "WACC", "%"], ["terminal_growth", "Terminal g", "%"]] as const).map(([key, label, suffix]) => <label key={key} className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">{label}<div className="mt-1 flex items-center border border-[var(--term-divider)] px-2"><input type="number" step="0.01" value={assumptions[key]} onChange={(event) => update(key, event.target.value)} className="h-6 w-full bg-transparent text-right font-mono text-[11px] text-[var(--term-ink)] outline-none" /><span>{suffix}</span></div></label>)}</div>
      {dcf.isLoading ? <div className="mt-3 font-mono text-[11px] text-[var(--term-ink-tertiary)]">Calculating scenario…</div> : dcf.isError ? <div className="mt-3 font-mono text-[11px] text-[var(--term-down)]">No statement base available for this scenario.</div> : dcf.data && <><div className="mt-3 grid grid-cols-2 gap-2"><Field label="DCF / share" value={formatPrice(dcf.data.per_share_value)} /><Field label="Equity value" value={formatLarge(dcf.data.equity_value)} /></div><div className="mt-3 overflow-x-auto"><div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-ink-tertiary)]">Sensitivity · WACC × terminal growth</div><table className="w-full min-w-[360px] border-collapse font-mono text-[9px]"><thead><tr className="border-b border-[var(--term-divider)]"><th className="px-1 py-1 text-left text-[var(--term-ink-tertiary)]">WACC / g</th>{[-2, -1, 0, 1, 2].map((delta) => <th key={delta} className="px-1 py-1 text-right text-[var(--term-ink-tertiary)]">{((assumptions.terminal_growth + delta * assumptions.sensitivity_step) * 100).toFixed(1)}%</th>)}</tr></thead><tbody>{[-2, -1, 0, 1, 2].map((waccDelta) => <tr key={waccDelta} className="border-b border-[var(--term-hairline)]"><td className="px-1 py-1 text-[var(--term-ink-tertiary)]">{((assumptions.wacc + waccDelta * assumptions.sensitivity_step) * 100).toFixed(1)}%</td>{[-2, -1, 0, 1, 2].map((growthDelta) => { const cell = dcf.data!.sensitivity.find((item) => Math.abs(item.wacc - (assumptions.wacc + waccDelta * assumptions.sensitivity_step)) < 1e-9 && Math.abs(item.terminal_growth - (assumptions.terminal_growth + growthDelta * assumptions.sensitivity_step)) < 1e-9); return <td key={growthDelta} className="px-1 py-1 text-right tabular-nums text-[var(--term-ink-secondary)]">{cell?.per_share_value == null ? "—" : formatPrice(cell.per_share_value)}</td>; })}</tr>)}</tbody></table></div><div className="mt-2 font-mono text-[10px] text-[var(--term-ink-tertiary)]">Source: {dcf.data.provenance.source} · {dcf.data.provenance.calculation_version}. Change assumptions to rerun.</div></>}
    </div>
  );
}

export function DetailPanel({ ticker, watched, onToggleWatch, onClose, gridRow, asOfDate }: DetailPanelProps) {
  const company = useCompany(ticker);
  const history = usePriceHistory(ticker, undefined, undefined, asOfDate ?? undefined);
  const valuation = useValuation(ticker);
  const financials = useFinancialsHistory(ticker);
  const news = useNews({ companyId: company.data?.id, simDate: asOfDate ?? undefined, limit: 3 });
  const conCalls = useConCalls({ ticker, limit: 8 });
  const newsClusters = useScreenerNewsClusters(ticker, { asOfDate });
  const eventImpacts = useScreenerEventImpacts(ticker, { asOfDate });
  const peers = useScreenerPeers(ticker, { asOfDate });

  const [chartType, setChartType] = React.useState<ChartType>("candlestick");
  const [activeOverlays, setActiveOverlays] = React.useState<IndicatorType[]>(["sma20"]);
  const [drawingManager] = React.useState(() => new DrawingManager());
  const [activeDrawingTool, setActiveDrawingTool] = React.useState<DrawingToolType | null>(null);
  const [researchTab, setResearchTab] = React.useState<"overview" | "financials" | "transcript" | "dcf" | "peers" | "events" | "evidence">("overview");
  const annotations = useChartAnnotations(ticker);
  const annotationIdRef = React.useRef<number | null>(null);

  function toggleOverlay(type: IndicatorType) {
    setActiveOverlays((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  React.useEffect(() => {
    return drawingManager.subscribe(() => setActiveDrawingTool(drawingManager.activeTool));
  }, [drawingManager]);

  React.useEffect(() => {
    const latest = annotations.data?.[0];
    if (!latest || drawingManager.getDrawings().length > 0) return;
    annotationIdRef.current = latest.id;
    if (latest.anchors.length > 0) drawingManager.fromJSON(latest.anchors);
  }, [annotations.data, drawingManager]);

  React.useEffect(() => {
    if (!annotations.authenticated) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const persist = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const body = {
          ticker,
          timeline_id: 1,
          timeframe: "1D",
          tool: "workspace",
          anchors: drawingManager.toJSON().slice(0, 50),
          style: {},
          evidence: { source: "Market Explorer chart drawings", ticker },
        };
        const id = annotationIdRef.current;
        if (id) annotations.update.mutate({ id, body });
        else annotations.create.mutate(body, { onSuccess: (created) => { annotationIdRef.current = created.id; } });
      }, 650);
    };
    const unsubscribe = drawingManager.subscribe(persist);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [annotations, drawingManager, ticker]);

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
  const eventMarkers = React.useMemo(
    () => buildEventImpactMarkers(eventImpacts.data?.events ?? [], history.data ?? []),
    [eventImpacts.data, history.data]
  );

  const price = asOfDate && gridRow?.current_price != null ? Number(gridRow.current_price) : company.data?.latest_price != null ? Number(company.data.latest_price) : null;
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
        <Link href={`/companies/${ticker}`} className="ml-auto mr-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-[var(--term-accent)] hover:text-white">
          Full ticker view <ExternalLink size={11} />
        </Link>
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

      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--term-hairline)] px-3 py-1.5" role="tablist" aria-label="Company research dock">
        {(["overview", "financials", "transcript", "dcf", "peers", "events", "evidence"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={researchTab === tab} onClick={() => setResearchTab(tab)} className={cn("px-2 py-1 font-mono text-[10px] uppercase tracking-[0.05em] transition-colors", researchTab === tab ? "border-b border-[var(--term-amber)] text-[var(--term-amber)]" : "text-[var(--term-ink-tertiary)] hover:text-[var(--term-ink-secondary)]")}>{tab === "transcript" ? "Calls" : tab === "peers" ? "Peers" : tab === "events" ? "Impact" : tab}</button>)}
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
              events={[...conCallMarkers, ...eventMarkers]}
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

      {researchTab === "overview" && <div className="flex-1 border-b border-[var(--term-hairline)] px-4 py-2">
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
            {newsClusters.data?.clusters && newsClusters.data.clusters.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--term-hairline)] pt-2"><span className="mr-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--term-ink-tertiary)]">Themes</span>{newsClusters.data.clusters.slice(0, 4).map((cluster) => <span key={cluster.theme} className="border border-[var(--term-divider)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--term-ink-secondary)]">{cluster.label} · {cluster.count}</span>)}</div>}
          </div>
        ) : (
          <div className="text-[12px] text-[var(--term-ink-tertiary)]">No news yet.</div>
        )}
      </div>}

      {researchTab === "financials" && <FinancialsDock history={financials.data ?? []} loading={financials.isLoading} />}

      {researchTab === "transcript" && <TranscriptDock ticker={ticker} calls={conCalls.data ?? []} loading={conCalls.isLoading} asOfDate={asOfDate} />}

      {researchTab === "dcf" && <DcfDock ticker={ticker} asOfDate={asOfDate} />}

      {researchTab === "peers" && <div className="flex-1 overflow-y-auto border-b border-[var(--term-hairline)] px-3 py-2"><div className="mb-2 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">Fundamental peer comparison</span><span className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">{peers.data?.total ?? 0} peers · percentile ranks</span></div>{peers.isLoading ? <div className="font-mono text-[11px] text-[var(--term-ink-tertiary)]">Loading peers…</div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] border-collapse font-mono text-[10px]"><thead><tr className="border-b border-[var(--term-divider)] text-[var(--term-ink-tertiary)]"><th className="px-1 py-1 text-left">Ticker</th><th className="px-1 py-1 text-right">Price</th><th className="px-1 py-1 text-right">IV gap</th><th className="px-1 py-1 text-right">Revenue growth</th><th className="px-1 py-1 text-right">Op margin</th><th className="px-1 py-1 text-right">Cash conv.</th><th className="px-1 py-1 text-right">Quality pctl</th></tr></thead><tbody>{(peers.data?.rows ?? []).slice(0, 12).map((row) => <tr key={row.company.ticker} className="border-b border-[var(--term-hairline)]"><td className="px-1 py-1 font-semibold text-[var(--term-ink)]">{row.company.ticker}</td><td className="px-1 py-1 text-right tabular-nums text-[var(--term-ink-secondary)]">{formatPrice(row.metrics.price as number | null)}</td><td className="px-1 py-1 text-right tabular-nums text-[var(--term-ink-secondary)]">{row.metrics.iv_gap_pct == null ? "—" : formatPct(Number(row.metrics.iv_gap_pct))}</td><td className="px-1 py-1 text-right tabular-nums text-[var(--term-ink-secondary)]">{row.metrics.revenue_growth_pct == null ? "—" : formatPct(Number(row.metrics.revenue_growth_pct))}</td><td className="px-1 py-1 text-right tabular-nums text-[var(--term-ink-secondary)]">{row.metrics.operating_margin_pct == null ? "—" : formatPct(Number(row.metrics.operating_margin_pct))}</td><td className="px-1 py-1 text-right tabular-nums text-[var(--term-ink-secondary)]">{row.metrics.cash_conversion_pct == null ? "—" : formatPct(Number(row.metrics.cash_conversion_pct))}</td><td className="px-1 py-1 text-right tabular-nums text-[var(--term-accent)]">{row.ranks.financial_quality == null ? "—" : `${Number(row.ranks.financial_quality).toFixed(0)}th`}</td></tr>)}</tbody></table></div>}</div>}

      {researchTab === "events" && <div className="flex-1 overflow-y-auto border-b border-[var(--term-hairline)] px-3 py-2"><div className="mb-2 flex items-center justify-between"><span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]">Event impact overlay</span><span className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">forward returns</span></div>{eventImpacts.isLoading ? <div className="font-mono text-[11px] text-[var(--term-ink-tertiary)]">Loading event impacts…</div> : (eventImpacts.data?.events ?? []).length === 0 ? <div className="font-mono text-[11px] text-[var(--term-ink-tertiary)]">No company events for this timeline.</div> : <div className="space-y-1.5">{eventImpacts.data!.events.slice(0, 20).map((event) => <div key={event.event_instance_id} className="border border-[var(--term-divider)] p-2"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[11px] text-[var(--term-ink)]">{event.name}</span><span className="font-mono text-[10px] uppercase text-[var(--term-ink-tertiary)]">{event.sim_date}</span></div><div className="mt-1 flex gap-3 font-mono text-[10px] text-[var(--term-ink-secondary)]"><span>1D {event.return_1d_pct == null ? "—" : formatPct(event.return_1d_pct)}</span><span>5D {event.return_5d_pct == null ? "—" : formatPct(event.return_5d_pct)}</span><span>20D {event.return_20d_pct == null ? "—" : formatPct(event.return_20d_pct)}</span></div></div>)}</div>}</div>}

      {researchTab === "evidence" && <div className="flex-1 overflow-y-auto border-b border-[var(--term-hairline)] px-4 py-2"><div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--term-amber)]"><ShieldCheck size={12} /> Evidence & lineage</div><div className="space-y-2"><div className="border border-[var(--term-divider)] p-2"><div className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">Price / market grid</div><div className="mt-1 font-mono text-[11px] text-[var(--term-ink-secondary)]">/api/v1/market · timeline-aware PriceHistory resolution · as-of date is shown in the Screener status line.</div></div><div className="border border-[var(--term-divider)] p-2"><div className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">Intrinsic value</div><div className="mt-1 font-mono text-[11px] text-[var(--term-ink-secondary)]">CompanyFactorScore.intrinsic_value · factor model output · inspect assumptions in the Valuation response.</div></div><div className="border border-[var(--term-divider)] p-2"><div className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">Derived IV gap</div><div className="mt-1 font-mono text-[11px] text-[var(--term-ink-secondary)]">(price − intrinsic_value) / intrinsic_value × 100 · screener-v1 · null when either input is unavailable.</div></div><div className="border border-[var(--term-divider)] p-2"><div className="flex items-center gap-1 font-mono text-[10px] text-[var(--term-ink-tertiary)]"><FileText size={11} /> Simulation notice</div><div className="mt-1 font-mono text-[11px] text-[var(--term-ink-secondary)]">This workspace uses simulated market data. Model-derived sentiment and generated events must not be interpreted as external research.</div></div></div></div>}

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
