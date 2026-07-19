"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimelineGroupDistribution } from "@/lib/api/hooks/useSimulation";
import { formatPrice } from "@/lib/utils";

interface Props {
  groupId: number;
  metric?: string;
}

/** Section 11.5 outcome distribution panel: histogram of terminal portfolio
 * value/return with mean, median, and percentile markers, answering "how bad
 * could this realistically get" for a Monte Carlo ensemble. */
export function OutcomeHistogram({ groupId, metric = "portfolio_return" }: Props) {
  const { data, isLoading } = useTimelineGroupDistribution(groupId, metric);

  if (isLoading) return <Skeleton width="100%" height={200} />;
  if (!data || data.count === 0) {
    return <EmptyState title="No outcomes yet" description="This ensemble has no completed members yet." />;
  }

  const maxCount = Math.max(...data.histogram_counts, 1);
  const var95 = data.percentiles["5"];

  return (
    <div className="card-flat p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-small font-medium text-text-primary">Outcome distribution</h4>
        <span className="text-micro text-text-tertiary">{data.count} run(s)</span>
      </div>

      <div className="flex items-end gap-0.5 h-[120px]">
        {data.histogram_counts.map((count, i) => (
          <div
            key={i}
            className="flex-1 bg-accent/60 rounded-t-sm"
            style={{ height: `${(count / maxCount) * 100}%` }}
            title={`${count} run(s)`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 text-small">
        <Stat label="Mean" value={data.mean} />
        <Stat label="Median" value={data.median} />
        <Stat label="VaR-95" value={var95} negative />
      </div>
    </div>
  );
}

function Stat({ label, value, negative = false }: { label: string; value: number | null | undefined; negative?: boolean }) {
  return (
    <div>
      <p className="text-micro text-text-tertiary">{label}</p>
      <p className={`num ${negative ? "text-negative" : "text-text-primary"}`}>
        {value !== null && value !== undefined ? formatPrice(value) : "—"}
      </p>
    </div>
  );
}
