"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Activity, ArrowRight, Beaker, CheckCircle2, Clock3, GitBranch, HelpCircle, Layers3, Play, Sparkles, X, XCircle, BarChart3, Download, RefreshCw } from "lucide-react";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { TimelineBranch } from "@/components/simulation/TimelineBranch";
import { useScenarioLibrary, useTimelineDiff, useTimelineGroupDistribution, useTimelineStatus, useTimelines } from "@/lib/api/hooks/useSimulation";
import { useAuditLog } from "@/lib/api/hooks/useSimulation";
import { formatDateFull } from "@/lib/utils";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { useDriverHistory, usePriceHistory } from "@/lib/api/hooks/useCompany";
import { usePortfolioAnalytics } from "@/lib/api/hooks/usePortfolio";
import { download } from "@/lib/api/client";

const FactorAnalytics = dynamic(
  () => import("@/components/simulation/FactorAnalytics").then((module) => module.FactorAnalytics),
  {
    loading: () => (
      <div className="grid h-64 place-items-center border-t border-[var(--mer-stroke-hairline)] text-xs text-[var(--mer-ink-muted)]">
        Loading factor laboratory…
      </div>
    ),
  },
);

const statusMeta = {
  ready: { label: "Ready", icon: CheckCircle2, tone: "#5ee6a8" },
  pending: { label: "Queued", icon: Clock3, tone: "#f4c95d" },
  running: { label: "Running", icon: Activity, tone: "#72a5ff" },
  failed: { label: "Failed", icon: XCircle, tone: "#ff8585" },
} as const;

