"use client";

import * as React from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimelineGroup } from "@/lib/api/hooks/useSimulation";
import { usePriceHistory } from "@/lib/api/hooks/useCompany";
import type { PriceHistoryItem } from "@/lib/api/types";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawPriceAxis, drawTimeAxis } from "@/lib/charts/core/Axis";
import { drawLineSeries, lineYDomain } from "@/lib/charts/series/LineSeries";
import { drawPercentileBandSeries } from "@/lib/charts/series/PercentileBandSeries";
import { formatDateAxis, formatPriceAxis } from "@/lib/charts/core/utils";
import type { LinePoint } from "@/lib/charts/types";
import { computePercentilePaths } from "@/lib/charts/comparison/percentiles";

interface Props {
  groupId: number;
  ticker: string;
}

const PADDING = { top: 16, right: 56, bottom: 24, left: 8 };

/** Section 11.5 — median path plus shaded 10/25-75/90 percentile bands,
 * standard for distributional scenario output. Reduced client-side from
 * each ensemble member's own price history, since the backend's
 * timeline-groups/distribution endpoint only aggregates a single terminal
 * scalar (portfolio_return) per member, not a full percentile path. */
export function EnsembleFanChart({ groupId, ticker }: Props) {
  const { data: group, isLoading: groupLoading } = useTimelineGroup(groupId);
  const memberIds = group?.member_timeline_ids ?? [];

  // Rules of Hooks forbids calling hooks in a loop, so a bounded number of
  // explicit, unconditional useQuery calls fetch each member's price history.
  // Capped at 20 rather than the spec's full ensemble_size (default 100,
  // configurable) -- 20 sampled paths is already enough to estimate stable
  // 10/25/50/75/90 percentile bands for the fan chart; rendering all 100
  // would need 100 hand-written hook calls for no visual benefit.
  const h0 = usePriceHistory(ticker, memberIds[0], undefined, undefined, { enabled: memberIds[0] !== undefined });
  const h1 = usePriceHistory(ticker, memberIds[1], undefined, undefined, { enabled: memberIds[1] !== undefined });
  const h2 = usePriceHistory(ticker, memberIds[2], undefined, undefined, { enabled: memberIds[2] !== undefined });
  const h3 = usePriceHistory(ticker, memberIds[3], undefined, undefined, { enabled: memberIds[3] !== undefined });
  const h4 = usePriceHistory(ticker, memberIds[4], undefined, undefined, { enabled: memberIds[4] !== undefined });
  const h5 = usePriceHistory(ticker, memberIds[5], undefined, undefined, { enabled: memberIds[5] !== undefined });
  const h6 = usePriceHistory(ticker, memberIds[6], undefined, undefined, { enabled: memberIds[6] !== undefined });
  const h7 = usePriceHistory(ticker, memberIds[7], undefined, undefined, { enabled: memberIds[7] !== undefined });
  const h8 = usePriceHistory(ticker, memberIds[8], undefined, undefined, { enabled: memberIds[8] !== undefined });
  const h9 = usePriceHistory(ticker, memberIds[9], undefined, undefined, { enabled: memberIds[9] !== undefined });
  const h10 = usePriceHistory(ticker, memberIds[10], undefined, undefined, { enabled: memberIds[10] !== undefined });
  const h11 = usePriceHistory(ticker, memberIds[11], undefined, undefined, { enabled: memberIds[11] !== undefined });
  const h12 = usePriceHistory(ticker, memberIds[12], undefined, undefined, { enabled: memberIds[12] !== undefined });
  const h13 = usePriceHistory(ticker, memberIds[13], undefined, undefined, { enabled: memberIds[13] !== undefined });
  const h14 = usePriceHistory(ticker, memberIds[14], undefined, undefined, { enabled: memberIds[14] !== undefined });
  const h15 = usePriceHistory(ticker, memberIds[15], undefined, undefined, { enabled: memberIds[15] !== undefined });
  const h16 = usePriceHistory(ticker, memberIds[16], undefined, undefined, { enabled: memberIds[16] !== undefined });
  const h17 = usePriceHistory(ticker, memberIds[17], undefined, undefined, { enabled: memberIds[17] !== undefined });
  const h18 = usePriceHistory(ticker, memberIds[18], undefined, undefined, { enabled: memberIds[18] !== undefined });
  const h19 = usePriceHistory(ticker, memberIds[19], undefined, undefined, { enabled: memberIds[19] !== undefined });
  const histories = [h0, h1, h2, h3, h4, h5, h6, h7, h8, h9, h10, h11, h12, h13, h14, h15, h16, h17, h18, h19];

  if (groupLoading) return <Skeleton width="100%" height={300} />;
  if (memberIds.length === 0) {
    return <EmptyState title="No ensemble members" description="This group has no member timelines yet." />;
  }

  const memberSeries: LinePoint[][] = memberIds
    .map((_, i) => histories[i]?.data)
    .filter((data): data is PriceHistoryItem[] => Boolean(data))
    .map((data) => data.map((item, idx) => ({ time: idx, value: Number(item.close) })));

  if (memberSeries.length === 0) {
    return <EmptyState title="No price data yet" description="Ensemble members haven't ticked yet." />;
  }

  // Clip to the shortest member's length, per percentiles.ts's own guidance --
  // charting out to the longest member means the sample feeding each
  // percentile shrinks toward n=1 past the shorter members' ends, making the
  // band collapse onto whichever single path ran furthest (misreading as
  // "certainty increasing" when it's really just fewer members contributing).
  const chartLen = Math.min(...memberSeries.map((s) => s.length));
  const percentilePaths = computePercentilePaths(memberSeries, chartLen);
  const allValues = memberSeries.flat();
  const yDomain = lineYDomain(allValues);

  const referenceDates = (histories.find((h) => h.data)?.data ?? []).map((item) => item.sim_date);

  return (
    <div className="card-flat">
      <ChartSurface height={320} padding={PADDING}>
        {({ ctx, width, height, dpr }) => {
          drawGrid({ ctx, width, height, dpr, padding: PADDING });

          drawPercentileBandSeries({
            ctx,
            band: percentilePaths[10].map((p, i) => ({ time: i, low: p, high: percentilePaths[90][i] })),
            width,
            height,
            padding: PADDING,
            yDomain,
            fill: "#3b82f6",
            opacity: 0.1,
          });
          drawPercentileBandSeries({
            ctx,
            band: percentilePaths[25].map((p, i) => ({ time: i, low: p, high: percentilePaths[75][i] })),
            width,
            height,
            padding: PADDING,
            yDomain,
            fill: "#3b82f6",
            opacity: 0.2,
          });
          drawLineSeries({
            ctx,
            data: percentilePaths[50].map((v, i) => ({ time: i, value: v })),
            width,
            height,
            padding: PADDING,
            yDomain,
            color: "#3b82f6",
            lineWidth: 2,
          });

          drawPriceAxis({ ctx, width, height, padding: PADDING, yDomain, formatY: formatPriceAxis });
          const labelStep = Math.max(1, Math.floor(chartLen / 6));
          if (referenceDates.length > 0) {
            const timeLabels = referenceDates
              .slice(0, chartLen)
              .map((d, i) => ({ x: i, text: d }))
              .filter((_, i) => i % labelStep === 0)
              .map((l) => ({
                x: PADDING.left + (l.x / (chartLen - 1 || 1)) * (width - PADDING.left - PADDING.right),
                text: formatDateAxis(new Date(l.text).getTime() / 1000),
              }));
            drawTimeAxis({ ctx, width, height, padding: PADDING, labels: timeLabels });
          }
        }}
      </ChartSurface>
    </div>
  );
}
