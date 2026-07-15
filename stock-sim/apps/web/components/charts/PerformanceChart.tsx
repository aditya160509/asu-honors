"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawPriceAxis, drawTimeAxis } from "@/lib/charts/core/Axis";
import { drawCrosshair, drawCrosshairTooltip } from "@/lib/charts/core/Crosshair";
import { drawLineSeries, lineYDomain } from "@/lib/charts/series/LineSeries";
import { formatDateAxis, formatPriceAxis } from "@/lib/charts/core/utils";
import type { LinePoint } from "@/lib/charts/types";
import { cssVar } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export interface PerformanceChartProps {
  portfolioValues: LinePoint[];
  indexValues?: LinePoint[];
  height?: number;
  loading?: boolean;
}

const PADDING = { top: 8, right: 56, bottom: 24, left: 8 };

export function PerformanceChart({ portfolioValues, indexValues, height = 250, loading }: PerformanceChartProps) {
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);

  const render = React.useCallback(
    ({ ctx, width, height: h }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (portfolioValues.length === 0) return;
      const allValues = [...portfolioValues, ...(indexValues ?? [])].map((p) => p.value);
      const yDomain = lineYDomain(portfolioValues.map((p) => ({ time: p.time, value: p.value })));
      const combinedDomain: [number, number] = [Math.min(yDomain[0], ...allValues), Math.max(yDomain[1], ...allValues)];

      drawGrid({ ctx, width, height: h, padding: PADDING, dpr: 1 });

      if (indexValues && indexValues.length > 0) {
        drawLineSeries({
          ctx,
          data: indexValues,
          width,
          height: h,
          padding: PADDING,
          yDomain: combinedDomain,
          color: cssVar('--text-tertiary'),
          lineWidth: 1,
          dashed: [4, 4],
        });
      }

      drawLineSeries({
        ctx,
        data: portfolioValues,
        width,
        height: h,
        padding: PADDING,
        yDomain: combinedDomain,
        color: cssVar('--positive'),
        lineWidth: 2,
        fill: cssVar('--positive'),
      });

      drawPriceAxis({ ctx, width, height: h, padding: PADDING, yDomain: combinedDomain, formatY: formatPriceAxis });

      const labelCount = Math.min(6, portfolioValues.length);
      const step = Math.max(1, Math.floor(portfolioValues.length / labelCount));
      const plotW = width - PADDING.left - PADDING.right;
      const tMin = portfolioValues[0].time;
      const tMax = portfolioValues[portfolioValues.length - 1].time;
      const tSpan = tMax - tMin || 1;
      const labels = portfolioValues
        .filter((_, i) => i % step === 0)
        .map((p) => ({ x: PADDING.left + ((p.time - tMin) / tSpan) * plotW, text: formatDateAxis(p.time) }));
      drawTimeAxis({ ctx, width, height: h, padding: PADDING, labels });

      if (hover) {
        drawCrosshair({ ctx, width, height: h, dpr: 1, padding: PADDING, x: hover.x, y: hover.y });
        const idx = Math.round(((hover.x - PADDING.left) / plotW) * (portfolioValues.length - 1));
        const point = portfolioValues[Math.max(0, Math.min(portfolioValues.length - 1, idx))];
        if (point) {
          const lines = [new Date(point.time).toISOString().slice(0, 10), `Portfolio ${point.value.toFixed(2)}`];
          const indexPoint = indexValues?.[Math.max(0, Math.min((indexValues?.length ?? 1) - 1, idx))];
          if (indexPoint) lines.push(`Index ${indexPoint.value.toFixed(2)}`);
          drawCrosshairTooltip({ ctx, x: hover.x, y: hover.y, lines });
        }
      }
    },
    [portfolioValues, indexValues, hover]
  );

  if (loading) return <Skeleton height={height} className="w-full" />;
  if (portfolioValues.length === 0) return <EmptyState title="No performance data yet." />;

  return (
    <ChartSurface
      height={height}
      padding={PADDING}
      onPointerMove={(x, y) => setHover({ x, y })}
      onPointerLeave={() => setHover(null)}
    >
      {render}
    </ChartSurface>
  );
}
