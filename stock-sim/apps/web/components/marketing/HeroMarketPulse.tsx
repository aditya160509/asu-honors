"use client";

import * as React from "react";
import { cssVar } from "@/lib/utils";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import type { CompanyGridItem } from "@/lib/api/types";

export interface HeroMarketPulseProps {
  companies: CompanyGridItem[];
  height?: number;
}

interface SectorLine {
  name: string;
  points: number[];
  volatility: number;
}

function buildSectorLines(companies: CompanyGridItem[]): SectorLine[] {
  const bySector = new Map<string, number[]>();
  for (const c of companies) {
    const pct = c.day_change_pct ?? 0;
    const arr = bySector.get(c.industry_name) ?? [];
    arr.push(pct);
    bySector.set(c.industry_name, arr);
  }
  return Array.from(bySector.entries()).map(([name, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
    const volatility = Math.max(...values.map(Math.abs), 0.5);
    // Synthesize a short ribbon path so each sector reads as a flowing line, not a single point —
    // deterministic per-sector "spread" so re-renders are stable, seeded off the average return.
    const points = Array.from({ length: 24 }, (_, i) => avg + Math.sin(i / 3 + avg) * (volatility * 0.3));
    return { name, points, volatility };
  });
}

export function HeroMarketPulse({ companies, height = 480 }: HeroMarketPulseProps) {
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  const [hoveredLine, setHoveredLine] = React.useState<string | null>(null);
  const lines = React.useMemo(() => buildSectorLines(companies), [companies]);

  const render = React.useCallback(
    ({ ctx, width, height: h }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      if (cursor) {
        const gradient = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, width * 0.5);
        gradient.addColorStop(0, cssVar('--mkt-signature') + '0d');
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, h);
      }

      let closestName: string | null = null;
      let closestDist = Infinity;

      lines.forEach((line) => {
        const stepX = width / (line.points.length - 1);
        const midY = h / 2;
        const amplitude = h * 0.35;

        ctx.beginPath();
        line.points.forEach((p, i) => {
          const x = i * stepX;
          const y = midY - p * (amplitude / 5);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          if (cursor) {
            const dist = Math.hypot(cursor.x - x, cursor.y - y);
            if (dist < closestDist) {
              closestDist = dist;
              closestName = line.name;
            }
          }
        });

        const isHovered = hoveredLine === line.name;
        ctx.strokeStyle = isHovered ? cssVar('--mkt-signature') : cssVar('--mkt-text-muted');
        ctx.globalAlpha = isHovered ? 1 : hoveredLine ? 0.25 : 0.5;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      if (closestDist < 40 && closestName !== hoveredLine) {
        setHoveredLine(closestName);
      } else if (closestDist >= 40 && hoveredLine) {
        setHoveredLine(null);
      }
    },
    [lines, cursor, hoveredLine]
  );

  return (
    <div className="relative">
      <ChartSurface
        height={height}
        padding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        onPointerMove={(x, y) => setCursor({ x, y })}
        onPointerLeave={() => {
          setCursor(null);
          setHoveredLine(null);
        }}
        className="cursor-default"
      >
        {render}
      </ChartSurface>
      {hoveredLine && (
        <div className="absolute top-4 left-4 text-mkt-signature text-small num pointer-events-none">
          {hoveredLine}
        </div>
      )}
    </div>
  );
}
