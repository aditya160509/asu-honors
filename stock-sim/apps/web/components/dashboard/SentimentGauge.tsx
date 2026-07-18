"use client";

import * as React from "react";

interface SentimentGaugeProps {
  value: number;
  previousValue?: number;
  width?: number;
  height?: number;
}

function getColor(value: number): string {
  if (value <= 25) return "#ef4444";
  if (value <= 40) return "#f97316";
  if (value <= 60) return "#eab308";
  if (value <= 75) return "#84cc16";
  return "#22c55e";
}

function getLabel(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawGauge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  value: number,
  dpr: number
) {
  const cx = width / 2;
  const cy = height * 0.78;
  const radius = Math.min(width * 0.42, height * 0.55);
  const lineWidth = radius * 0.18;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;

  ctx.clearRect(0, 0, width, height);

  const segments: [number, number, string][] = [
    [0, 0.25, "#ef4444"],
    [0.25, 0.40, "#f97316"],
    [0.40, 0.60, "#eab308"],
    [0.60, 0.75, "#84cc16"],
    [0.75, 1.0, "#22c55e"],
  ];

  for (const [segStart, segEnd, color] of segments) {
    const a1 = lerp(startAngle, endAngle, segStart);
    const a2 = lerp(startAngle, endAngle, segEnd);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, a1, a2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "butt";
    ctx.globalAlpha = 0.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const clampedValue = Math.max(0, Math.min(100, value));
  const valueAngle = lerp(startAngle, endAngle, clampedValue / 100);
  const valueColor = getColor(clampedValue);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, valueAngle);
  ctx.strokeStyle = valueColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  const needleLength = radius - lineWidth * 0.8;
  const needleX = cx + needleLength * Math.cos(valueAngle);
  const needleY = cy + needleLength * Math.sin(valueAngle);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(needleX, needleY);
  ctx.strokeStyle = valueColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = "var(--mer-ink-primary)";
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${radius * 0.42}px var(--font-mono)`;
  ctx.fillStyle = "var(--mer-ink-primary)";
  ctx.fillText(Math.round(clampedValue).toString(), cx, cy - radius * 0.18);

  ctx.font = `500 ${Math.max(10, radius * 0.14)}px var(--font-sans)`;
  ctx.fillStyle = valueColor;
  ctx.fillText(getLabel(clampedValue), cx, cy + radius * 0.12);
}

export function SentimentGauge({
  value,
  previousValue,
  width = 240,
  height = 140,
}: SentimentGaugeProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animatedValue = React.useRef(value);
  const rafRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const targetValue = value;
    const startValue = animatedValue.current;
    const startTime = performance.now();
    const duration = 400;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      animatedValue.current = lerp(startValue, targetValue, eased);

      const cvs = canvasRef.current;
      if (cvs) {
        const ctx = cvs.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          cvs.width = width * dpr;
          cvs.height = height * dpr;
          cvs.style.width = `${width}px`;
          cvs.style.height = `${height}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawGauge(ctx, width, height, animatedValue.current, dpr);
        }
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, width, height]);

  return (
    <div style={{ position: "relative", width, height }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: "block" }}
      />
      {previousValue != null && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: "var(--fs-micro)",
            color: "var(--mer-ink-tertiary)",
          }}
        >
          prev {Math.round(previousValue)}
        </div>
      )}
    </div>
  );
}
