"use client";
import { useParams } from "next/navigation";
import { ResultShell } from "@/components/future-lab/ResultShell";
import { EnsembleFanChart } from "@/components/simulation/comparison/EnsembleFanChart";
import { OutcomeHistogram } from "@/components/simulation/comparison/OutcomeHistogram";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import {
  useTimelineGroupDistribution,
  useTimelines,
} from "@/lib/api/hooks/useSimulation";
export default function EnsemblePage() {
  const id = Number(useParams<{ timelineId: string }>().timelineId);
  const { data: timelines = [] } = useTimelines();
  const timeline = timelines.find((t) => t.id === id);
  const groupId = timeline?.timeline_group_id ?? undefined;
  const { data: market } = useMarketGrid(id);
  const { data: distribution } = useTimelineGroupDistribution(groupId);
  const ticker = market?.companies[0]?.ticker;
  return (
    <ResultShell timelineId={id}>
      {!groupId ? (
        <div className="border border-[var(--mer-stroke-hairline)] p-8 text-sm text-[var(--mer-ink-muted)]">
          This is a single scenario, not an ensemble.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <OutcomeHistogram groupId={groupId} metric="portfolio_value" />
            <Percentiles data={distribution?.percentiles ?? {}} />
          </div>
          {ticker && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-white">
                Monte Carlo confidence bands · {ticker}
              </h2>
              <EnsembleFanChart groupId={groupId} ticker={ticker} />
            </section>
          )}
          {timeline?.primitive === "sensitivity_sweep" && distribution && (
            <Sensitivity samples={distribution.samples} />
          )}
        </div>
      )}
    </ResultShell>
  );
}
function Percentiles({ data }: { data: Record<string, number> }) {
  return (
    <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] p-4">
      <h2 className="text-sm font-semibold text-white">
        Percentiles and confidence interval
      </h2>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {["5", "25", "50", "75", "95"].map((p) => (
          <div key={p}>
            <div className="text-[10px] text-[var(--mer-ink-muted)]">P{p}</div>
            <div className="mt-1 font-mono text-xs text-white">
              {data[p]?.toFixed(2) ?? "—"}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--mer-ink-muted)]">
        90% empirical interval: P5–P95. Inner band: P25–P75.
      </p>
    </section>
  );
}
function Sensitivity({
  samples,
}: {
  samples: Array<{ sweep_value: string | null; value: number }>;
}) {
  const points = samples
    .filter((s) => s.sweep_value != null)
    .sort((a, b) => Number(a.sweep_value) - Number(b.sweep_value));
  const xs = points.map((p) => Number(p.sweep_value)),
    ys = points.map((p) => p.value);
  const x0 = Math.min(...xs),
    xr = Math.max(...xs) - x0 || 1,
    y0 = Math.min(...ys),
    yr = Math.max(...ys) - y0 || 1;
  const path = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"} ${(((Number(p.sweep_value) - x0) / xr) * 100).toFixed(2)} ${(94 - ((p.value - y0) / yr) * 88).toFixed(2)}`,
    )
    .join(" ");
  return (
    <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] p-4">
      <h2 className="text-sm font-semibold text-white">Sensitivity curve</h2>
      <p className="mt-1 text-xs text-[var(--mer-ink-muted)]">
        Persisted terminal portfolio value by swept parameter.
      </p>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="mt-4 h-64 w-full"
      >
        <path
          d={path}
          fill="none"
          stroke="#72a5ff"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </section>
  );
}
