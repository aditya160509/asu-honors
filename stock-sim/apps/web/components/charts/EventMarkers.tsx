"use client";

import * as React from "react";

export type EventMarkerType = "earnings" | "dividend" | "news" | "economic";
export type EventSentiment = "positive" | "negative" | "neutral";

export interface EventMarker {
  time: number;
  type: EventMarkerType;
  label: string;
  sentiment?: EventSentiment;
  detail?: string;
}

interface RenderEventMarkersArgs {
  ctx: CanvasRenderingContext2D;
  events: EventMarker[];
  range: { from: number; to: number };
  xScaleFn: (i: number) => number;
  chartTop: number;
  chartHeight: number;
  candleWidth: number;
  dpr: number;
}

const MARKER_COLORS: Record<EventMarkerType, string> = {
  earnings: "#f59e0b",
  dividend: "#22c55e",
  news: "#3b82f6",
  economic: "#a855f7",
};

const MARKER_SIZE = 5;

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawEarningsMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = MARKER_COLORS.earnings;
  drawStar(ctx, x, y, MARKER_SIZE, MARKER_SIZE * 0.4, 5);
  ctx.fill();
  ctx.restore();
}

function drawDividendMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = MARKER_COLORS.dividend;
  ctx.beginPath();
  ctx.arc(x, y, MARKER_SIZE * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNewsMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = MARKER_COLORS.news;
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-MARKER_SIZE * 0.5, -MARKER_SIZE * 0.5, MARKER_SIZE, MARKER_SIZE);
  ctx.restore();
}

function drawEconomicMarker(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = MARKER_COLORS.economic;
  ctx.beginPath();
  ctx.moveTo(x, y - MARKER_SIZE);
  ctx.lineTo(x + MARKER_SIZE, y + MARKER_SIZE * 0.6);
  ctx.lineTo(x - MARKER_SIZE, y + MARKER_SIZE * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

const DRAW_FNS: Record<EventMarkerType, (ctx: CanvasRenderingContext2D, x: number, y: number) => void> = {
  earnings: drawEarningsMarker,
  dividend: drawDividendMarker,
  news: drawNewsMarker,
  economic: drawEconomicMarker,
};

export function renderEventMarkers({
  ctx,
  events,
  range,
  xScaleFn,
  chartTop,
  chartHeight,
  candleWidth,
  dpr,
}: RenderEventMarkersArgs) {
  if (events.length === 0) return;

  const markerY = chartTop + 14;

  ctx.save();

  for (const event of events) {
    if (event.time < range.from || event.time >= range.to) continue;

    const x = xScaleFn(event.time);
    const drawFn = DRAW_FNS[event.type];
    if (!drawFn) continue;

    drawFn(ctx, x, markerY);

    ctx.strokeStyle = MARKER_COLORS[event.type];
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(x, markerY + MARKER_SIZE + 2);
    ctx.lineTo(x, chartTop + chartHeight);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function hitTestEvent(
  mouseX: number,
  mouseY: number,
  events: EventMarker[],
  range: { from: number; to: number },
  xScaleFn: (i: number) => number,
  chartTop: number
): EventMarker | null {
  const markerY = chartTop + 14;
  const hitRadius = MARKER_SIZE + 4;

  for (const event of events) {
    if (event.time < range.from || event.time >= range.to) continue;
    const x = xScaleFn(event.time);
    const dx = mouseX - x;
    const dy = mouseY - markerY;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return event;
  }

  return null;
}

interface EventMarkerTooltipProps {
  event: EventMarker;
  x: number;
  y: number;
}

const TYPE_LABELS: Record<EventMarkerType, string> = {
  earnings: "Earnings",
  dividend: "Dividend",
  news: "News",
  economic: "Economic",
};

const SENTIMENT_LABELS: Record<EventSentiment, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

export function EventMarkerTooltip({ event, x, y }: EventMarkerTooltipProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: x + 12,
        top: y - 8,
        zIndex: 50,
        pointerEvents: "none",
        background: "var(--mer-surface-3)",
        border: "1px solid var(--mer-stroke-emphasis)",
        borderRadius: "var(--mer-radius-sm)",
        padding: "8px 10px",
        maxWidth: 220,
        boxShadow: "var(--mer-shadow-overlay)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: event.type === "dividend" ? "50%" : event.type === "earnings" ? 0 : 2,
            background: MARKER_COLORS[event.type],
            transform: event.type === "news" ? "rotate(45deg)" : undefined,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "var(--fs-micro)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--mer-ink-tertiary)",
          }}
        >
          {TYPE_LABELS[event.type]}
        </span>
      </div>
      <div
        style={{
          fontSize: "var(--fs-small)",
          fontWeight: 500,
          color: "var(--mer-ink-primary)",
          lineHeight: 1.3,
          marginBottom: 2,
        }}
      >
        {event.label}
      </div>
      {event.sentiment && (
        <div
          style={{
            fontSize: "var(--fs-micro)",
            color: event.sentiment === "positive" ? "var(--positive)" : event.sentiment === "negative" ? "var(--negative)" : "var(--mer-ink-tertiary)",
          }}
        >
          {SENTIMENT_LABELS[event.sentiment]}
        </div>
      )}
      {event.detail && (
        <div
          style={{
            fontSize: "var(--fs-micro)",
            color: "var(--mer-ink-secondary)",
            marginTop: 4,
            lineHeight: 1.3,
          }}
        >
          {event.detail}
        </div>
      )}
    </div>
  );
}
