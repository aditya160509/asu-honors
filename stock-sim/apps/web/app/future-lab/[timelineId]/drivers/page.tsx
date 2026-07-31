"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { ResultShell } from "@/components/future-lab/ResultShell";
import { FactorAnalytics } from "@/components/simulation/FactorAnalytics";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { useTimelineAnalytics } from "@/lib/api/hooks/useSimulation";
export default function DriversPage() {
  const id = Number(useParams<{ timelineId: string }>().timelineId);
  const { data: market } = useMarketGrid(id);
  const { data } = useTimelineAnalytics(id);
  const universe = React.useMemo(() => market?.companies ?? [], [market?.companies]);
  const [ticker, setTicker] = React.useState("");
  React.useEffect(() => { if (!ticker && universe[0]) setTicker(universe[0].ticker); }, [ticker, universe]);
  return (
    <ResultShell timelineId={id}>
      <div className="space-y-5">
        <section className="flex flex-wrap items-center gap-3 border border-[#263246] bg-[#0a1018] px-4 py-3">
          <div><div className="font-mono text-[9px] uppercase tracking-[.16em] text-[#f3b33d]">Driver chart security</div><div className="mt-1 text-xs text-[#cad5e3]">Choose any persisted constituent, then select an individual factor tab below.</div></div>
          <select aria-label="Driver chart security" value={ticker} onChange={(event) => setTicker(event.target.value)} className="ml-auto min-w-72 border border-[#324158] bg-[#060a0f] px-3 py-2 font-mono text-xs text-white outline-none focus:border-[#5798ff]">
            {universe.map((company) => <option key={company.ticker} value={company.ticker}>{company.ticker} · {company.name}</option>)}
          </select>
        </section>
        {ticker ? (
          <FactorAnalytics ticker={ticker} timelineId={id} />
        ) : (
          <p className="text-sm text-[var(--mer-ink-muted)]">
            No persisted company data.
          </p>
        )}
        <section className="border border-[#263246] bg-[#070b11] p-4">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-[.1em] text-white">Cross-market factor heatmap</h2>
          <p className="mt-1 text-[10px] text-[#66758a]">Color is signed contribution; size and bar length represent absolute share of the latest persisted move.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data?.risk_decomposition.map((r) => (
              <div key={r.driver_key} className="min-h-32 border border-black/30 p-3 font-mono" style={{background:r.contribution>=0?`rgba(25,157,107,${Math.min(.7,.12+Math.abs(r.share_pct)/100)})`:`rgba(203,62,76,${Math.min(.7,.12+Math.abs(r.share_pct)/100)})`}}>
                <div className="flex justify-between text-[10px]">
                  <span className="uppercase tracking-[.06em] text-white/75">
                    {r.driver_key.replaceAll("_", " ")}
                  </span>
                  <span className="text-white">{r.share_pct.toFixed(1)}%</span>
                </div>
                <div className="mt-7 text-2xl font-bold tabular-nums text-white">{r.contribution>=0?"+":""}{r.contribution.toFixed(4)}</div>
                <div className="mt-4 h-1 bg-black/20"><div className="h-full bg-white/70" style={{width:`${Math.min(100,r.share_pct)}%`}}/></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ResultShell>
  );
}
