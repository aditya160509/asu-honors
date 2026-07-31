"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { ResultShell, Metric } from "@/components/future-lab/ResultShell";
import { StructuralDiffTable } from "@/components/simulation/comparison/StructuralDiffTable";
import {
  useTimelineAnalytics,
  useTimelines,
} from "@/lib/api/hooks/useSimulation";
export default function ComparePage() {
  const id = Number(useParams<{ timelineId: string }>().timelineId);
  const { data: timelines = [] } = useTimelines();
  const current = timelines.find((t) => t.id === id);
  const [compare, setCompare] = React.useState<number | undefined>();
  React.useEffect(() => {
    if (!compare)
      setCompare(
        current?.parent_timeline_id ?? timelines.find((t) => t.is_live)?.id,
      );
  }, [compare, current, timelines]);
  const { data } = useTimelineAnalytics(id, compare);
  return (
    <ResultShell timelineId={id}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] p-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Compare against
            </h2>
            <p className="mt-1 text-xs text-[var(--mer-ink-muted)]">
              Live, parent, or another persisted branch.
            </p>
          </div>
          <select
            value={compare ?? ""}
            onChange={(e) => setCompare(Number(e.target.value))}
            className="border border-[var(--mer-stroke-hairline)] bg-[#090d12] px-3 py-2 text-xs text-white"
          >
            {timelines
              .filter((t) => t.id !== id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · #{t.id}
                </option>
              ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Mean final price delta"
            value={
              data?.comparison?.mean_price_delta_pct == null
                ? "—"
                : `${data.comparison.mean_price_delta_pct >= 0 ? "+" : ""}${data.comparison.mean_price_delta_pct.toFixed(2)}%`
            }
          />
          <Metric
            label="Companies compared"
            value={String(data?.comparison?.companies_compared ?? 0)}
          />
          <Metric
            label="Reference timeline"
            value={compare ? `#${compare}` : "—"}
          />
        </div>
        {compare && (
          <StructuralDiffTable leftTimelineId={id} rightTimelineId={compare} />
        )}
        <a
          href={`/simulation?mode=future-lab&timelines=${compare},${id}`}
          className="inline-flex border border-[var(--mer-stroke-accent)] px-3 py-2 text-xs text-[var(--mer-accent-300)]"
        >
          Open full multi-series price comparison →
        </a>
      </div>
    </ResultShell>
  );
}
