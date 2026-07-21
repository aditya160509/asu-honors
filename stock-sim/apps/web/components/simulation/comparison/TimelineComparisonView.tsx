"use client";

import * as React from "react";
import { AlertTriangle, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { TickerSelector } from "@/components/simulation/TickerSelector";
import { useTimelines } from "@/lib/api/hooks/useSimulation";
import { usePriceHistory } from "@/lib/api/hooks/useCompany";
import type { PriceHistoryItem, TimelineResponse } from "@/lib/api/types";
import { ChartSurface } from "@/lib/charts/core/ChartSurface";
import { drawGrid } from "@/lib/charts/core/Grid";
import { drawPriceAxis, drawTimeAxis } from "@/lib/charts/core/Axis";
import { drawLineSeries, lineYDomain } from "@/lib/charts/series/LineSeries";
import { formatPriceAxis } from "@/lib/charts/core/utils";
import type { LinePoint } from "@/lib/charts/types";
import { StructuralDiffTable } from "./StructuralDiffTable";
import { exportComparisonCsv } from "@/lib/charts/export/exportCsv";
import { exportCanvasPng } from "@/lib/charts/export/exportPng";
import { findDivergenceIndex } from "@/lib/charts/comparison/divergence";
import { relativeDayAxisLabels } from "@/lib/charts/comparison/axisLabels";
import { nearestIndexForX } from "@/lib/charts/comparison/hoverLookup";

type Metric = "price";

const METRIC_LABELS: Record<Metric, string> = {
  price: "Price",
};

// Sequential color scale so a comparison visually reads as a fan when many
// timelines are selected — cycling through a fixed palette rather than
// generating arbitrary colors keeps the legend legible.
const SERIES_COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#84cc16"];

const PADDING = { top: 16, right: 56, bottom: 24, left: 8 };
const DIVERGENCE_THRESHOLD_PCT = 3;

interface SeriesEntry {
  timeline: TimelineResponse;
  color: string;
  points: LinePoint[];
  dates: string[];
  // A branch that hasn't finished fast-forwarding (or failed) may still have
  // SOME PriceHistory rows (e.g. up to its branch point, inherited context)
  // even though it isn't "ready" -- rendering that partial/stale series with
  // no indication looks identical to a fully fast-forwarded branch, which
  // is misleading when comparing outcomes. Chip + tooltip surface this
  // instead of silently plotting it as if it were complete.
  isIncomplete: boolean;
}

export function TimelineComparisonView() {
  const { data: timelines } = useTimelines();
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [ticker, setTicker] = React.useState("");
  const [metric] = React.useState<Metric>("price");
  const [hoverX, setHoverX] = React.useState<number | null>(null);
  const canvasContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const live = timelines?.find((t) => t.is_live);
    if (live && selectedIds.length === 0) setSelectedIds([live.id]);
  }, [timelines, selectedIds.length]);

  const availableToAdd = timelines?.filter((t) => !selectedIds.includes(t.id)) ?? [];

  function addTimeline(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function removeTimeline(id: number) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  // Rules of Hooks forbids calling hooks inside a loop/callback (even one
  // with a statically-fixed iteration count) — so up to 8 timelines' history
  // (matching the fixed color palette) are fetched via 8 explicit,
  // unconditional useQuery calls, each independently cached/staled by
  // (ticker, timelineId). selectedIds[i] is undefined past the selection
  // length -- each slot passes { enabled: selectedIds[i] !== undefined } so
  // an unfilled slot never fires a request at all, instead of falling back
  // to the backend's default timeline (every empty slot would otherwise
  // collide on the same queryKey/response and waste a request rendering
  // data for a timeline the user never selected).
  const history0 = usePriceHistory(ticker, selectedIds[0], undefined, undefined, { enabled: selectedIds[0] !== undefined });
  const history1 = usePriceHistory(ticker, selectedIds[1], undefined, undefined, { enabled: selectedIds[1] !== undefined });
  const history2 = usePriceHistory(ticker, selectedIds[2], undefined, undefined, { enabled: selectedIds[2] !== undefined });
  const history3 = usePriceHistory(ticker, selectedIds[3], undefined, undefined, { enabled: selectedIds[3] !== undefined });
  const history4 = usePriceHistory(ticker, selectedIds[4], undefined, undefined, { enabled: selectedIds[4] !== undefined });
  const history5 = usePriceHistory(ticker, selectedIds[5], undefined, undefined, { enabled: selectedIds[5] !== undefined });
  const history6 = usePriceHistory(ticker, selectedIds[6], undefined, undefined, { enabled: selectedIds[6] !== undefined });
  const history7 = usePriceHistory(ticker, selectedIds[7], undefined, undefined, { enabled: selectedIds[7] !== undefined });
  const histories = [history0, history1, history2, history3, history4, history5, history6, history7];

  const series: SeriesEntry[] = selectedIds
    .map((id, i) => {
      const timeline = timelines?.find((t) => t.id === id);
      const data = histories[i]?.data;
      if (!timeline || !data) return null;
      return {
        timeline,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        points: data.map((item: PriceHistoryItem, idx: number) => ({ time: idx, value: Number(item.close) })),
        dates: data.map((item: PriceHistoryItem) => item.sim_date),
        isIncomplete: !timeline.is_live && timeline.status !== "ready",
      };
    })
    .filter((s): s is SeriesEntry => s !== null);

  const divergenceIndex = findDivergenceIndex(series, DIVERGENCE_THRESHOLD_PCT);

  const allPoints = series.flatMap((s) => s.points);
  const yDomain = lineYDomain(allPoints);
  const maxLen = Math.max(0, ...series.map((s) => s.points.length));

  function handleExportCsv() {
    exportComparisonCsv(series.map((s) => ({ label: s.timeline.name, dates: s.dates, values: s.points.map((p) => p.value) })));
  }

  function handleExportPng() {
    const canvas = canvasContainerRef.current?.querySelector("canvas");
    if (canvas) exportCanvasPng(canvas, "timeline-comparison.png");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <TickerSelector value={ticker} onChange={setTicker} />

        <Select onValueChange={(v) => addTimeline(Number(v))} disabled={availableToAdd.length === 0}>
          <SelectTrigger className="w-[220px]">
            <SelectValue
              placeholder={
                availableToAdd.length === 0 ? "No other timelines yet — create a branch first" : "Add timeline to compare"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} {t.is_live && "(live)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={metric} disabled>
          <SelectTrigger className="w-[140px]" title="More metrics (IV gap, sector index, volatility) coming soon">
            <SelectValue>{METRIC_LABELS[metric]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price">Price</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={series.length === 0}>
          <Download size={14} />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPng} disabled={series.length === 0}>
          <Download size={14} />
          PNG
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {series.map((s) => (
          <div
            key={s.timeline.id}
            className="flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-micro"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-text-primary">{s.timeline.name}</span>
            {s.isIncomplete && (
              <span
                className="flex items-center gap-1 text-warning"
                title={`This branch is ${s.timeline.status}, not ready — the plotted series may be partial or stale, not its final fast-forwarded result.`}
              >
                <AlertTriangle size={11} />
                <span>{s.timeline.status}</span>
              </span>
            )}
            <button type="button" onClick={() => removeTimeline(s.timeline.id)} className="text-text-tertiary hover:text-negative">
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {!ticker ? (
        <EmptyState title="Pick a ticker to compare" description="Search for a company above to overlay its price across timelines." />
      ) : series.length === 0 ? (
        <EmptyState title="No data yet" description="Select at least one timeline with price history for this ticker." />
      ) : (
        <div ref={canvasContainerRef} className="card-flat">
          <ChartSurface
            height={360}
            padding={PADDING}
            onPointerMove={(x) => setHoverX(x)}
            onPointerLeave={() => setHoverX(null)}
          >
            {({ ctx, width, height, dpr }) => {
              drawGrid({ ctx, width, height, dpr, padding: PADDING });

              for (const s of series) {
                drawLineSeries({
                  ctx,
                  data: s.points,
                  width,
                  height,
                  padding: PADDING,
                  yDomain,
                  color: s.color,
                  lineWidth: 1.5,
                });
              }

              if (divergenceIndex !== null && maxLen > 0) {
                const plotW = width - PADDING.left - PADDING.right;
                const x = PADDING.left + (divergenceIndex / (maxLen - 1 || 1)) * plotW;
                ctx.save();
                ctx.strokeStyle = "#ef4444";
                ctx.setLineDash([4, 3]);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, PADDING.top);
                ctx.lineTo(x, height - PADDING.bottom);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = "#ef4444";
                ctx.font = "10px 'JetBrains Mono', monospace";
                ctx.textAlign = "left";
                ctx.fillText("diverges", x + 4, PADDING.top + 10);
                ctx.restore();
              }

              drawPriceAxis({ ctx, width, height, padding: PADDING, yDomain, formatY: formatPriceAxis });
              // Every series is plotted by shared array index, not calendar date
              // (a branch's index 0 is its own branch point, not the parent's) --
              // see relativeDayAxisLabels for why "Day N" is the only label
              // that's simultaneously true for every series on this axis.
              const plotW = width - PADDING.left - PADDING.right;
              const labelStep = Math.max(1, Math.floor(maxLen / 6));
              const timeLabels = relativeDayAxisLabels(maxLen, labelStep).map((l) => ({
                x: PADDING.left + (l.x / (maxLen - 1 || 1)) * plotW,
                text: l.text,
              }));
              if (timeLabels.length > 0) drawTimeAxis({ ctx, width, height, padding: PADDING, labels: timeLabels });

              if (hoverX !== null && maxLen > 0) {
                const idx = nearestIndexForX(hoverX - PADDING.left, plotW, maxLen);
                const hoverPxX = PADDING.left + (idx / (maxLen - 1 || 1)) * plotW;

                ctx.save();
                ctx.strokeStyle = "rgba(255,255,255,0.3)";
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(hoverPxX, PADDING.top);
                ctx.lineTo(hoverPxX, height - PADDING.bottom);
                ctx.stroke();
                ctx.setLineDash([]);

                const rows = series
                  .filter((s) => idx < s.points.length)
                  .map((s) => ({ label: s.timeline.name, color: s.color, date: s.dates[idx], value: s.points[idx].value }));

                if (rows.length > 0) {
                  const boxWidth = 150;
                  const boxHeight = rows.length * 16 + 22;
                  const boxX = Math.min(hoverPxX + 8, width - boxWidth - 4);
                  const boxY = PADDING.top + 4;

                  ctx.fillStyle = "rgba(15,17,23,0.92)";
                  ctx.beginPath();
                  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
                  ctx.fill();

                  ctx.fillStyle = "rgba(255,255,255,0.6)";
                  ctx.font = "9px 'JetBrains Mono', monospace";
                  ctx.textAlign = "left";
                  ctx.fillText(`Day ${idx}${rows[0]?.date ? ` · ${rows[0].date}` : ""}`, boxX + 8, boxY + 12);

                  rows.forEach((row, i) => {
                    const y = boxY + 26 + i * 16;
                    ctx.fillStyle = row.color;
                    ctx.beginPath();
                    ctx.arc(boxX + 11, y - 3, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = "rgba(255,255,255,0.9)";
                    ctx.font = "9px 'JetBrains Mono', monospace";
                    ctx.textAlign = "left";
                    ctx.fillText(row.label, boxX + 20, boxY + 26 + i * 16);
                    ctx.textAlign = "right";
                    ctx.fillText(formatPriceAxis(row.value), boxX + boxWidth - 8, boxY + 26 + i * 16);
                  });
                }
                ctx.restore();
              }
            }}
          </ChartSurface>
        </div>
      )}

      {series.length >= 2 && (
        <StructuralDiffTable leftTimelineId={series[0].timeline.id} rightTimelineId={series[1].timeline.id} />
      )}
    </div>
  );
}
