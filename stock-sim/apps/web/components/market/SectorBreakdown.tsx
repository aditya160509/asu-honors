"use client";

import * as React from "react";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { cn, formatLarge } from "@/lib/utils";
import type { EnrichedCompany } from "@/lib/market/types";

export interface SectorBreakdownProps {
  companies: EnrichedCompany[];
  height?: number;
}

interface SectorData {
  name: string;
  count: number;
  totalCap: number;
  avgChange: number;
  avgIVGap: number;
  companies: EnrichedCompany[];
}

const BAR_COLORS = [
  "rgba(14,165,233,0.75)",
  "rgba(59,130,246,0.75)",
  "rgba(139,92,246,0.75)",
  "rgba(245,158,11,0.75)",
  "rgba(16,185,129,0.75)",
  "rgba(239,68,68,0.75)",
  "rgba(6,182,212,0.75)",
  "rgba(236,72,153,0.75)",
  "rgba(249,115,22,0.75)",
  "rgba(20,184,166,0.75)",
  "rgba(99,102,241,0.75)",
  "rgba(132,204,22,0.75)",
];

const PADDING = { top: 12, right: 16, bottom: 28, left: 140 };
const BAR_HEIGHT = 22;
const BAR_GAP = 5;

function aggregateSector(companies: EnrichedCompany[]): SectorData[] {
  const map = new Map<string, EnrichedCompany[]>();
  for (const c of companies) {
    const key = c.industry_name || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return Array.from(map.entries())
    .map(([name, group]) => ({
      name,
      count: group.length,
      totalCap: group.reduce((sum, c) => sum + (c.market_cap ?? 0), 0),
      avgChange:
        group.reduce((sum, c) => sum + (c.day_change_pct != null ? Number(c.day_change_pct) : 0), 0) /
        group.filter((c) => c.day_change_pct != null).length || 0,
      avgIVGap:
        group.reduce((sum, c) => sum + (c.ivGapPct ?? 0), 0) /
        group.filter((c) => c.ivGapPct != null).length || 0,
      companies: group,
    }))
    .sort((a, b) => b.totalCap - a.totalCap);
}

function changeColor(v: number): string {
  if (v >= 2) return "text-positive";
  if (v <= -2) return "text-negative";
  if (v >= 0) return "text-positive/70";
  return "text-negative/70";
}

export function SectorBreakdown({ companies, height = 280 }: SectorBreakdownProps) {
  const sectors = React.useMemo(() => aggregateSector(companies), [companies]);
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const [tooltip, setTooltip] = React.useState<{ x: number; y: number; sector: SectorData } | null>(null);

  const totalCap = React.useMemo(() => sectors.reduce((s, sec) => s + sec.totalCap, 0), [sectors]);
  const maxCap = React.useMemo(() => Math.max(...sectors.map((s) => s.totalCap)), [sectors]);

  const render = React.useCallback(
    ({ ctx, width, height: h }: { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number }) => {
      if (sectors.length === 0) return;

      const plotW = width - PADDING.left - PADDING.right;
      const maxBarW = maxCap > 0 ? plotW : 1;

      sectors.forEach((sector, i) => {
        const y = PADDING.top + i * (BAR_HEIGHT + BAR_GAP);
        const barW = (sector.totalCap / maxBarW) * plotW;
        const isHovered = hoveredIdx === i;

        const color = BAR_COLORS[i % BAR_COLORS.length];

        const alpha = isHovered ? 0.9 : 0.75;
        ctx.fillStyle = color.replace(/[\d.]+\)$/, `${alpha})`);

        const x = PADDING.left;
        const bw = Math.max(barW, 2);
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + bw - r, y);
        ctx.arcTo(x + bw, y, x + bw, y + r, r);
        ctx.lineTo(x + bw, y + BAR_HEIGHT - r);
        ctx.arcTo(x + bw, y + BAR_HEIGHT, x + bw - r, y + BAR_HEIGHT, r);
        ctx.lineTo(x + r, y + BAR_HEIGHT);
        ctx.arcTo(x, y + BAR_HEIGHT, x, y + BAR_HEIGHT - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = color.replace(/[\d.]+\)$/, "1)");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + bw - r, y);
          ctx.arcTo(x + bw, y, x + bw, y + r, r);
          ctx.lineTo(x + bw, y + BAR_HEIGHT - r);
          ctx.arcTo(x + bw, y + BAR_HEIGHT, x + bw - r, y + BAR_HEIGHT, r);
          ctx.lineTo(x + r, y + BAR_HEIGHT);
          ctx.arcTo(x, y + BAR_HEIGHT, x, y + BAR_HEIGHT - r, r);
          ctx.lineTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.closePath();
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "500 10px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const maxLabelW = PADDING.left - 10;
        let label = sector.name;
        while (ctx.measureText(label).width > maxLabelW && label.length > 3) {
          label = label.slice(0, -1);
        }
        if (label !== sector.name) label += "…";
        ctx.fillText(label, PADDING.left - 8, y + BAR_HEIGHT / 2);

        const pct = totalCap > 0 ? ((sector.totalCap / totalCap) * 100).toFixed(1) : "0";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "400 9px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${sector.count} stocks  ${pct}%`, PADDING.left + barW + 6, y + BAR_HEIGHT / 2);
      });
    },
    [sectors, hoveredIdx, maxCap, totalCap]
  );

  function handlePointerMove(x: number, y: number) {
    const idx = Math.floor((y - PADDING.top) / (BAR_HEIGHT + BAR_GAP));
    if (idx >= 0 && idx < sectors.length) {
      setHoveredIdx(idx);
      setTooltip({ x, y, sector: sectors[idx] });
    } else {
      setHoveredIdx(null);
      setTooltip(null);
    }
  }

  if (sectors.length === 0) return null;

  const totalHeight = PADDING.top + sectors.length * (BAR_HEIGHT + BAR_GAP) + PADDING.bottom;

  return (
    <div className="relative rounded-md border border-border bg-bg-secondary p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-small font-semibold text-text-primary">Sector Breakdown</h3>
        <span className="text-micro text-text-tertiary">{sectors.length} sectors</span>
      </div>
      <ChartSurface
        height={Math.max(totalHeight, height)}
        padding={PADDING}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          setHoveredIdx(null);
          setTooltip(null);
        }}
      >
        {render}
      </ChartSurface>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-md border border-border bg-bg-primary px-2.5 py-1.5 shadow-lg"
          style={{ left: Math.min(tooltip.x + 12, 300), top: tooltip.y - 40 }}
        >
          <div className="text-small font-bold text-text-primary">{tooltip.sector.name}</div>
          <div className="text-micro text-text-secondary">
            {tooltip.sector.count} stocks — {formatLarge(tooltip.sector.totalCap)}
          </div>
          <div className={cn("text-micro font-medium", changeColor(tooltip.sector.avgChange))}>
            Avg Chg: {tooltip.sector.avgChange >= 0 ? "+" : ""}
            {tooltip.sector.avgChange.toFixed(2)}%
          </div>
          {tooltip.sector.avgIVGap !== 0 && (
            <div className={cn("text-micro", tooltip.sector.avgIVGap < 0 ? "text-positive" : "text-negative")}>
              Avg IV Gap: {tooltip.sector.avgIVGap >= 0 ? "+" : ""}
              {tooltip.sector.avgIVGap.toFixed(2)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
