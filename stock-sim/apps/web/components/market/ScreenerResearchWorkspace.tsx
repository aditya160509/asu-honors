"use client";

import * as React from "react";
import { BookOpen, Database, ExternalLink, Gauge, ShieldCheck } from "lucide-react";
import { cn, formatLarge, formatPct, formatPrice } from "@/lib/utils";
import type { ScreenerHeatmapCell, ScreenerQuery, ScreenerQueryResponse, ScreenerRanking, ScreenerViewMode } from "@/lib/api/types";
import type { EnrichedCompany } from "@/lib/market/types";
import { HeatmapView } from "@/components/market/HeatmapView";
import { useResearchNotebooks, useScreenerBreadth, useScreenerCorrelation, useScreenerExposure, useScreenerFormula, useScreenerRankings } from "@/lib/api/hooks/useScreener";

export interface ScreenerResearchWorkspaceProps {
  mode: ScreenerViewMode;
  query: ScreenerQuery;
  result?: ScreenerQueryResponse;
  rankings?: ScreenerRanking[];
  heatmap?: ScreenerHeatmapCell[];
  rankMetric: string;
  onRankMetricChange: (metric: string) => void;
  companies: EnrichedCompany[];
  selectedTickers?: string[];
  onActivateRow: (ticker: string) => void;
  onOpenNotebook?: () => void;
}

function PanelHeading({ icon, eyebrow, title, detail }: { icon: React.ReactNode; eyebrow: string; title: string; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--term-hairline)] px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 text-[var(--term-amber)]">{icon}</span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--term-ink-tertiary)]">{eyebrow}</div>
          <div className="mt-0.5 truncate font-mono text-[13px] font-semibold text-[var(--term-ink)]">{title}</div>
        </div>
      </div>
      <div className="shrink-0 text-right font-mono text-[10px] leading-relaxed text-[var(--term-ink-tertiary)]">{detail}</div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-[var(--term-divider)] bg-white/[0.02] px-2.5 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-ink-tertiary)]">{label}</div>
      <div className="mt-1 font-mono text-[13px] tabular-nums text-[var(--term-ink)]">{value}</div>
    </div>
  );
}

function QueryLedger({ query, result }: { query: ScreenerQuery; result?: ScreenerQueryResponse }) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-[var(--term-hairline)] px-4 py-3 md:grid-cols-4">
      <MetricPill label="Matches" value={result ? result.total.toLocaleString() : "…"} />
      <MetricPill label="Clauses" value={query.clauses.length} />
      <MetricPill label="Timeline" value={`T${query.timeline_id} · ${result?.as_of_date ?? query.as_of_date ?? "live"}`} />
      <MetricPill label="Fingerprint" value={result?.query_fingerprint?.slice(0, 10) ?? "pending"} />
    </div>
  );
}

function RankPanel({ query, result, rankMetric, onRankMetricChange, onActivateRow }: Pick<ScreenerResearchWorkspaceProps, "query" | "result" | "rankMetric" | "onRankMetricChange" | "onActivateRow">) {
  const [metricOptions] = React.useState([
    ["financial_quality", "Financial quality"],
    ["growth_potential", "Growth potential"],
    ["iv_gap_pct", "IV gap %"],
    ["return_1m_pct", "1M return"],
    ["rsi_14", "RSI (14)"],
    ["market_cap", "Market cap"],
  ] as const);
  const rankings = useScreenerRankings(query, rankMetric, { enabled: true });
  const rows = rankings.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PanelHeading icon={<Gauge size={14} />} eyebrow="Rank mode" title="Sort the active screen by any research metric" detail={`${rows.length} visible · server-backed`} />
      <div className="flex items-center gap-2 border-b border-[var(--term-hairline)] px-4 py-2">
        <label htmlFor="rank-metric" className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-ink-tertiary)]">Rank by</label>
        <select id="rank-metric" value={rankMetric} onChange={(event) => onRankMetricChange(event.target.value)} className="border border-[var(--term-divider)] bg-[var(--term-bg)] px-2 py-1 font-mono text-[11px] text-[var(--term-ink)] outline-none focus:border-[var(--term-amber)]">
          {metricOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span className="ml-auto font-mono text-[10px] text-[var(--term-ink-tertiary)]">Nulls are omitted · values retain source lineage</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead className="sticky top-0 z-10 bg-[var(--term-bg)] text-[10px] uppercase tracking-[0.08em] text-[var(--term-ink-tertiary)]">
            <tr className="border-b border-[var(--term-divider)]"><th className="px-4 py-2 text-left">#</th><th className="px-2 py-2 text-left">Company</th><th className="px-2 py-2 text-left">Industry</th><th className="px-4 py-2 text-right">Value</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker} className="cursor-pointer border-b border-[var(--term-hairline)] transition-colors hover:bg-white/[0.04]" onClick={() => onActivateRow(row.ticker)}>
                <td className="w-12 px-4 py-2 tabular-nums text-[var(--term-ink-tertiary)]">{row.rank}</td>
                <td className="px-2 py-2"><span className="font-semibold text-[var(--term-ink)]">{row.ticker}</span><span className="ml-2 text-[var(--term-ink-secondary)]">{row.name}</span></td>
                <td className="px-2 py-2 text-[var(--term-ink-secondary)]">{row.industry_name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--term-amber)]">{formatMetric(rankMetric, row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-4 py-8 font-mono text-[11px] text-[var(--term-ink-tertiary)]">No ranked observations in the current screen.</div>}
      </div>
    </div>
  );
}

