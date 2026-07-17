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
import type { IndicatorKey } from "@/components/charts/PriceChart";

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

const INDICATOR_OPTIONS: { key: IndicatorKey; label: string }[] = [
  { key: "sma20", label: "SMA 20" },
  { key: "sma50", label: "SMA 50" },
  { key: "ema12", label: "EMA 12" },
];

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function TerminalButton({
  active,
  children,
  onClick,
  title,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        height: 28,
        padding: "0 10px",
        border: "1px solid",
        borderColor: active ? "var(--mer-stroke-accent)" : "var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-sm)",
        background: active ? "rgba(62, 111, 224, 0.16)" : "var(--mer-surface-2)",
        color: active ? "var(--mer-accent-300)" : "var(--mer-ink-secondary)",
        fontSize: "var(--fs-micro)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

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
  const [indicators, setIndicators] = React.useState<IndicatorKey[]>(["sma20"]);
  const [showVolumeProfile, setShowVolumeProfile] = React.useState(true);
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
  const prevClose = priceHistory && priceHistory.length > 1 ? toNumber(priceHistory[priceHistory.length - 2].close) : null;
  const latestClose = latestPrice ? toNumber(latestPrice.close) : null;
  const dayChange = latestClose != null && prevClose
    ? ((latestClose - prevClose) / prevClose) * 100
    : toNumber(currentCompany?.day_change_pct);
  const lastVolume = latestPrice ? toNumber(latestPrice.volume) : null;
  const isPositive = dayChange >= 0;

  const currentRange = TIME_RANGES[timeRangeIdx];

  function toggleIndicator(key: IndicatorKey) {
    setIndicators((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

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
        background: "linear-gradient(180deg, var(--mer-bg-canvas) 0%, #07090d 100%)",
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
          padding: "12px 16px",
          borderBottom: "1px solid var(--mer-stroke-hairline)",
          background: "linear-gradient(180deg, var(--mer-surface-2) 0%, var(--mer-surface-1) 100%)",
        }}
      >
        <TickerSelector
          value={selectedTicker ?? ""}
          onChange={setSelectedTicker}
        />

        <div style={{ display: "flex", minWidth: 0, flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: "var(--fs-h2)",
              fontWeight: 700,
              color: "var(--mer-ink-primary)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
          >
            {selectedTicker ?? "SELECT"}
          </span>
          {currentCompany && (
            <span
              style={{
                maxWidth: 280,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "var(--fs-small)",
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
            {formatPrice(currentCompany?.current_price ?? latestClose ?? null)}
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(70px, auto))", gap: 8 }}>
          <QuoteStat label="Range" value={currentRange.label} />
          <QuoteStat label="Volume" value={lastVolume == null ? "--" : formatLarge(lastVolume)} />
          <QuoteStat label="Mkt Cap" value={currentCompany?.market_cap == null ? "--" : formatLarge(currentCompany.market_cap)} />
        </div>
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
          {/* Chart Toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {TIME_RANGES.map((range, i) => (
                <TerminalButton key={range.label} active={i === timeRangeIdx} onClick={() => setTimeRangeIdx(i)}>
                  {range.label}
                </TerminalButton>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {INDICATOR_OPTIONS.map((indicator) => (
                <TerminalButton
                  key={indicator.key}
                  active={indicators.includes(indicator.key)}
                  onClick={() => toggleIndicator(indicator.key)}
                >
                  {indicator.label}
                </TerminalButton>
              ))}
              <TerminalButton active={showVolumeProfile} onClick={() => setShowVolumeProfile((value) => !value)}>
                VPVR
              </TerminalButton>
            </div>
          </div>

          {latestPrice && (
            <div
              style={{
                position: "relative",
                zIndex: 10,
                marginBottom: -34,
                marginLeft: 12,
                display: "flex",
                gap: 12,
                pointerEvents: "none",
                width: "fit-content",
                padding: "6px 8px",
                border: "1px solid var(--mer-stroke-hairline)",
                borderRadius: "var(--mer-radius-sm)",
                background: "rgba(10, 12, 16, 0.78)",
                backdropFilter: "blur(10px)",
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
              background: "radial-gradient(circle at 50% 0%, rgba(62,111,224,0.07), transparent 36%), var(--mer-surface-1)",
              border: "1px solid var(--mer-stroke-hairline)",
              borderRadius: "var(--mer-radius-md)",
              overflow: "hidden",
              minHeight: 0,
              boxShadow: "var(--mer-shadow-rest)",
            }}
          >
            <PriceChart
              data={filteredData}
              loading={isLoading}
              error={isError}
              onRetry={() => refetch()}
              ticker={selectedTicker ?? ""}
              height={chartHeight}
              indicators={indicators}
              showVolumeProfile={showVolumeProfile}
            />
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

function QuoteStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        minWidth: 70,
        padding: "5px 8px",
        border: "1px solid var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-sm)",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-micro)",
          color: "var(--mer-ink-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        className="num"
        style={{
          marginTop: 2,
          fontSize: "var(--fs-small)",
          fontWeight: 700,
          color: "var(--mer-ink-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
