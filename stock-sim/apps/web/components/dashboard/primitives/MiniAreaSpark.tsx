"use client";

import * as React from "react";
import { cssVar } from "@/lib/utils";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawLineSeries, lineYDomain } from "@/lib/charts/series/LineSeries";
import type { LinePoint } from "@/lib/charts/types";

export interface MiniAreaSparkProps {
  data: LinePoint[];
  height?: number;
  color?: string;
}

const PADDING = { top: 4, right: 2, bottom: 4, left: 2 };

/** Axis-less, crosshair-less area sparkline — the hero's "full-bleed chart" and any compact trend strip. */
export function MiniAreaSpark({ data, height = 56, color = cssVar('--accent') }: MiniAreaSparkProps) {
  const render = React.useCallback(
    ({ ctx, width, height: h }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (data.length < 2) return;
      const yDomain = lineYDomain(data);
      drawLineSeries({ ctx, data, width, height: h, padding: PADDING, yDomain, color, lineWidth: 1.5, fill: color });
    },
    [data, color]
  );

  if (data.length < 2) return null;

  return (
    <ChartSurface height={height} padding={PADDING} className="pointer-events-none">
      {render}
    </ChartSurface>
  );
}
