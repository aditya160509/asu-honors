"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import type { EnrichedCompany } from "@/lib/market/types";

export interface DistributionHistogramProps {
  companies: EnrichedCompany[];
  metric: "price" | "marketCap" | "dayChange" | "ivGap" | "volatility";
  height?: number;
}

interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
  avgIVGap?: number;
}

const PADDING = { top: 8, right: 16, bottom: 36, left: 40 };
const BAR_GAP = 2;

function buildBuckets(companies: EnrichedCompany[], metric: string): Bucket[] {
  const values = companies
    .map((c) => {
      switch (metric) {
        case "price":
          return Number(c.current_price);
        case "marketCap":
          return c.market_cap != null ? Math.log10(Number(c.market_cap)) : null;
        case "dayChange":
          return c.day_change_pct != null ? Number(c.day_change_pct) : null;
        case "ivGap":
          return c.ivGapPct != null ? Number(c.ivGapPct) : null;
        case "volatility":
          return c.volatility != null ? Number(c.volatility) : null;
        default:
          return null;
      }
    })
    .filter((v): v is number => v != null);

  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  let bucketCount: number;
  let bucketLabels: ((min: number, max: number) => string) | undefined;

  switch (metric) {
    case "price":
      bucketCount = 8;
      bucketLabels = (min, max) => `$${min.toFixed(0)}-$${max.toFixed(0)}`;
      break;
    case "marketCap":
      bucketCount = 6;
      bucketLabels = (min, max) => {
        const fmt = (v: number) => {
          if (v >= 9) return `$${(10 ** v / 1e9).toFixed(0)}B+`;
          if (v >= 6) return `$${(10 ** v / 1e6).toFixed(0)}M`;
          return `$${(10 ** v / 1e3).toFixed(0)}K`;
        };
        return `${fmt(min)}-${fmt(max)}`;
      };
      break;
    case "dayChange":
      bucketCount = 10;
      bucketLabels = (min, max) => `${min >= 0 ? "+" : ""}${min.toFixed(1)}%`;
      break;
    case "ivGap":
      bucketCount = 8;
      bucketLabels = (min, max) => `${min >= 0 ? "+" : ""}${min.toFixed(1)}%`;
      break;
    case "volatility":
      bucketCount = 6;
      bucketLabels = (min, max) => `${(min * 100).toFixed(1)}%`;
      break;
    default:
      bucketCount = 6;
      bucketLabels = (min, max) => `${min.toFixed(1)}-${max.toFixed(1)}`;
  }

  if (min === max) {
    return [{ label: `${min.toFixed(2)}`, min, max, count: values.length, avgIVGap: 0 }];
  }

  const span = max - min;
  const step = span / bucketCount;
  const buckets: Bucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bMin = min + i * step;
    const bMax = i === bucketCount - 1 ? max + 0.001 : min + (i + 1) * step;
    const inBucket = values.filter((v) => v >= bMin && v < bMax);
    if (inBucket.length > 0 || i === 0) {
      buckets.push({
        label: bucketLabels!(bMin, bMax),
        min: bMin,
        max: bMax,
        count: inBucket.length,
      });
    }
  }

  return buckets;
}

export function DistributionHistogram({ companies, metric, height = 180 }: DistributionHistogramProps) {
  const buckets = React.useMemo(() => buildBuckets(companies, metric), [companies, metric]);
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const maxCount = React.useMemo(() => Math.max(...buckets.map((b) => b.count), 1), [buckets]);

  const metricLabels: Record<string, string> = {
    price: "Price Distribution",
    marketCap: "Market Cap Distribution (log scale)",
    dayChange: "Day Change Distribution",
    ivGap: "IV Gap Distribution",
    volatility: "Volatility Distribution",
  };

  const render = React.useCallback(
    ({ ctx, width, height: h }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      if (buckets.length === 0) return;

      const plotW = width - PADDING.left - PADDING.right;
      const plotH = h - PADDING.top - PADDING.bottom;
      const barW = (plotW - BAR_GAP * (buckets.length - 1)) / buckets.length;

      buckets.forEach((bucket, i) => {
        const barH = maxCount > 0 ? (bucket.count / maxCount) * plotH : 0;
        const x = PADDING.left + i * (barW + BAR_GAP);
        const y = h - PADDING.bottom - barH;
        const isHovered = hoveredIdx === i;

        const normalizedCount = bucket.count / maxCount;
        let alpha = 0.4 + normalizedCount * 0.5;
        if (isHovered) alpha = 1;

        ctx.fillStyle = `rgba(14,165,233,${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = "#0ea5e9";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "500 8px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(bucket.count.toString(), x + barW / 2, y - 4);

        ctx.save();
        ctx.translate(x + barW / 2, h - PADDING.bottom + 6);
        ctx.rotate(-Math.PI / 6);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "400 8px system-ui";
        ctx.textAlign = "right";
        ctx.fillText(bucket.label, 0, 0);
        ctx.restore();
      });

      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "500 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Count", PADDING.left - 20, PADDING.top + plotH / 2);
    },
    [buckets, maxCount, hoveredIdx]
  );

  function handlePointerMove(x: number, y: number) {
    const plotW = 600 - PADDING.left - PADDING.right;
    const barW = (plotW - BAR_GAP * (buckets.length - 1)) / buckets.length;
    const idx = Math.floor((x - PADDING.left) / (barW + BAR_GAP));
    setHoveredIdx(idx >= 0 && idx < buckets.length ? idx : null);
  }

  if (buckets.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-bg-secondary p-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-small font-semibold text-text-primary">{metricLabels[metric] ?? metric}</h3>
        <span className="text-micro text-text-tertiary">
          {companies.length} stocks
        </span>
      </div>
      <ChartSurface
        height={height}
        padding={PADDING}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredIdx(null)}
      >
        {render}
      </ChartSurface>
    </div>
  );
}
