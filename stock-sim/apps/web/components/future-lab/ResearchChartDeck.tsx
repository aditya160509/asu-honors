"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { PriceHistoryItem, TimelineAnalyticsResponse } from "@/lib/api/types";
import { MarketPathChart } from "./MarketPathChart";
import { OhlcvTerminal } from "./OhlcvTerminal";
import { ScenarioHeatmaps } from "./ScenarioHeatmaps";

type ViewKey = "market" | "security" | "sectors";
const VIEWS: Array<{ key: ViewKey; code: string; label: string; detail: string }> = [
  { key: "market", code: "PX/FV", label: "Market path", detail: "Price, fair value & valuation gap" },
  { key: "security", code: "OHLCV", label: "Security chart", detail: "Candles, bars, Heikin Ashi, line & area" },
  { key: "sectors", code: "MAP", label: "Heatmaps", detail: "Sector and constituent outcomes" },
];

export function ResearchChartDeck({
  analytics,
  ticker,
  history,
}: {
  analytics: TimelineAnalyticsResponse;
  ticker: string;
  history: PriceHistoryItem[];
}) {
  const [view, setView] = React.useState<ViewKey>("market");
  const [expanded, setExpanded] = React.useState(false);
  const companies = React.useMemo(
    () => [...analytics.best_companies, ...analytics.worst_companies],
    [analytics.best_companies, analytics.worst_companies]
  );
  const active = VIEWS.find((item) => item.key === view)!;

  return (
    <section className={`${expanded ? "fixed inset-3 z-[80] flex flex-col bg-[#05080d] shadow-[0_32px_120px_rgba(0,0,0,.9)]" : ""} border border-[#263246] bg-[#060a0f]`}>
      <header className="flex flex-wrap items-stretch border-b border-[#263246] bg-[#090f17]">
        <div className="min-w-[205px] border-r border-[#263246] px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#f3b33d]">Chart workstation</div>
          <div className="mt-1 text-[12px] font-semibold text-[#dce5f2]">Choose one output to inspect</div>
        </div>
        <nav className="flex flex-1 overflow-x-auto" aria-label="Research chart selector">
          {VIEWS.map((item) => (
            <button key={item.key} type="button" onClick={() => setView(item.key)} aria-pressed={view === item.key} className={`min-w-[185px] border-r border-[#202a38] px-3 py-2 text-left transition ${view === item.key ? "bg-[#13233b] shadow-[inset_0_-2px_0_#5798ff]" : "bg-[#080d13] hover:bg-[#0d141e]"}`}>
              <span className={`font-mono text-[9px] font-bold tracking-[.1em] ${view === item.key ? "text-[#6aa7ff]" : "text-[#66758a]"}`}>{item.code}</span>
              <span className="ml-2 text-[11px] font-semibold text-[#d2dce9]">{item.label}</span>
              <span className="mt-1 block font-mono text-[8px] uppercase tracking-[.06em] text-[#5f6d80]">{item.detail}</span>
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex min-w-24 items-center justify-center gap-2 border-l border-[#263246] px-3 font-mono text-[9px] uppercase tracking-[.08em] text-[#8290a4] hover:bg-[#101925] hover:text-white" title={expanded ? "Exit expanded chart" : "Expand chart workstation"}>
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}{expanded ? "Close" : "Expand"}
        </button>
      </header>
      <div className={`min-h-0 ${expanded ? "flex-1 overflow-auto p-3" : "p-2"}`}>
        <div className="mb-2 flex items-center justify-between border border-[#1c2634] bg-[#080d13] px-3 py-2 font-mono">
          <div><span className="text-[9px] uppercase tracking-[.14em] text-[#5f6d80]">Active study</span><span className="ml-3 text-[11px] font-bold text-[#dce5f2]">{active.label}</span></div>
          <div className="text-[9px] uppercase tracking-[.08em] text-[#66758a]">Persisted timeline data · no synthetic display series</div>
        </div>
        {view === "market" && <MarketPathChart data={analytics.market_path} />}
        {view === "security" && (ticker ? <OhlcvTerminal ticker={ticker} data={history} /> : <Empty label="Select a scenario security" />)}
        {view === "sectors" && <ScenarioHeatmaps sectors={analytics.sector_performance} companies={companies} />}
      </div>
      <footer className="flex flex-wrap items-center gap-4 border-t border-[#202a38] bg-[#080d13] px-4 py-2 font-mono text-[8px] uppercase tracking-[.1em] text-[#5f6d80]">
        <span>1 click changes study</span><span>Crosshair telemetry</span><span>Range navigator</span><span>Indicator toggles</span><span className="ml-auto text-[#7d8da4]">{ticker || "Composite"} · {analytics.market_path.length} observations</span>
      </footer>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="grid h-[480px] place-items-center border border-[#202a38] bg-[#05090e] font-mono text-xs uppercase tracking-[.12em] text-[#657287]">{label}</div>;
}