export default function FutureLabPage() {
  const { data: timelines = [], isLoading } = useTimelines();
  const { data: scenarios = [] } = useScenarioLibrary();
  const live = timelines.find((timeline) => timeline.is_live);
  const { data: audit = [] } = useAuditLog(live?.id);
  const branches = timelines.filter((timeline) => !timeline.is_live);
  const [selectedId, setSelectedId] = React.useState<number | undefined>();
  React.useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("timeline");
    if (value) setSelectedId(Number(value));
  }, []);
  const selected = branches.find((timeline) => timeline.id === selectedId);
  const [compareId, setCompareId] = React.useState<number | undefined>();
  const ready = branches.filter((timeline) => timeline.status === "ready").length;
  const inFlight = branches.filter((timeline) => timeline.status === "pending" || timeline.status === "running").length;
  const [showGuide, setShowGuide] = React.useState(false);
  React.useEffect(() => {
    setShowGuide(window.localStorage.getItem("future-lab:onboarding-dismissed") !== "1");
  }, []);
  function dismissGuide() {
    window.localStorage.setItem("future-lab:onboarding-dismissed", "1");
    setShowGuide(false);
  }

  return (
    <TerminalShell noPadding>
      <main className="min-h-full overflow-auto bg-[var(--mer-bg-canvas)] [background-image:linear-gradient(rgba(115,137,170,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(115,137,170,.025)_1px,transparent_1px)] [background-size:36px_36px]">
        <header className="sticky top-0 z-20 border-b border-[var(--mer-stroke-hairline)] bg-[rgba(10,14,20,.92)] px-6 py-5 backdrop-blur-xl lg:px-10">
          <div className="mx-auto flex max-w-[1500px] items-start justify-between gap-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--mer-accent-300)]"><Beaker size={14} /> Research workspace</div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--mer-ink-primary)]">Future Lab <span className="ml-2 align-middle font-mono text-[10px] font-normal uppercase tracking-[.16em] text-[var(--mer-ink-muted)]">/ research terminal</span></h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--mer-ink-secondary)]">Branch the market, apply a documented scenario, fast-forward the engine, and compare the persisted outcome against the parent timeline.</p>
            </div>
            <div className="shrink-0"><TimelineBranch /></div>
          </div>
        </header>

        {showGuide && <OnboardingGuide onDismiss={dismissGuide} />}

        <div className="mx-auto grid max-w-[1500px] gap-5 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-10">
          <section className="min-w-0 space-y-5">
            <div className="grid gap-px overflow-hidden border border-[var(--mer-stroke-hairline)] bg-[var(--mer-stroke-hairline)] sm:grid-cols-4">
              <LabMetric label="Active parent" value={live?.name ?? "—"} detail={live ? `Timeline ${live.id}` : "Loading"} />
              <LabMetric label="Experiments" value={String(branches.length)} detail={`${ready} ready`} />
              <LabMetric label="In flight" value={String(inFlight)} detail="Background runs" />
              <LabMetric label="Scenario library" value={String(scenarios.length)} detail="Reusable primitives" />
            </div>

            <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)]">
              <div className="flex items-center justify-between border-b border-[var(--mer-stroke-hairline)] px-4 py-3"><div><h2 className="text-sm font-semibold text-[var(--mer-ink-primary)]">Experiment pipeline</h2><p className="mt-1 text-xs text-[var(--mer-ink-muted)]">Each branch is isolated, auditable, and calculated by the same simulation engine.</p></div><GitBranch size={16} className="text-[var(--mer-accent-300)]" /></div>
              <div className="grid gap-3 p-4 md:grid-cols-4">{[["01", "Choose branch point", "Pin the parent date"], ["02", "Apply primitive", "Use a scenario or override"], ["03", "Run forward", "Calculate days in background"], ["04", "Compare", "Inspect market outcomes"]].map(([number, title, detail]) => <div key={number} className="border-l-2 border-[var(--mer-stroke-hairline)] pl-3"><div className="font-mono text-[10px] text-[var(--mer-accent-300)]">{number}</div><div className="mt-1 text-xs font-semibold text-[var(--mer-ink-primary)]">{title}</div><div className="mt-1 text-[11px] text-[var(--mer-ink-muted)]">{detail}</div></div>)}</div>
            </section>

            <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)]">
              <div className="flex items-center justify-between border-b border-[var(--mer-stroke-hairline)] px-4 py-3"><div><h2 className="text-sm font-semibold text-[var(--mer-ink-primary)]">Timeline experiments</h2><p className="mt-1 text-xs text-[var(--mer-ink-muted)]">Open the branch wizard above to create a new research run.</p></div><Layers3 size={16} className="text-[var(--mer-ink-muted)]" /></div>
              <div className="divide-y divide-[var(--mer-stroke-hairline)]">{isLoading ? <TimelineSkeleton /> : branches.length === 0 ? <div className="p-8 text-center"><Sparkles size={20} className="mx-auto text-[var(--mer-accent-300)]" /><p className="mt-3 text-sm text-[var(--mer-ink-primary)]">No experiments yet</p><p className="mt-1 text-xs text-[var(--mer-ink-muted)]">Use <span className="font-medium text-[var(--mer-accent-300)]">Branch (Future Lab)</span> above to start testing a market hypothesis.</p><div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 border border-dashed border-[var(--mer-stroke-emphasis)] bg-[rgba(62,111,224,.06)] px-4 py-3 text-left"><GitBranch size={15} className="shrink-0 text-[var(--mer-accent-300)]" /><span className="text-[11px] text-[var(--mer-ink-secondary)]">Start from the live market, choose a date, then apply a scenario or custom factor override.</span></div></div> : branches.map((timeline) => <TimelineRow key={timeline.id} timeline={timeline} onSelect={() => { window.location.href = `/future-lab/${timeline.id}`; }} selected={timeline.id === selectedId} />)}</div>
            </section>
            {selected && <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] px-4 py-3"><div><div className="text-xs font-semibold text-[var(--mer-ink-primary)]">Compare timelines</div><div className="mt-1 text-[11px] text-[var(--mer-ink-muted)]">Compare persisted override state and outputs against another branch.</div></div><select value={compareId ?? ""} onChange={(e) => setCompareId(e.target.value ? Number(e.target.value) : undefined)} className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-bg-canvas)] px-2 py-1.5 text-xs text-[var(--mer-ink-primary)]"><option value="">Parent timeline</option>{branches.filter((t) => t.id !== selected.id).map((t) => <option key={t.id} value={t.id}>{t.name} · #{t.id}</option>)}</select></div><ExperimentResults timeline={selected} parentId={compareId ?? selected.parent_timeline_id ?? live?.id} /></div>}
          </section>

          <aside className="space-y-5">
            <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)]"><div className="border-b border-[var(--mer-stroke-hairline)] px-4 py-3"><h2 className="text-sm font-semibold text-[var(--mer-ink-primary)]">Scenario library</h2><p className="mt-1 text-xs text-[var(--mer-ink-muted)]">Validated templates available in the branch wizard.</p></div><div className="divide-y divide-[var(--mer-stroke-hairline)]">{scenarios.slice(0, 6).map((scenario) => <div key={scenario.id} className="px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--mer-ink-primary)]"><Play size={11} className="text-[var(--mer-accent-300)]" />{scenario.name}</div><p className="mt-1 text-[11px] leading-4 text-[var(--mer-ink-muted)]">{scenario.description || "Reusable simulation configuration"}</p></div>)}{scenarios.length === 0 && <div className="p-4 text-xs text-[var(--mer-ink-muted)]">No saved scenarios yet.</div>}</div></section>
            <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)]"><div className="border-b border-[var(--mer-stroke-hairline)] px-4 py-3"><h2 className="text-sm font-semibold text-[var(--mer-ink-primary)]">Audit trail</h2><p className="mt-1 text-xs text-[var(--mer-ink-muted)]">Recent actions on the live parent.</p></div><div className="divide-y divide-[var(--mer-stroke-hairline)]">{audit.slice(0, 8).map((entry) => <div key={entry.id} className="px-4 py-3"><div className="text-[11px] font-medium text-[var(--mer-ink-secondary)]">{entry.action.replaceAll("_", " ")}</div><div className="mt-1 text-[10px] text-[var(--mer-ink-muted)]">{entry.created_at ? formatDateFull(entry.created_at) : "Recorded"}</div></div>)}{audit.length === 0 && <div className="p-4 text-xs text-[var(--mer-ink-muted)]">No audit events yet.</div>}</div></section>
          </aside>
        </div>
      </main>
    </TerminalShell>
  );
}

