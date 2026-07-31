"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDriverHistory } from "@/lib/api/hooks/useCompany";
import type { DriverHistoryItem } from "@/lib/api/types";

const FACTORS = [
  ["value_opportunity", "Value Opportunity"],
  ["earnings_surprise", "Earnings Surprise"],
  ["news_severity", "News Severity"],
  ["economic_outlook", "Economic Outlook"],
  ["guidance", "Guidance"],
  ["technical_momentum", "Technical Momentum"],
  ["institutional_buying", "Institutional Buying"],
] as const;

type FactorKey = (typeof FACTORS)[number][0];
type ChartMode = "value" | "contribution";
const EMPTY_ROWS: DriverHistoryItem[] = [];

function fmt(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function shortDate(value: string) {
  return value.slice(5);
}

function FactorSparkline({ rows, active }: { rows: DriverHistoryItem[]; active: boolean }) {
  const points = rows.slice(-28).map((row, index) => ({ index, value: row.value }));
  return (
    <div className="h-7 w-20" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 3, right: 1, bottom: 1, left: 1 }}>
          <defs>
            <linearGradient id={`spark-${active ? "active" : "idle"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={active ? "#69a7ff" : "#66758c"} stopOpacity={0.35} />
              <stop offset="1" stopColor={active ? "#69a7ff" : "#66758c"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={active ? "#69a7ff" : "#66758c"} strokeWidth={1.5} fill={`url(#spark-${active ? "active" : "idle"})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FactorAnalytics({ ticker, timelineId }: { ticker: string; timelineId?: number }) {
  const { data, isLoading, isError } = useDriverHistory(ticker, timelineId);
  const [factor, setFactor] = React.useState<FactorKey>(FACTORS[0][0]);
  const [mode, setMode] = React.useState<ChartMode>("value");
  const rows = data ?? EMPTY_ROWS;

  const byFactor = React.useMemo(() => {
    const grouped = new Map<string, DriverHistoryItem[]>();
    for (const row of rows) {
      const bucket = grouped.get(row.driver_key) ?? [];
      bucket.push(row);
      grouped.set(row.driver_key, bucket);
    }
    return grouped;
  }, [rows]);

  const selected = byFactor.get(factor) ?? [];
  const chartData = selected.map((row) => ({
    ...row,
    metric: mode === "value" ? row.value : row.contribution,
  }));
  const latest = selected.at(-1);
  const first = selected[0];
  const label = FACTORS.find(([key]) => key === factor)?.[1] ?? factor;
  const latestMetric = latest ? (mode === "value" ? latest.value : latest.contribution) : null;
  const metricChange = latest && first
    ? (mode === "value" ? latest.value - first.value : latest.contribution - first.contribution)
    : null;

  return (
    <section aria-label="Factor analytics" className="mt-1 overflow-hidden border border-[#202a38] bg-[#070b10] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#1b2431] bg-[#0a1018] px-4 py-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[.18em] text-[#657287]">Persisted engine telemetry</div>
          <h3 className="mt-1 text-[13px] font-semibold text-[#dce5f2]">Factor signal laboratory</h3>
        </div>
        <div className="ml-auto flex border border-[#263247] bg-[#070b10] p-0.5">
          {(["value", "contribution"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setMode(item)} className={`px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[.08em] transition ${mode === item ? "bg-[#17315a] text-[#75adff]" : "text-[#71809a] hover:text-[#b9c5d6]"}`}>
              {item === "value" ? "Raw signal" : "Weighted impact"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-[#18212d] bg-[#080d13] p-2" role="tablist" aria-label="Factors">
        {FACTORS.map(([key, name]) => {
          const factorRows = byFactor.get(key) ?? [];
          const last = factorRows.at(-1);
          const active = factor === key;
          return (
            <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setFactor(key)} className={`min-w-[154px] border px-2.5 py-2 text-left transition ${active ? "border-[#386bbb] bg-[#10203a]" : "border-[#1d2734] bg-[#090e14] hover:border-[#334156]"}`}>
              <div className="truncate text-[10px] font-medium text-[#9eacbf]">{name}</div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <span className={`font-mono text-[12px] font-bold ${last && last.value >= 0 ? "text-[#45d19a]" : "text-[#ff737b]"}`}>{last ? fmt(last.value) : "—"}</span>
                <FactorSparkline rows={factorRows} active={active} />
              </div>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid h-[380px] place-items-center font-mono text-xs text-[#657287]">LOADING PERSISTED FACTORS…</div>
      ) : isError ? (
        <div className="grid h-[260px] place-items-center font-mono text-xs text-[#ff737b]">FACTOR HISTORY UNAVAILABLE</div>
      ) : chartData.length === 0 ? (
        <div className="grid h-[260px] place-items-center font-mono text-xs text-[#657287]">NO FACTOR OBSERVATIONS</div>
      ) : (
        <>
          <div className="grid grid-cols-2 border-b border-[#18212d] sm:grid-cols-4">
            <Metric label="Latest" value={latestMetric == null ? "—" : fmt(latestMetric, 4)} tone={latestMetric ?? 0} />
            <Metric label="Model weight" value={latest ? latest.weight.toFixed(4) : "—"} />
            <Metric label="Window change" value={metricChange == null ? "—" : fmt(metricChange, 4)} tone={metricChange ?? 0} />
            <Metric label="Observations" value={chartData.length.toLocaleString()} />
          </div>
          <div className="px-2 pb-2 pt-4">
            <div className="mb-2 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[.08em] text-[#71809a]">
              <span>{label} · {mode === "value" ? "raw score" : "score × configured weight"}</span>
              <span>{latest?.sim_date}</span>
            </div>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 22, bottom: 6, left: 0 }}>
                  <defs>
                    <linearGradient id="factor-main-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#5798ff" stopOpacity={0.28} />
                      <stop offset="1" stopColor="#5798ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#17202c" vertical={false} />
                  <XAxis dataKey="sim_date" tickFormatter={shortDate} minTickGap={54} tick={{ fill: "#68768b", fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: "#202a38" }} tickLine={false} />
                  <YAxis width={58} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(3)} tick={{ fill: "#68768b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={0} stroke="#58677b" strokeDasharray="3 4" />
                  <Tooltip cursor={{ stroke: "#8290a3", strokeDasharray: "2 4" }} contentStyle={{ background: "#0b121b", border: "1px solid #2a374a", borderRadius: 0, fontFamily: "monospace", fontSize: 11 }} labelStyle={{ color: "#8190a5" }} formatter={(value) => [fmt(Number(value), 4), mode === "value" ? "Raw signal" : "Weighted impact"]} />
                  <Area type="monotone" dataKey="metric" stroke="#63a2ff" strokeWidth={2} fill="url(#factor-main-fill)" dot={false} activeDot={{ r: 4, fill: "#070b10", stroke: "#7eb2ff", strokeWidth: 2 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="contribution" stroke="#e6ad39" strokeWidth={1} strokeDasharray="5 4" dot={false} opacity={mode === "value" ? 0.8 : 0} isAnimationActive={false} />
                  <Brush dataKey="sim_date" height={24} travellerWidth={5} stroke="#315d9e" fill="#0a1018" tickFormatter={shortDate} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#18212d] bg-[#080d13] px-4 py-2 font-mono text-[9px] uppercase tracking-[.08em] text-[#657287]">
            <span><i className="mr-1.5 inline-block h-0.5 w-4 bg-[#63a2ff] align-middle" /> selected metric</span>
            {mode === "value" && <span><i className="mr-1.5 inline-block w-4 border-t border-dashed border-[#e6ad39] align-middle" /> weighted contribution</span>}
            <span className="ml-auto">Source: /companies/{ticker}/drivers/history · timeline {timelineId ?? "live"}</span>
          </footer>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  const color = tone == null ? "text-[#dce5f2]" : tone >= 0 ? "text-[#45d19a]" : "text-[#ff737b]";
  return <div className="border-r border-[#18212d] px-4 py-2.5 last:border-r-0"><div className="font-mono text-[8px] uppercase tracking-[.14em] text-[#5f6d80]">{label}</div><div className={`mt-1 font-mono text-[12px] font-semibold tabular-nums ${color}`}>{value}</div></div>;
}
