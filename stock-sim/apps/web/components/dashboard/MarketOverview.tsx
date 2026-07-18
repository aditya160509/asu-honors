"use client";

import * as React from "react";
import type { CompanyGridItem } from "@/lib/api/types";
import { formatPrice, formatLarge } from "@/lib/utils";

interface MarketOverviewProps {
  companies: CompanyGridItem[];
  loading?: boolean;
}

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

function MiniSparkline({ data, width = 80, height = 24, positive }: MiniSparklineProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const color = positive ? "var(--positive)" : "var(--negative)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();

    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [data, width, height, positive]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block" }}
    />
  );
}

function StatBlock({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        padding: "0 12px",
        borderRight: "1px solid var(--mer-stroke-hairline)",
      }}
    >
      <span
        style={{
          fontSize: "var(--fs-micro)",
          color: "var(--mer-ink-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span
        className="num"
        style={{
          fontSize: "var(--fs-small)",
          fontWeight: 700,
          color: "var(--mer-ink-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </span>
      {sub && (
        <span
          className="num"
          style={{
            fontSize: "var(--fs-micro)",
            color: "var(--mer-ink-tertiary)",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

export function MarketOverview({ companies, loading }: MarketOverviewProps) {
  const stats = React.useMemo(() => {
    if (!companies || companies.length === 0) {
      return {
        index: 0,
        dayChange: 0,
        totalVolume: 0,
        count: 0,
        upCount: 0,
        downCount: 0,
        bullBearRatio: 0,
        sparklineData: [],
      };
    }

    let weightedSum = 0;
    let totalMcap = 0;
    let totalVolume = 0;
    let upCount = 0;
    let downCount = 0;

    for (const c of companies) {
      const price = c.current_price ?? 0;
      const mcap = c.market_cap ?? 0;
      weightedSum += price * mcap;
      totalMcap += mcap;
      totalVolume += c.avg_volume_20d ?? 0;
      if ((c.day_change_pct ?? 0) >= 0) upCount++;
      else downCount++;
    }

    const index = totalMcap > 0 ? weightedSum / totalMcap : 0;
    const avgChange = companies.reduce((sum, c) => sum + (c.day_change_pct ?? 0), 0) / companies.length;

    const sparklineData = companies
      .slice(0, 20)
      .map((c) => c.current_price)
      .filter((p): p is number => p != null);

    return {
      index,
      dayChange: avgChange,
      totalVolume,
      count: companies.length,
      upCount,
      downCount,
      bullBearRatio: companies.length > 0 ? (upCount / companies.length) * 100 : 50,
      sparklineData,
    };
  }, [companies]);

  if (loading) {
    return (
      <div
        style={{
          height: 48,
          borderRadius: "var(--mer-radius-sm)",
          background: "var(--mer-surface-2)",
        }}
        className="skeleton-shimmer"
      />
    );
  }

  const isPositive = stats.dayChange >= 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "8px 0",
        background: "var(--mer-surface-1)",
        border: "1px solid var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-md)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "0 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: "var(--fs-micro)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--mer-ink-tertiary)",
            whiteSpace: "nowrap",
          }}
        >
          MKT IDX
        </span>
        <span
          className="num"
          style={{
            fontSize: "var(--fs-body)",
            fontWeight: 700,
            color: "var(--mer-ink-primary)",
          }}
        >
          {formatPrice(stats.index)}
        </span>
        <span
          className="num"
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            color: isPositive ? "var(--positive)" : "var(--negative)",
          }}
        >
          {isPositive ? "+" : ""}
          {stats.dayChange.toFixed(2)}%
        </span>
      </div>

      {stats.sparklineData.length > 1 && (
        <div style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>
          <MiniSparkline data={stats.sparklineData} positive={isPositive} width={64} height={20} />
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center" }}>
        <StatBlock label="Volume" value={formatLarge(stats.totalVolume)} />
        <StatBlock label="Companies" value={stats.count} />
        <StatBlock
          label="Bull/Bear"
          value={`${stats.upCount}/${stats.downCount}`}
          sub={`${stats.bullBearRatio.toFixed(0)}% bull`}
        />
      </div>
    </div>
  );
}