function MapPanel({ heatmap: cells, companies, onActivateRow }: Pick<ScreenerResearchWorkspaceProps, "heatmap" | "companies" | "onActivateRow">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PanelHeading icon={<Database size={14} />} eyebrow="Map mode" title="Sector map with server aggregation" detail="Size: market cap · color: day change" />
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-[var(--term-hairline)] px-4 py-3 md:grid-cols-4">
        {(cells ?? []).slice(0, 4).map((cell) => (
          <MetricPill key={cell.key} label={cell.label} value={<><span>{cell.count} names</span><span className={cn("ml-2", (cell.color_value ?? 0) >= 0 ? "text-[var(--term-up)]" : "text-[var(--term-down)]")}>{cell.color_value == null ? "—" : formatPct(cell.color_value)}</span></>} />
        ))}
      </div>
      <div className="min-h-0 flex-1"><HeatmapView companies={companies} onActivateRow={onActivateRow} /></div>
    </div>
  );
}

function ResearchPanel({ query, result, onActivateRow }: Pick<ScreenerResearchWorkspaceProps, "query" | "result" | "onActivateRow">) {
  const first = result?.rows?.[0];
  const metrics = first ? Object.entries(first.metrics).filter(([, value]) => value != null).slice(0, 8) : [];
  const [formula, setFormula] = React.useState("price / intrinsic_value * 100");
  const formulaQuery = React.useMemo(() => ({ ...query, columns: Array.from(new Set([...query.columns, "price", "intrinsic_value"])) }), [query]);
  const formulaResult = useScreenerFormula(formulaQuery, formula, Boolean(formula.trim()));
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PanelHeading icon={<ShieldCheck size={14} />} eyebrow="Research mode" title="Evidence-first screen review" detail={first ? `${first.company.ticker} preview · select a row for full dock` : "select a result row to open research dock"} />
      <QueryLedger query={result?.query ?? { version: 1, timeline_id: 1, universe: { type: "all" }, logic: "all", clauses: [], sort: [], columns: [], page_size: 100, offset: 0 }} result={result} />
      <div className="grid gap-3 p-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-sm border border-[var(--term-divider)]">
          <div className="flex items-center justify-between border-b border-[var(--term-hairline)] px-3 py-2"><span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-amber)]">Screen observations</span><span className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">click any row</span></div>
          <div className="divide-y divide-[var(--term-hairline)]">
            {(result?.rows ?? []).slice(0, 12).map((row) => <button key={row.company.ticker} type="button" onClick={() => onActivateRow(row.company.ticker)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"><span className="min-w-0 truncate font-mono text-[11px] text-[var(--term-ink)]"><span className="font-semibold">{row.company.ticker}</span><span className="ml-2 text-[var(--term-ink-secondary)]">{row.company.name}</span></span><ExternalLink size={12} className="shrink-0 text-[var(--term-ink-tertiary)]" /></button>)}
          </div>
        </div>
        <div className="rounded-sm border border-[var(--term-divider)]">
          <div className="border-b border-[var(--term-hairline)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-amber)]">Lineage preview</div>
          {first ? <div className="space-y-2 p-3">{metrics.map(([key, value]) => { const p = first.provenance[key]; return <div key={key} className="rounded-sm border border-[var(--term-hairline)] px-2.5 py-2"><div className="flex items-center justify-between gap-2 font-mono text-[11px]"><span className="text-[var(--term-ink)]">{key}</span><span className="tabular-nums text-[var(--term-amber)]">{formatMetric(key, value)}</span></div><div className="mt-1 font-mono text-[10px] text-[var(--term-ink-tertiary)]">{p?.source ?? "source pending"} · {p?.calculation_version ?? "—"}</div>{p?.formula && <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--term-ink-secondary)]" title={p.formula}>{p.formula}</div>}</div>; })}</div> : <div className="p-3 font-mono text-[11px] text-[var(--term-ink-tertiary)]">Run the screen to populate source and formula metadata.</div>}
        </div>
      </div>
      <div className="mx-4 mb-4 rounded-sm border border-[var(--term-divider)] p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-amber)]">Derived metric formula</span><span className="font-mono text-[10px] text-[var(--term-ink-tertiary)]">safe AST · query-scoped</span></div><div className="flex gap-2"><input value={formula} onChange={(event) => setFormula(event.target.value)} aria-label="Derived metric formula" className="min-w-0 flex-1 border border-[var(--term-divider)] bg-white/[0.02] px-2 py-1.5 font-mono text-[11px] text-[var(--term-ink)] outline-none focus:border-[var(--term-amber)]" /><span className="self-center font-mono text-[10px] text-[var(--term-ink-tertiary)]">{formulaResult.isLoading ? "calculating" : `${formulaResult.data?.values.length ?? 0} values`}</span></div>{formulaResult.data?.values && <div className="mt-2 flex flex-wrap gap-1.5">{formulaResult.data.values.slice(0, 12).map((item) => <span key={item.ticker} className="border border-[var(--term-divider)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--term-ink-secondary)]">{item.ticker} {item.value == null ? "—" : item.value.toFixed(2)}</span>)}</div>}{formulaResult.isError && <div className="mt-2 font-mono text-[10px] text-[var(--term-down)]">Formula rejected or a metric is missing.</div>}</div>
    </div>
  );
}

function NotebookPanel({ query }: { query: ScreenerQuery }) {
  const storageKey = "market-explorer:notebook:screen-note";
  const [note, setNote] = React.useState("");
  const notebooks = useResearchNotebooks();
  React.useEffect(() => {
    try { setNote(localStorage.getItem(storageKey) ?? ""); } catch { /* storage is optional */ }
  }, []);
  React.useEffect(() => {
    try { localStorage.setItem(storageKey, note); } catch { /* storage is optional */ }
  }, [note]);
  const activeNotebook = notebooks.data?.[0];
  const syncedNote = activeNotebook?.blocks.find((block) => block.block_type === "text")?.payload.text;
  React.useEffect(() => {
    if (!note && typeof syncedNote === "string") setNote(syncedNote);
  }, [syncedNote, note]);
  function createNotebook() {
    notebooks.create.mutate({ title: "Market Explorer notes", query });
  }
  function syncNote() {
    if (!activeNotebook || !note.trim()) return;
    notebooks.createBlock.mutate({ notebookId: activeNotebook.id, body: { block_type: "text", position: activeNotebook.blocks.length, payload: { text: note }, provenance: { query, source: "Market Explorer notebook" } } });
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PanelHeading icon={<BookOpen size={14} />} eyebrow="Notebook mode" title="Capture the thesis beside the screen" detail="local draft · query snapshot visible" />
      <div className="grid gap-3 p-4 lg:grid-cols-[.85fr_1.15fr]">
        <div className="rounded-sm border border-[var(--term-divider)] p-3"><div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-amber)]">Query snapshot</div><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-[var(--term-ink-secondary)]">{JSON.stringify(query, null, 2)}</pre></div>
        <div className="rounded-sm border border-[var(--term-divider)] p-3"><div className="mb-2 flex items-center justify-between gap-2"><label htmlFor="screener-notebook-note" className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--term-amber)]">Research note</label>{notebooks.authenticated && <div className="flex gap-1">{!activeNotebook && <button type="button" onClick={createNotebook} disabled={notebooks.create.isPending} className="border border-[var(--term-divider)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--term-ink-secondary)] hover:border-[var(--term-amber)] hover:text-[var(--term-amber)]">{notebooks.create.isPending ? "Creating" : "Create notebook"}</button>}{activeNotebook && <button type="button" onClick={syncNote} disabled={notebooks.createBlock.isPending || !note.trim()} className="border border-[var(--term-divider)] px-2 py-1 font-mono text-[10px] uppercase text-[var(--term-ink-secondary)] hover:border-[var(--term-amber)] hover:text-[var(--term-amber)]">{notebooks.createBlock.isPending ? "Syncing" : "Sync note"}</button>}</div>}</div><textarea id="screener-notebook-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed? What would falsify this screen? Cite the evidence you inspected…" className="min-h-64 w-full resize-y border border-[var(--term-divider)] bg-white/[0.02] p-3 font-mono text-[12px] leading-relaxed text-[var(--term-ink)] outline-none placeholder:text-[var(--term-ink-tertiary)] focus:border-[var(--term-amber)]" /><div className="mt-2 font-mono text-[10px] text-[var(--term-ink-tertiary)]">Autosaved locally{notebooks.authenticated ? " · sync creates a versioned notebook block" : " · sign in to sync a versioned notebook block"}.</div></div>
      </div>
    </div>
  );
}

