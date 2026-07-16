"use client";

import * as React from "react";
import { PriceChart } from "@/components/charts/PriceChart";
import { TickerTape } from "@/components/simulation/TickerTape";
import { TickerSelector } from "@/components/simulation/TickerSelector";
import { SimControlPanel } from "@/components/simulation/SimControlPanel";
import { usePriceHistory } from "@/lib/api/hooks/useCompany";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { formatPrice, formatPct, formatLarge } from "@/lib/utils";
import type { PriceHistoryItem } from "@/lib/api/types";

const TIME_RANGES = [
  { label: "1D", days: 1 },
  { label: "5D", days: 5 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "YTD", days: null },
  { label: "1Y", days: 365 },
  { label: "ALL", days: null },
] as const;

interface MiniSparklineProps {
  data: PriceHistoryItem[];
  width?: number;
  height?: number;
  positive?: boolean;
}

function MiniSparkline({ data, width = 60, height = 20, positive }: MiniSparklineProps) {
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

    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const color = positive ? "var(--positive)" : "var(--negative)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.beginPath();

    closes.forEach((v, i) => {
      const x = (i / (closes.length - 1)) * width;
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

export function SimulationTradingView() {
  const { data: simState } = useSimState();
  const { data: grid } = useMarketGrid(simState?.timeline_id);
  const [selectedTicker, setSelectedTicker] = React.useState<string | null>(null);
  const [timeRangeIdx, setTimeRangeIdx] = React.useState(7); // default ALL
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = React.useState(500);

  const timelineId = simState?.timeline_id;

  // Auto-select first company from grid if none selected
  React.useEffect(() => {
    if (!selectedTicker && grid?.companies && grid.companies.length > 0) {
      const sorted = [...grid.companies].sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
      setSelectedTicker(sorted[0].ticker);
    }
  }, [grid?.companies, selectedTicker]);

  const currentCompany = React.useMemo(
    () => grid?.companies.find((c) => c.ticker === selectedTicker) ?? null,
    [grid?.companies, selectedTicker]
  );

  const { data: priceHistory, isLoading, isError, refetch } = usePriceHistory(
    selectedTicker ?? "",
    timelineId
  );

  // Filter price data by time range
  const filteredData = React.useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) return [];
    const range = TIME_RANGES[timeRangeIdx];
    if (range.days === null) return priceHistory; // ALL or YTD

    const lastDate = new Date(priceHistory[priceHistory.length - 1].sim_date);
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - range.days);

    return priceHistory.filter((p) => new Date(p.sim_date) >= cutoff);
  }, [priceHistory, timeRangeIdx]);

  // Top movers from market grid
  const topMovers = React.useMemo(() => {
    if (!grid?.companies) return [];
    return [...grid.companies]
      .sort((a, b) => Math.abs(b.day_change_pct ?? 0) - Math.abs(a.day_change_pct ?? 0))
      .slice(0, 10);
  }, [grid?.companies]);

  // Recent OHLC for header
  const latestPrice = priceHistory && priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
  const prevClose = priceHistory && priceHistory.length > 1 ? priceHistory[priceHistory.length - 2].close : null;
  const dayChange = latestPrice && prevClose ? ((latestPrice.close - prevClose) / prevClose) * 100 : currentCompany?.day_change_pct ?? 0;
  const isPositive = dayChange >= 0;

  // Measure chart container height
  React.useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) setChartHeight(h);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 100px)",
        background: "var(--mer-bg-canvas)",
        borderRadius: "var(--mer-radius-md)",
        border: "1px solid var(--mer-stroke-hairline)",
        overflow: "hidden",
      }}
    >
      {/* Ticker Tape */}
      <TickerTape
        onSelectTicker={setSelectedTicker}
        selectedTicker={selectedTicker ?? undefined}
      />

      {/* Company Info Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 20px",
          borderBottom: "1px solid var(--mer-stroke-hairline)",
          background: "var(--mer-surface-1)",
        }}
      >
        <TickerSelector
          value={selectedTicker ?? ""}
          onChange={setSelectedTicker}
        />

        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontSize: "var(--fs-h3)",
              fontWeight: 700,
              color: "var(--mer-ink-primary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {selectedTicker}
          </span>
          {currentCompany && (
            <span
              style={{
                fontSize: "var(--fs-body)",
                color: "var(--mer-ink-tertiary)",
              }}
            >
              {currentCompany.name}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginLeft: "auto" }}>
          <span
            className="num"
            style={{
              fontSize: "var(--fs-h2)",
              fontWeight: 700,
              color: "var(--mer-ink-primary)",
            }}
          >
            {formatPrice(currentCompany?.current_price ?? latestPrice?.close ?? null)}
          </span>
          <span
            className="num"
            style={{
              fontSize: "var(--fs-body)",
              fontWeight: 500,
              color: isPositive ? "var(--positive)" : "var(--negative)",
            }}
          >
            {isPositive ? "+" : ""}
            {dayChange.toFixed(2)}%
          </span>
        </div>

        {latestPrice && (
          <MiniSparkline
            data={priceHistory ?? []}
            positive={isPositive}
            width={70}
            height={24}
          />
        )}
      </div>

      {/* Main Content */}
      <div
        style={{
          display: "flex",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Chart Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            padding: "12px 16px",
          }}
        >
          {/* OHLC Overlay */}
          {latestPrice && (
            <div
              style={{
                position: "relative",
                zIndex: 10,
                marginBottom: -28,
                marginLeft: 8,
                display: "flex",
                gap: 12,
                pointerEvents: "none",
              }}
            >
              <OhlcBadge label="O" value={latestPrice.open} />
              <OhlcBadge label="H" value={latestPrice.high} />
              <OhlcBadge label="L" value={latestPrice.low} />
              <OhlcBadge label="C" value={latestPrice.close} />
            </div>
          )}

          {/* Chart */}
          <div
            ref={chartContainerRef}
            style={{
              flex: 1,
              background: "var(--mer-surface-1)",
              border: "1px solid var(--mer-stroke-hairline)",
              borderRadius: "var(--mer-radius-md)",
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            <PriceChart
              data={filteredData}
              loading={isLoading}
              error={isError}
              onRetry={() => refetch()}
              ticker={selectedTicker ?? ""}
              height={chartHeight}
            />
          </div>

          {/* Time Range Selector */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 8,
              justifyContent: "center",
            }}
          >
            {TIME_RANGES.map((range, i) => (
              <button
                key={range.label}
                onClick={() => setTimeRangeIdx(i)}
                style={{
                  padding: "4px 10px",
                  fontSize: "var(--fs-micro)",
                  fontWeight: i === timeRangeIdx ? 600 : 400,
                  color:
                    i === timeRangeIdx
                      ? "var(--mer-ink-primary)"
                      : "var(--mer-ink-tertiary)",
                  background:
                    i === timeRangeIdx ? "var(--mer-surface-3)" : "transparent",
                  border: "1px solid",
                  borderColor:
                    i === timeRangeIdx
                      ? "var(--mer-stroke-emphasis)"
                      : "transparent",
                  borderRadius: "var(--mer-radius-xs)",
                  cursor: "pointer",
                  transition: "all 100ms",
                }}
                onMouseEnter={(e) => {
                  if (i !== timeRangeIdx) {
                    e.currentTarget.style.color = "var(--mer-ink-secondary)";
                    e.currentTarget.style.background = "var(--mer-surface-2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (i !== timeRangeIdx) {
                    e.currentTarget.style.color = "var(--mer-ink-tertiary)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid var(--mer-stroke-hairline)",
          }}
        >
          <SimControlPanel />
        </div>
      </div>

      {/* Bottom Watchlist / Top Movers */}
      <div
        style={{
          background: "var(--mer-surface-1)",
          borderTop: "1px solid var(--mer-stroke-hairline)",
          padding: "6px 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 16px",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: "var(--fs-micro)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--mer-ink-tertiary)",
            }}
          >
            Top Movers
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "0 16px 4px",
          }}
          className="scrollbar-none"
        >
          {topMovers.map((c) => {
            const change = c.day_change_pct ?? 0;
            const pos = change >= 0;
            return (
              <button
                key={c.ticker}
                onClick={() => setSelectedTicker(c.ticker)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background:
                    c.ticker === selectedTicker
                      ? "var(--mer-surface-3)"
                      : "var(--mer-surface-2)",
                  border: "1px solid",
                  borderColor:
                    c.ticker === selectedTicker
                      ? "var(--mer-stroke-emphasis)"
                      : "var(--mer-stroke-hairline)",
                  borderRadius: "var(--mer-radius-sm)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 100ms",
                }}
                onMouseEnter={(e) => {
                  if (c.ticker !== selectedTicker)
                    e.currentTarget.style.borderColor = "var(--mer-stroke-emphasis)";
                }}
                onMouseLeave={(e) => {
                  if (c.ticker !== selectedTicker)
                    e.currentTarget.style.borderColor = "var(--mer-stroke-hairline)";
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--fs-small)",
                    fontWeight: 700,
                    color: "var(--mer-ink-primary)",
                  }}
                >
                  {c.ticker}
                </span>
                <span
                  className="num"
                  style={{
                    fontSize: "var(--fs-small)",
                    color: "var(--mer-ink-secondary)",
                  }}
                >
                  {formatPrice(c.current_price)}
                </span>
                <span
                  className="num"
                  style={{
                    fontSize: "var(--fs-micro)",
                    fontWeight: 600,
                    color: pos ? "var(--positive)" : "var(--negative)",
                  }}
                >
                  {formatPct(c.day_change_pct)}
                </span>
                {c.market_cap != null && (
                  <span
                    className="num"
                    style={{
                      fontSize: "var(--fs-micro)",
                      color: "var(--mer-ink-tertiary)",
                    }}
                  >
                    {formatLarge(c.market_cap)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OhlcBadge({ label, value }: { label: string; value: number | string | null | undefined }) {
  const numericValue = Number(value);

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span
        style={{
          fontSize: "var(--fs-micro)",
          color: "var(--mer-ink-tertiary)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className="num"
        style={{
          fontSize: "var(--fs-small)",
          color: "var(--mer-ink-secondary)",
          fontWeight: 500,
        }}
      >
        {Number.isFinite(numericValue) ? numericValue.toFixed(2) : "--"}
      </span>
    </div>
  );
}