function LabMetric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="bg-[var(--mer-surface-1)] px-4 py-4"><div className="text-[10px] uppercase tracking-[0.12em] text-[var(--mer-ink-muted)]">{label}</div><div className="mt-2 truncate font-mono text-lg text-[var(--mer-ink-primary)]">{value}</div><div className="mt-1 text-[11px] text-[var(--mer-ink-muted)]">{detail}</div></div>; }

function OnboardingGuide({ onDismiss }: { onDismiss: () => void }) { return <div className="border-b border-[var(--mer-stroke-accent)] bg-[rgba(31,56,105,.2)] px-6 py-4 lg:px-10"><div className="mx-auto flex max-w-[1500px] items-start gap-4"><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--mer-stroke-accent)] text-[var(--mer-accent-300)]"><HelpCircle size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-semibold text-[var(--mer-ink-primary)]">Your first experiment</h2><span className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--mer-accent-300)]">3 steps · read-only until you run</span></div><div className="mt-3 grid gap-3 sm:grid-cols-3">{[["01", "Choose a branch point", "Start from the live market date."], ["02", "Apply a scenario", "Use a template or factor override."], ["03", "Review the outcome", "Compare the branch after calculation."]].map(([n, t, d]) => <div key={n} className="flex gap-2"><span className="font-mono text-[10px] text-[var(--mer-accent-300)]">{n}</span><div><div className="text-[11px] font-medium text-[var(--mer-ink-primary)]">{t}</div><div className="mt-0.5 text-[10px] text-[var(--mer-ink-muted)]">{d}</div></div></div>)}</div><button type="button" onClick={onDismiss} className="mt-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[.1em] text-[var(--mer-accent-300)] hover:text-white">Got it <ArrowRight size={11} /></button></div><button type="button" onClick={onDismiss} aria-label="Dismiss onboarding guide" className="text-[var(--mer-ink-muted)] hover:text-white"><X size={15} /></button></div></div>; }

function TimelineSkeleton() { return <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="flex animate-pulse justify-between"><div className="space-y-2"><div className="h-3 w-44 rounded bg-white/[.08]" /><div className="h-2 w-28 rounded bg-white/[.05]" /></div><div className="h-3 w-16 rounded bg-white/[.06]" /></div>)}</div>; }