function AnalyticsPanel({ mode, companies, selectedTickers, query }: Pick<ScreenerResearchWorkspaceProps, "mode" | "companies" | "selectedTickers" | "query">) {
  const tickers = React.useMemo(() => (selectedTickers && selectedTickers.length > 1 ? selectedTickers.slice(0, 12) : companies.slice(0, 8).map((company) => company.ticker)), [companies, selectedTickers]);
  const correlation = useScreenerCorrelation(tickers, { asOfDate: query.as_of_date, enabled: mode === "correlation" });
  const breadth = useScreenerBreadth({ asOfDate: query.as_of_date, enabled: mode === "breadth" });
  if (mode === "correlation") {
    const data = correlation.data;
    return <div className="min-h-0 flex-1 overflow-auto"><PanelHeading icon={<Database size={14} />} eyebrow="Correlation mode" title="Aligned return correlations" detail={`${tickers.length} symbols · Pearson daily returns`} /><div className="border-b border-[var(--term-hairline)] px-4 py-2 font-mono text-[10px] text-[var(--term-ink-tertiary)]">{selectedTickers && selectedTickers.length > 1 ? "Using selected comparison names" : "Select two or more rows to focus the matrix"} · {data?.dates.length ?? 0} aligned sessions</div>{data?.matrix ? <div className="overflow-auto p-4"><table className="border-collapse font-mono text-[10px]"><thead><tr><th className="border border-[var(--term-divider)] px-2 py-2 text-left text-[var(--term-ink-tertiary)]">ρ</th>{data.tickers.map((ticker) => <th key={ticker} className="border border-[var(--term-divider)] px-3 py-2 text-right text-[var(--term-ink)]">{ticker}</th>)}</tr></thead><tbody>{data.matrix.map((row, index) => <tr key={data.tickers[index]}><th className="border border-[var(--term-divider)] px-3 py-2 text-left text-[var(--term-ink)]">{data.tickers[index]}</th>{row.map((value, cellIndex) => <td key={`${index}-${cellIndex}`} className={cn("border border-[var(--term-divider)] px-3 py-2 text-right tabular-nums", value == null ? "text-[var(--term-ink-tertiary)]" : value >= 0 ? "text-[var(--term-up)]" : "text-[var(--term-down)]")} style={{ backgroundColor: value == null ? undefined : `rgba(${value >= 0 ? "63,191,133" : "232,93,104"},${Math.min(0.42, Math.abs(value) * 0.42)})` }}>{value == null ? "—" : value.toFixed(2)}</td>)}</tr>)}</tbody></table><div className="mt-3 font-mono text-[10px] text-[var(--term-ink-tertiary)]">Source: {data.provenance.source} · {data.provenance.calculation_version} · values are unavailable when aligned history is insufficient.</div></div> : <div className="p-4 font-mono text-[11px] text-[var(--term-ink-tertiary)]">{correlation.isLoading ? "Aligning histories…" : "Not enough shared history to calculate the matrix."}</div>}</div>;
  }
  const points = breadth.data?.points ?? [];
  const recent = points.slice(-30);
  return <div className="min-h-0 flex-1 overflow-auto"><PanelHeading icon={<Gauge size={14} />} eyebrow="Breadth mode" title="Participation beneath the screen" detail={`${recent.length} sessions · point-in-time`} /><div className="grid grid-cols-2 gap-2 border-b border-[var(--term-hairline)] px-4 py-3 md:grid-cols-4"><MetricPill label="Adv / dec" value={recent.length ? `${recent[recent.length - 1].advances} / ${recent[recent.length - 1].declines}` : "—"} /><MetricPill label="Above SMA20" value={recent.length ? `${recent[recent.length - 1].above_sma20}/${recent[recent.length - 1].total}` : "—"} /><MetricPill label="New highs" value={recent.length ? recent[recent.length - 1].new_highs : "—"} /><MetricPill label="New lows" value={recent.length ? recent[recent.length - 1].new_lows : "—"} /></div><div className="space-y-1 p-4">{recent.slice().reverse().map((point) => { const total = Math.max(point.total, 1); const advanceWidth = point.advances / total * 100; const declineWidth = point.declines / total * 100; return <div key={point.sim_date} className="grid grid-cols-[82px_1fr_80px] items-center gap-2 font-mono text-[10px]"><span className="text-[var(--term-ink-tertiary)]">{point.sim_date}</span><div className="flex h-3 overflow-hidden bg-white/[0.04]"><span className="bg-[var(--term-up)]/70" style={{ width: `${advanceWidth}%` }} /><span className="bg-[var(--term-down)]/70" style={{ width: `${declineWidth}%` }} /></div><span className="text-right tabular-nums text-[var(--term-ink-secondary)]">{point.advances}↑ {point.declines}↓</span></div>; })}{recent.length === 0 && <div className="font-mono text-[11px] text-[var(--term-ink-tertiary)]">{breadth.isLoading ? "Loading breadth…" : "No breadth history for this timeline."}</div>}<div className="pt-2 font-mono text-[10px] text-[var(--term-ink-tertiary)]">Source: PriceHistory · advances/declines, new highs/lows, and 20-session participation are calculated without future dates.</div></div></div>;
}

