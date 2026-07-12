"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { formatLarge } from "@/lib/utils";

export interface AllocationSlice {
  label: string;
  value: number;
  color: string;
}

export interface AllocationChartProps {
  data: AllocationSlice[];
  height?: number;
  loading?: boolean;
}

const MAX_SEGMENTS = 5;
const OUTER_RADIUS = 80;
const INNER_RADIUS = 50;

function groupSlices(data: AllocationSlice[]): AllocationSlice[] {
  if (data.length <= MAX_SEGMENTS) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, MAX_SEGMENTS - 1);
  const rest = sorted.slice(MAX_SEGMENTS - 1);
  const otherValue = rest.reduce((sum, s) => sum + s.value, 0);
  return [...top, { label: "Other", value: otherValue, color: "#6b7280" }];
}

export function AllocationChart({ data, height = 220, loading }: AllocationChartProps) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const slices = React.useMemo(() => groupSlices(data), [data]);
  const total = React.useMemo(() => slices.reduce((sum, s) => sum + s.value, 0), [slices]);

  const render = React.useCallback(
    ({ ctx, width, height: h }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      const cx = width / 2;
      const cy = h / 2;

      if (total === 0) {
        ctx.save();
        ctx.strokeStyle = "#2a2a2e";
        ctx.lineWidth = OUTER_RADIUS - INNER_RADIUS;
        ctx.beginPath();
        ctx.arc(cx, cy, (OUTER_RADIUS + INNER_RADIUS) / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }

      let startAngle = -Math.PI / 2;
      slices.forEach((slice, i) => {
        const fraction = slice.value / total;
        const endAngle = startAngle + fraction * Math.PI * 2;
        const isHovered = hoverIndex === i;
        const midAngle = (startAngle + endAngle) / 2;
        const offset = isHovered ? 4 : 0;
        const ox = Math.cos(midAngle) * offset;
        const oy = Math.sin(midAngle) * offset;

        ctx.save();
        ctx.globalAlpha = hoverIndex == null || isHovered ? 1 : 0.4;
        ctx.strokeStyle = slice.color;
        ctx.lineWidth = OUTER_RADIUS - INNER_RADIUS;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, (OUTER_RADIUS + INNER_RADIUS) / 2, startAngle, endAngle);
        ctx.stroke();
        ctx.restore();

        startAngle = endAngle;
      });

      ctx.save();
      ctx.fillStyle = "#98989e";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(hoverIndex != null ? slices[hoverIndex].label : "Total", cx, cy - 2);
      ctx.fillStyle = "#e8e8ea";
      ctx.font = "bold 15px monospace";
      ctx.textBaseline = "top";
      ctx.fillText(
        hoverIndex != null ? formatLarge(slices[hoverIndex].value) : formatLarge(total),
        cx,
        cy + 2
      );
      ctx.restore();
    },
    [slices, total, hoverIndex]
  );

  function handlePointerMove(x: number, y: number) {
    if (total === 0) {
      setHoverIndex(null);
      return;
    }
    // x/y are already center-relative (caller subtracts canvas center). Convert to an
    // angle starting at -90deg (12 o'clock, matching the render loop's startAngle).
    const angle = Math.atan2(y, x);
    let a = angle + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    let startAngle = 0;
    for (let i = 0; i < slices.length; i++) {
      const fraction = slices[i].value / total;
      const endAngle = startAngle + fraction * Math.PI * 2;
      if (a >= startAngle && a < endAngle) {
        setHoverIndex(i);
        return;
      }
      startAngle = endAngle;
    }
  }

  if (loading) {
    return <div className="rounded-full bg-bg-tertiary skeleton-shimmer mx-auto" style={{ width: OUTER_RADIUS * 2, height: OUTER_RADIUS * 2 }} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ChartSurface
        height={height}
        padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        onPointerMove={(x, y) => handlePointerMove(x - height / 2, y - height / 2)}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {render}
      </ChartSurface>
      {total === 0 ? (
        <p className="text-small text-text-tertiary text-center">No holdings</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
          {slices.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5 text-small">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className={hoverIndex === i ? "text-text-primary" : "text-text-secondary"}>{s.label}</span>
              <span className="num text-text-tertiary">{((s.value / total) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