function TimelineRow({ timeline, onSelect, selected }: { timeline: { id: number; name: string; status: string; created_at: string; timeline_group_id?: number | null }; onSelect: () => void; selected: boolean }) { const meta = statusMeta[timeline.status as keyof typeof statusMeta] ?? statusMeta.pending; const Icon = meta.icon; return <button type="button" onClick={onSelect} className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-white/[.03] ${selected ? "bg-[rgba(62,111,224,.10)]" : ""}`}><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium text-[var(--mer-ink-primary)]">{timeline.name}</span><span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em]" style={{ color: meta.tone }}><Icon size={12} />{meta.label}</span>{timeline.timeline_group_id && <span className="font-mono text-[9px] uppercase text-[var(--mer-accent-300)]">ensemble</span>}</div><div className="mt-1 text-[11px] text-[var(--mer-ink-muted)]">Timeline {timeline.id} · created {formatDateFull(timeline.created_at)}</div></div><div className="shrink-0 text-right font-mono text-[11px] text-[var(--mer-ink-muted)]"><div>{selected ? "Viewing results" : timeline.status === "ready" ? "Open results" : "Awaiting engine"}</div><div>Timeline state</div></div></button>; }

function ExperimentResults({ timeline, parentId }: { timeline: { id: number; name: string; primitive: string | null; status: string; timeline_group_id?: number | null }; parentId?: number }) {
  const { data: status } = useTimelineStatus(timeline.id, { pollWhilePending: true });
  const { data: market } = useMarketGrid(timeline.id);
  const ticker = market?.companies?.[0]?.ticker ?? "ICS";
  const { data: prices = [] } = usePriceHistory(ticker, timeline.id);
  const { data: driverHistory = [] } = useDriverHistory(ticker, timeline.id);
  const { data: comparePrices = [] } = usePriceHistory(ticker, parentId);
  const { data: diff } = useTimelineDiff(timeline.id, parentId);
  const { data: distribution } = useTimelineGroupDistribution(timeline.timeline_group_id ?? undefined);
  const { data: audit = [] } = useAuditLog(timeline.id);
  const { data: portfolio } = usePortfolioAnalytics(timeline.id);
  const points = prices.slice(-120);
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes, 0), max = Math.max(...closes, 1), range = max - min || 1;
  const path = closes.map((v, i) => `${i ? "L" : "M"} ${(i / Math.max(closes.length - 1, 1) * 100).toFixed(2)} ${(100 - ((v - min) / range) * 88 - 6).toFixed(2)}`).join(" ");
  const returns = closes.slice(1).map((value, i) => closes[i] ? value / closes[i] - 1 : 0).filter(Number.isFinite);
  const meanReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const volatility = returns.length > 1 ? Math.sqrt(returns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / (returns.length - 1)) * Math.sqrt(252) : null;
  let peak = -Infinity; let maxDrawdown = 0;
  closes.forEach((value) => { peak = Math.max(peak, value); if (peak > 0) maxDrawdown = Math.min(maxDrawdown, value / peak - 1); });
  const breadthUp = (market?.companies ?? []).filter((c) => (c.day_change_pct ?? 0) > 0).length;
  const breadthDown = (market?.companies ?? []).filter((c) => (c.day_change_pct ?? 0) < 0).length;
  const sectors = Object.entries((market?.companies ?? []).reduce<Record<string, { change: number; count: number }>>((acc, company) => { const key = company.industry_name || "Unclassified"; const bucket = acc[key] ?? { change: 0, count: 0 }; bucket.change += company.day_change_pct ?? 0; bucket.count += 1; acc[key] = bucket; return acc; }, {})).map(([name, value]) => ({ name, change: value.count ? value.change / value.count : 0 })).sort((a, b) => b.change - a.change);
  const compareClose = comparePrices.at(-1)?.close;
  const selectedClose = prices.at(-1)?.close;
  const latestDrivers = Object.values(driverHistory.reduce<Record<string, (typeof driverHistory)[number]>>((acc, row) => { acc[row.driver_key] = row; return acc; }, {})).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const changedDrivers = latestDrivers.slice(0, 5).map((row) => `${row.driver_key.replaceAll("_", " ")}: signal ${row.value >= 0 ? "+" : ""}${row.value.toFixed(2)} · weighted contribution ${row.contribution >= 0 ? "+" : ""}${row.contribution.toFixed(3)}`);
  const totalAbsContribution = latestDrivers.reduce((sum, row) => sum + Math.abs(row.contribution), 0);
  const riskItems = latestDrivers.slice(0, 5).map((row) => `${row.driver_key.replaceAll("_", " ")}: ${totalAbsContribution ? (Math.abs(row.contribution) / totalAbsContribution * 100).toFixed(1) : "0.0"}% of absolute driver contribution`);
  const exportFile = async (format: "json" | "csv" | "pdf") => { const result = await download(`/sim/timelines/${timeline.id}/export`, { format }); const url = URL.createObjectURL(result.blob); const a = document.createElement("a"); a.href = url; a.download = result.filename ?? `future-lab-${timeline.id}.${format}`; a.click(); URL.revokeObjectURL(url); };
  return <section className="border border-[var(--mer-stroke-accent)] bg-[var(--mer-surface-1)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mer-stroke-hairline)] px-4 py-3"><div><div className="flex items-center gap-2"><BarChart3 size={15} className="text-[var(--mer-accent-300)]" /><h2 className="text-sm font-semibold text-[var(--mer-ink-primary)]">Experiment outputs</h2><span className="font-mono text-[10px] uppercase text-[var(--mer-ink-muted)]">#{timeline.id} · {timeline.primitive ?? "manual"}</span></div><p className="mt-1 text-xs text-[var(--mer-ink-muted)]">Persisted engine observations for {timeline.name}. No synthetic values are generated in this view.</p></div><div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 text-[10px] uppercase" style={{ color: statusMeta[timeline.status as keyof typeof statusMeta]?.tone ?? "#9aa" }}>{timeline.status === "running" && <RefreshCw size={11} className="animate-spin" />}{timeline.status}</span>{(["json", "csv", "pdf"] as const).map((format) => <button key={format} type="button" onClick={() => void exportFile(format)} className="inline-flex items-center gap-1 border border-[var(--mer-stroke-hairline)] px-2 py-1 text-[10px] uppercase text-[var(--mer-ink-secondary)] hover:text-white"><Download size={11} /> {format}</button>)}</div></div>
    <div className="grid gap-px bg-[var(--mer-stroke-hairline)] sm:grid-cols-4"><OutputMetric label="Simulated date" value={status?.current_sim_date ?? "—"} /><OutputMetric label="Ticks" value={status?.tick_count?.toLocaleString() ?? "—"} /><OutputMetric label="Companies" value={market?.companies?.length.toString() ?? "—"} /><OutputMetric label="Parent diff" value={diff ? `${diff.entries.length} overrides` : "Loading"} /></div>
    {timeline.status === "failed" ? <div className="border-t border-[var(--mer-stroke-hairline)] p-5 text-xs text-[#ff8585]">This run failed in the engine. Inspect the audit trail below for the recorded action and recovery path.</div> : <>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]"><div className="min-w-0"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-[var(--mer-ink-primary)]">Price and intrinsic value · {ticker}</span><span className="text-[10px] text-[var(--mer-ink-muted)]">{points.length} persisted candles</span></div><div className="h-56 border border-[var(--mer-stroke-hairline)] bg-[#0a0e13] p-3">{path ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Scenario price history"><path d={path} fill="none" stroke="#72a5ff" strokeWidth="1.4" vectorEffect="non-scaling-stroke" /></svg> : <div className="grid h-full place-items-center text-xs text-[var(--mer-ink-muted)]">Waiting for persisted candles…</div>}</div></div><div className="space-y-2"><MiniOutput label="Latest close" value={selectedClose?.toFixed(2) ?? "—"} /><MiniOutput label="Latest intrinsic" value={prices.at(-1)?.intrinsic_value?.toFixed(2) ?? "—"} /><MiniOutput label="Volume" value={prices.at(-1)?.volume?.toLocaleString() ?? "—"} /><MiniOutput label="Compared close" value={compareClose?.toFixed(2) ?? "—"} /><MiniOutput label="Close delta" value={selectedClose != null && compareClose != null ? `${selectedClose - compareClose >= 0 ? "+" : ""}${(selectedClose - compareClose).toFixed(2)}` : "—"} /><MiniOutput label="Audit events" value={String(audit.length)} /></div></div>
      <div className="grid gap-3 border-t border-[var(--mer-stroke-hairline)] p-4 sm:grid-cols-2 lg:grid-cols-4"><MiniOutput label="Annualized volatility" value={volatility == null ? "—" : `${(volatility * 100).toFixed(2)}%`} /><MiniOutput label="Max drawdown" value={closes.length ? `${(maxDrawdown * 100).toFixed(2)}%` : "—"} /><MiniOutput label="Advancers / decliners" value={`${breadthUp} / ${breadthDown}`} /><MiniOutput label="Liquidity volume" value={prices.at(-1)?.volume?.toLocaleString() ?? "—"} /></div>
      <div className="border-t border-[var(--mer-stroke-hairline)] p-4"><div className="flex items-baseline justify-between"><h3 className="text-xs font-semibold text-[var(--mer-ink-primary)]">Portfolio impact · timeline {timeline.id}</h3><span className="text-[10px] text-[var(--mer-ink-muted)]">Backend portfolio analytics</span></div>{portfolio ? <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniOutput label="Total value" value={portfolio.total_value.toLocaleString(undefined, { maximumFractionDigits: 2 })} /><MiniOutput label="Return" value={`${portfolio.total_return_pct >= 0 ? "+" : ""}${portfolio.total_return_pct.toFixed(2)}%`} /><MiniOutput label="Unrealized P&L" value={portfolio.unrealized_pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} /><MiniOutput label="VaR" value={portfolio.value_at_risk_pct == null ? "—" : `${portfolio.value_at_risk_pct.toFixed(2)}%`} /></div> : <div className="mt-3 text-[11px] text-[var(--mer-ink-muted)]">Portfolio analytics are unavailable for this timeline.</div>}</div>
      <div className="grid gap-4 border-t border-[var(--mer-stroke-hairline)] p-4 lg:grid-cols-2"><OutputList title="Market breadth · current snapshot" items={[`Advancing companies: ${breadthUp}`, `Declining companies: ${breadthDown}`, `Unchanged companies: ${(market?.companies?.length ?? 0) - breadthUp - breadthDown}`]} empty="Market snapshot unavailable." /><OutputList title="Sector leaders / laggards · average day change" items={sectors.slice(0, 6).map((sector) => `${sector.name}: ${sector.change >= 0 ? "+" : ""}${sector.change.toFixed(2)}%`)} empty="Sector data unavailable." /></div>
      <FactorAnalytics ticker={ticker} timelineId={timeline.id} />
      <div className="grid gap-4 border-t border-[var(--mer-stroke-hairline)] p-4 lg:grid-cols-2"><OutputList title="Why did this change? · persisted driver signals" items={changedDrivers} empty="Driver history is not available for this run." /><OutputList title="Risk decomposition · absolute weighted contribution" items={riskItems} empty="Risk decomposition requires factor history." /></div>
      <div className="grid gap-4 border-t border-[var(--mer-stroke-hairline)] p-4 lg:grid-cols-2"><OutputList title="Scenario vs parent" items={(diff?.entries ?? []).map((entry) => `${entry.target_type}: ${entry.target_key} · ${entry.left_value ?? "—"} → ${entry.right_value ?? "—"}`)} empty="No persisted override differences." /><OutputList title="Audit trail" items={audit.slice(0, 6).map((entry) => `${entry.action.replaceAll("_", " ")} · ${entry.created_at ? formatDateFull(entry.created_at) : "recorded"}`)} empty="No audit events recorded." /></div>
      {distribution && <div className="border-t border-[var(--mer-stroke-hairline)] p-4"><div className="flex items-baseline justify-between"><h3 className="text-xs font-semibold text-[var(--mer-ink-primary)]">Ensemble distribution · persisted portfolio values</h3><span className="text-[10px] text-[var(--mer-ink-muted)]">n={distribution.count} · mean {distribution.mean?.toFixed(2) ?? "—"} · median {distribution.median?.toFixed(2) ?? "—"}</span></div><div className="mt-3 flex h-24 items-end gap-1 border-b border-[var(--mer-stroke-hairline)]">{distribution.histogram_counts.map((count, i) => <div key={i} className="min-w-0 flex-1 bg-[var(--mer-accent-300)]/70" style={{ height: `${Math.max(3, count / Math.max(...distribution.histogram_counts, 1) * 100)}%` }} title={`${count} members`} />)}</div></div>}
    </>}</section>;
}
function OutputMetric({ label, value }: { label: string; value: string }) { return <div className="bg-[var(--mer-surface-1)] px-4 py-3"><div className="text-[10px] uppercase tracking-[.1em] text-[var(--mer-ink-muted)]">{label}</div><div className="mt-1 font-mono text-sm text-[var(--mer-ink-primary)]">{value}</div></div>; }
function MiniOutput({ label, value }: { label: string; value: string }) { return <div className="border-l-2 border-[var(--mer-stroke-hairline)] px-3 py-2"><div className="text-[10px] text-[var(--mer-ink-muted)]">{label}</div><div className="mt-1 font-mono text-sm text-[var(--mer-ink-primary)]">{value}</div></div>; }
function OutputList({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div><h3 className="text-xs font-semibold text-[var(--mer-ink-primary)]">{title}</h3><div className="mt-2 divide-y divide-[var(--mer-stroke-hairline)] border-y border-[var(--mer-stroke-hairline)]">{items.length ? items.map((item, i) => <div key={`${item}-${i}`} className="py-2 text-[11px] text-[var(--mer-ink-secondary)]">{item}</div>) : <div className="py-3 text-[11px] text-[var(--mer-ink-muted)]">{empty}</div>}</div></div>; }