function ExposurePanel({ query }: { query: ScreenerQuery }) {
  const exposure = useScreenerExposure(query, undefined, true);
  const factors = ["management_quality", "moat_score", "financial_quality", "fcf_quality", "growth_potential", "intrinsic_score"];
  return <div className="min-h-0 flex-1 overflow-auto"><PanelHeading icon={<ShieldCheck size={14} />} eyebrow="Exposure mode" title="Factor exposure map" detail="quarterly snapshot · point-in-time" /><div className="overflow-auto p-4"><table className="w-full min-w-[720px] border-collapse font-mono text-[10px]"><thead><tr className="border-b border-[var(--term-divider)] text-[var(--term-ink-tertiary)]"><th className="px-2 py-2 text-left">Ticker</th><th className="px-2 py-2 text-left">Company</th>{factors.map((factor) => <th key={factor} className="px-2 py-2 text-right">{factor.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{(exposure.data ?? []).map((row) => <tr key={row.ticker} className="border-b border-[var(--term-hairline)]"><td className="px-2 py-2 font-semibold text-[var(--term-ink)]">{row.ticker}</td><td className="px-2 py-2 text-[var(--term-ink-secondary)]">{row.name}</td>{factors.map((factor) => { const value = row.exposures[factor]; return <td key={factor} className="px-2 py-2 text-right"><div className="flex items-center justify-end gap-2"><span className="w-10 tabular-nums text-[var(--term-amber)]">{value == null ? "—" : value.toFixed(1)}</span><span className="h-1.5 w-16 overflow-hidden bg-white/[0.05]"><span className="block h-full bg-[var(--term-accent)]/70" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} /></span></div></td>; })}</tr>)} </tbody></table>{exposure.isLoading && <div className="py-6 font-mono text-[11px] text-[var(--term-ink-tertiary)]">Loading factor snapshots…</div>}{!exposure.isLoading && (exposure.data ?? []).length === 0 && <div className="py-6 font-mono text-[11px] text-[var(--term-ink-tertiary)]">No factor observations in the active screen.</div>}<div className="mt-3 font-mono text-[10px] text-[var(--term-ink-tertiary)]">Each bar is a 0–100 factor score. Open a row in the company dock for source and calculation lineage.</div></div></div>;
}

function formatMetric(metric: string, value: unknown): string {
  if (value == null) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (metric.includes("price") || metric.includes("value")) return formatPrice(numeric);
  if (metric.includes("cap") || metric.includes("volume")) return formatLarge(numeric);
  if (metric.includes("pct") || metric.includes("return") || metric.includes("strength") || metric.includes("volatility")) return formatPct(numeric);
  return numeric.toFixed(1);
}

export function ScreenerResearchWorkspace({ mode, query, result, rankings, heatmap, rankMetric, onRankMetricChange, companies, selectedTickers, onActivateRow }: ScreenerResearchWorkspaceProps) {
  if (mode === "rank") return <RankPanel query={query} result={result} rankMetric={rankMetric} onRankMetricChange={onRankMetricChange} onActivateRow={onActivateRow} />;
  if (mode === "heatmap") return <MapPanel heatmap={heatmap} companies={companies} onActivateRow={onActivateRow} />;
  if (mode === "notebook") return <NotebookPanel query={query} />;
  if (mode === "correlation" || mode === "breadth") return <AnalyticsPanel mode={mode} companies={companies} selectedTickers={selectedTickers} query={query} />;
  if (mode === "exposure") return <ExposurePanel query={query} />;
  return <ResearchPanel query={query} result={result} onActivateRow={onActivateRow} />;
}
