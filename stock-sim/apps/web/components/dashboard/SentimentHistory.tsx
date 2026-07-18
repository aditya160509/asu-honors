"use client";

import * as React from "react";

interface SentimentHistoryProps {
  history: number[];
  width?: number;
  height?: number;
}

function getColor(current: number): string {
  if (current <= 25) return "#ef4444";
  if (current <= 40) return "#f97316";
  if (current <= 60) return "#eab308";
  if (current <= 75) return "#84cc16";
  return "#22c55e";
}

export function SentimentHistory({ history, width = 240, height = 60 }: SentimentHistoryProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...history, 0);
    const max = Math.max(...history, 100);
    const range = max - min || 1;
    const padding = { top: 8, bottom: 8, left: 0, right: 0 };
    const plotH = height - padding.top - padding.bottom;
    const current = history[history.length - 1];
    const color = getColor(current);

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    for (let i = 0; i < history.length; i++) {
      const x = padding.left + (i / (history.length - 1)) * (width - padding.left - padding.right);
      const y = padding.top + plotH * (1 - (history[i] - min) / range);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const lastX = width - padding.right;
    const lastY = padding.top + plotH * (1 - (current - min) / range);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const minY = padding.top + plotH * (1 - (min - min) / range);
    const maxY = padding.top + plotH * (1 - (max - min) / range);

    ctx.font = `500 ${9}px var(--font-mono)`;
    ctx.textAlign = "left";
    ctx.fillStyle = "var(--mer-ink-tertiary)";
    ctx.fillText(Math.round(max).toString(), 0, minY - 2);
    ctx.fillText(Math.round(min).toString(), 0, maxY + 10);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.fillText(Math.round(current).toString(), lastX - 6, lastY - 6);
  }, [history, width, height]);

  if (history.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "var(--fs-micro)",
          color: "var(--mer-ink-tertiary)",
        }}
      >
        No history
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
    />
  );
}
