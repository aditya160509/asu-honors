"use client";

import * as React from "react";
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { sim_date: string; price: number; intrinsic_value: number };

function pct(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
function shortDate(value: string) { return value.slice(5); }

export function MarketPathChart({ data }: { data: Point[] }) {
  const enriched = React.useMemo(() => data.map((point, index) => {
    const prior = index > 0 ? data[index - 1].price : point.price;
    return {
      ...point,
      valuation_gap: point.intrinsic_value ? (point.price / point.intrinsic_value - 1) * 100 : 0,
      return_pct: prior ? (point.price / prior - 1) * 100 : 0,
    };
  }), [data]);
  const [active, setActive] = React.useState<Point | null>(null);

  if (!data.length) return <div className="grid h-80 place-items-center border border-[#202a38] bg-[#070b10] font-mono text-xs text-[#657287]">NO PERSISTED SERIES</div>;
  const point = active ?? data.at(-1)!;
  const gap = point.intrinsic_value ? (point.price / point.intrinsic_value - 1) * 100 : 0;
  const start = data[0].price;
  const totalReturn = start ? (point.price / start - 1) * 100 : 0;

  return (
    <section className="overflow-hidden border border-[#253044] bg-[#060a0f] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#1b2431] bg-[#0a1018] px-4 py-3 font-mono">
        <div><div className="text-[9px] uppercase tracking-[.16em] text-[#657287]">Market composite · equal weighted</div><div className="mt-1 text-sm font-semibold text-[#dce5f2]">PRICE / FAIR VALUE PATH</div></div>
        <div className="ml-auto grid grid-cols-2 gap-5 text-right sm:grid-cols-4">
          <Quote label="Price" value={point.price} />
          <Quote label="Fair value" value={point.intrinsic_value} />
          <Quote label="Valuation gap" value={pct(gap)} tone={gap > 0 ? "down" : "up"} />
          <Quote label="Window return" value={pct(totalReturn)} tone={totalReturn >= 0 ? "up" : "down"} />
        </div>
      </header>
      <div className="h-[430px] w-full px-2 pb-1 pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enriched} margin={{ top: 5, right: 22, bottom: 2, left: 4 }} onMouseMove={(state) => {
            const index = Number(state.activeIndex);
            if (Number.isInteger(index) && data[index]) setActive(data[index]);
          }} onMouseLeave={() => setActive(null)}>
            <defs>
              <linearGradient id="market-path-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#4e94ff" stopOpacity={0.3} />
                <stop offset="1" stopColor="#4e94ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#17202c" vertical={false} />
            <XAxis dataKey="sim_date" tickFormatter={shortDate} minTickGap={70} tick={{ fill: "#68768b", fontSize: 10, fontFamily: "monospace" }} axisLine={{ stroke: "#202a38" }} tickLine={false} />
            <YAxis yAxisId="price" width={62} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(2)} tick={{ fill: "#68768b", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="gap" orientation="right" width={54} domain={["auto", "auto"]} tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fill: "#56657a", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
            <ReferenceLine yAxisId="gap" y={0} stroke="#425066" strokeDasharray="2 4" />
            <Tooltip cursor={{ stroke: "#8290a3", strokeDasharray: "2 4" }} contentStyle={{ background: "#0b121b", border: "1px solid #2a374a", borderRadius: 0, fontFamily: "monospace", fontSize: 11 }} labelStyle={{ color: "#8190a5", marginBottom: 4 }} formatter={(value, name) => {
              const n = Number(value);
              if (name === "valuation_gap") return [pct(n), "Valuation gap"];
              return [n.toFixed(2), name === "price" ? "Market price" : "Intrinsic value"];
            }} />
            <Area yAxisId="price" type="monotone" dataKey="price" stroke="#58a0ff" strokeWidth={2.2} fill="url(#market-path-fill)" dot={false} activeDot={{ r: 4, fill: "#060a0f", stroke: "#74adff", strokeWidth: 2 }} isAnimationActive={false} />
            <Line yAxisId="price" type="monotone" dataKey="intrinsic_value" stroke="#e6ad39" strokeWidth={1.6} strokeDasharray="7 4" dot={false} activeDot={{ r: 3, fill: "#060a0f", stroke: "#e6ad39", strokeWidth: 2 }} isAnimationActive={false} />
            <Line yAxisId="gap" type="monotone" dataKey="valuation_gap" stroke="#9b7cff" strokeWidth={1} dot={false} opacity={0.45} isAnimationActive={false} />
            <Brush dataKey="sim_date" height={26} travellerWidth={5} stroke="#315d9e" fill="#09101a" tickFormatter={shortDate} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <footer className="flex flex-wrap gap-5 border-t border-[#18212d] bg-[#080d13] px-4 py-2 font-mono text-[9px] uppercase tracking-[.08em]">
        <span className="text-[#58a0ff]">━ Market price</span><span className="text-[#e6ad39]">┄ Intrinsic value</span><span className="text-[#9b7cff]">━ Valuation gap</span><span className="ml-auto text-[#657287]">{data.length} persisted observations · drag navigator to zoom</span>
      </footer>
    </section>
  );
}

function Quote({ label, value, tone }: { label: string; value: number | string; tone?: "up" | "down" }) {
  return <div><div className="text-[9px] uppercase tracking-[.12em] text-[#657287]">{label}</div><div className={`mt-1 tabular-nums ${tone === "up" ? "text-[#45d19a]" : tone === "down" ? "text-[#ff6b6b]" : "text-[#dce5f2]"}`}>{typeof value === "number" ? value.toFixed(2) : value}</div></div>;
}
