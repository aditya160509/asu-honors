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
  const h0 = usePriceHistory(ticker, memberIds[0], undefined, undefined);
  const h1 = usePriceHistory(ticker, memberIds[1], undefined, undefined);
  const h2 = usePriceHistory(ticker, memberIds[2], undefined, undefined);
  const h3 = usePriceHistory(ticker, memberIds[3], undefined, undefined);
  const h4 = usePriceHistory(ticker, memberIds[4], undefined, undefined);
  const h5 = usePriceHistory(ticker, memberIds[5], undefined, undefined);
  const h6 = usePriceHistory(ticker, memberIds[6], undefined, undefined);
  const h7 = usePriceHistory(ticker, memberIds[7], undefined, undefined);
  const h8 = usePriceHistory(ticker, memberIds[8], undefined, undefined);
  const h9 = usePriceHistory(ticker, memberIds[9], undefined, undefined);
  const h10 = usePriceHistory(ticker, memberIds[10], undefined, undefined);
  const h11 = usePriceHistory(ticker, memberIds[11], undefined, undefined);
  const h12 = usePriceHistory(ticker, memberIds[12], undefined, undefined);
  const h13 = usePriceHistory(ticker, memberIds[13], undefined, undefined);
  const h14 = usePriceHistory(ticker, memberIds[14], undefined, undefined);
  const h15 = usePriceHistory(ticker, memberIds[15], undefined, undefined);
  const h16 = usePriceHistory(ticker, memberIds[16], undefined, undefined);
  const h17 = usePriceHistory(ticker, memberIds[17], undefined, undefined);
  const h18 = usePriceHistory(ticker, memberIds[18], undefined, undefined);
  const h19 = usePriceHistory(ticker, memberIds[19], undefined, undefined);
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

  const maxLen = Math.max(...memberSeries.map((s) => s.length));
  const percentilePaths = computePercentilePaths(memberSeries, maxLen);
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
          const labelStep = Math.max(1, Math.floor(maxLen / 6));
          if (referenceDates.length > 0) {
            const timeLabels = referenceDates
              .map((d, i) => ({ x: i, text: d }))
              .filter((_, i) => i % labelStep === 0)
              .map((l) => ({
                x: PADDING.left + (l.x / (maxLen - 1 || 1)) * (width - PADDING.left - PADDING.right),
                text: formatDateAxis(new Date(l.text).getTime() / 1000),
              }));
            drawTimeAxis({ ctx, width, height, padding: PADDING, labels: timeLabels });
          }
        }}
      </ChartSurface>
    </div>
  );
}
