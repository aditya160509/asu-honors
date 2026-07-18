"use client";

import * as React from "react";
import { PriceChart } from "@/components/charts/PriceChart";
import { IndicatorSubChart } from "@/components/charts/IndicatorSubChart";
import { TickerTape } from "@/components/simulation/TickerTape";
import { TickerSelector } from "@/components/simulation/TickerSelector";
import { ReplayControls } from "@/components/simulation/ReplayControls";
import { TimeRangeSelector } from "@/components/simulation/TimeRangeSelector";
import { SentimentGauge } from "@/components/dashboard/SentimentGauge";
import { SentimentHistory } from "@/components/dashboard/SentimentHistory";
import { FundamentalsPanel } from "@/components/dashboard/FundamentalsPanel";
import { DrawingToolbar } from "@/components/ui/DrawingToolbar";
import { IndicatorPicker } from "@/components/ui/IndicatorPicker";
import { ChartTypePicker } from "@/components/ui/ChartTypePicker";
import { DrawingManager } from "@/lib/charts/drawing/DrawingManager";
import { usePriceHistory, useFinancials, useCompany } from "@/lib/api/hooks/useCompany";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";
import { useNews } from "@/lib/api/hooks/useNews";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";
import { formatPrice, formatLarge } from "@/lib/utils";
import type { NewsItem, PriceHistoryItem } from "@/lib/api/types";
import type { IndicatorKey } from "@/components/charts/PriceChart";
import type { EventMarker } from "@/components/charts/EventMarkers";
import type { EventSentiment } from "@/components/charts/EventMarkers";
import type { ChartType } from "@/lib/charts/types";
import type { IndicatorType } from "@/lib/charts/indicators";
import type { DrawingToolType } from "@/lib/charts/drawing/types";
import type { VisibleRange } from "@/lib/charts/types";

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

const PRICE_OVERLAY_IDS = new Set<IndicatorType>(["sma20", "sma50", "ema12", "bollinger", "vwap", "ichimoku", "superTrend"]);
const PANE_INDICATOR_IDS = new Set<IndicatorType>([
  "rsi",
  "macd",
  "stochastic",
  "adx",
  "obv",
  "cci",
  "williamsR",
  "mfi",
  "roc",
  "cmf",
  "atr",
]);

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
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

    const closes = data.map((d) => Number(d.close));
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
  const [showVolumeProfile, setShowVolumeProfile] = React.useState(true);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = React.useState(500);
  const [chartRange, setChartRange] = React.useState<VisibleRange>({ from: 0, to: 0 });

  const timeRange = useTimeControlStore((s) => s.timeRange);
  const customRange = useTimeControlStore((s) => s.customRange);
  const replayMode = useTimeControlStore((s) => s.replayMode);
  const currentTick = useTimeControlStore((s) => s.currentTick);
  const setTotalTicks = useTimeControlStore((s) => s.setTotalTicks);
  const goToTick = useTimeControlStore((s) => s.goToTick);

  const timelineId = simState?.timeline_id;

  const { data: cycleData } = useCycleState(timelineId);
  const { data: financials } = useFinancials(selectedTicker ?? "");
  const { data: companyDetail } = useCompany(selectedTicker ?? "", timelineId);
  const { data: newsData } = useNews({ timelineId, limit: 50 });

  const [showFundamentals, setShowFundamentals] = React.useState(false);
  const [showSentiment, setShowSentiment] = React.useState(true);
  const [chartType, setChartType] = React.useState<ChartType>("candlestick");
  const [activeOverlays, setActiveOverlays] = React.useState<IndicatorType[]>(["sma20"]);
  const [drawingManager] = React.useState(() => new DrawingManager());
  const [activeDrawingTool, setActiveDrawingTool] = React.useState<DrawingToolType | null>(null);
  const sentimentHistoryRef = React.useRef<number[]>([]);

  function toggleOverlay(type: IndicatorType) {
    setActiveOverlays((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  React.useEffect(() => {
    return drawingManager.subscribe(() => {
      setActiveDrawingTool(drawingManager.activeTool);
    });
  }, [drawingManager]);

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

  React.useEffect(() => {
    if (priceHistory && priceHistory.length > 0) {
      const lastTick = priceHistory.length - 1;
      setTotalTicks(lastTick);
      if (!replayMode) {
        goToTick(lastTick);
      }
    }
  }, [goToTick, priceHistory, replayMode, setTotalTicks]);

  const filteredData = React.useMemo(() => {
    if (!priceHistory || priceHistory.length === 0) return [];

    let data = priceHistory;

    if (customRange) {
      const startMs = new Date(customRange.start).getTime();
      const endMs = new Date(customRange.end).getTime();
      data = data.filter((p) => {
        const t = new Date(p.sim_date).getTime();
        return t >= startMs && t <= endMs;
      });
    } else if (timeRange !== "ALL") {
      const range = TIME_RANGES.find((r) => r.label === timeRange);
      if (range && range.days !== null) {
        const lastDate = new Date(data[data.length - 1].sim_date);
        const cutoff = new Date(lastDate);
        cutoff.setDate(cutoff.getDate() - range.days);
        data = data.filter((p) => new Date(p.sim_date) >= cutoff);
      }
    }

    if (replayMode) {
      data = data.slice(0, currentTick + 1);
    }

    return data;
  }, [priceHistory, timeRange, customRange, replayMode, currentTick]);

  React.useEffect(() => {
    setChartRange({ from: 0, to: 0 });
  }, [customRange, filteredData.length, selectedTicker, timeRange]);

  // Recent OHLC for header
  const latestPrice = priceHistory && priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
  const prevClose = priceHistory && priceHistory.length > 1 ? toNumber(priceHistory[priceHistory.length - 2].close) : null;
  const latestClose = latestPrice ? toNumber(latestPrice.close) : null;
  const dayChange = latestClose != null && prevClose
    ? ((latestClose - prevClose) / prevClose) * 100
    : toNumber(currentCompany?.day_change_pct);
  const lastVolume = latestPrice ? toNumber(latestPrice.volume) : null;
  const isPositive = dayChange >= 0;

  const currentRange = TIME_RANGES.find((r) => r.label === timeRange) ?? TIME_RANGES[7];

  const eventMarkers = React.useMemo<EventMarker[]>(() => {
    if (!newsData || !priceHistory || priceHistory.length === 0) return [];
    const dateToIndex = new Map<string, number>();
    priceHistory.forEach((p, i) => dateToIndex.set(p.sim_date, i));

    const markers: EventMarker[] = [];
    for (const n of newsData) {
      if (n.company_name && n.company_name !== currentCompany?.name) continue;
      const idx = dateToIndex.get(n.sim_date);
      if (idx == null) continue;
      const s = n.sentiment;
      const sentiment: EventSentiment = s === "positive" || s === "negative" ? s : "neutral";
      markers.push({
        time: idx,
        type: "news",
        label: n.headline,
        sentiment,
        detail: n.company_name ?? undefined,
      });
      if (markers.length >= 30) break;
    }
    return markers;
  }, [newsData, priceHistory, currentCompany]);

  const sentimentDrivers = React.useMemo(() => {
    const companies = grid?.companies ?? [];
    const cycleScore = cycleData?.market_sentiment != null
      ? clampPercent((cycleData.market_sentiment + 1) * 50)
      : 50;

    const breadthScore = companies.length > 0
      ? clampPercent((companies.filter((company) => toNumber(company.day_change_pct) >= 0).length / companies.length) * 100)
      : 50;

    const avgChange = companies.length > 0
      ? companies.reduce((sum, company) => sum + toNumber(company.day_change_pct), 0) / companies.length
      : 0;
    const momentumScore = clampPercent(50 + avgChange * 12);

    const relevantNews = (newsData ?? []).filter((item) => !item.company_name || item.company_name === currentCompany?.name);
    const newsScore = relevantNews.length > 0
      ? clampPercent(
          50 +
            (relevantNews.reduce((sum, item) => {
              if (item.sentiment === "positive") return sum + 1;
              if (item.sentiment === "negative") return sum - 1;
              return sum;
            }, 0) /
              relevantNews.length) *
              35
        )
      : 50;

    return {
      cycle: cycleScore,
      breadth: breadthScore,
      momentum: momentumScore,
      news: newsScore,
      composite: clampPercent(cycleScore * 0.35 + breadthScore * 0.25 + momentumScore * 0.25 + newsScore * 0.15),
    };
  }, [cycleData?.market_sentiment, currentCompany?.name, grid?.companies, newsData]);

  const sentimentValue = sentimentDrivers.composite;

  React.useEffect(() => {
    sentimentHistoryRef.current.push(sentimentValue);
    if (sentimentHistoryRef.current.length > 50) {
      sentimentHistoryRef.current = sentimentHistoryRef.current.slice(-50);
    }
  }, [sentimentValue]);

  const prevSentimentRef = React.useRef(sentimentValue);
  const [prevSentiment, setPrevSentiment] = React.useState(sentimentValue);
  React.useEffect(() => {
    if (sentimentValue !== prevSentimentRef.current) {
      setPrevSentiment(prevSentimentRef.current);
      prevSentimentRef.current = sentimentValue;
    }
  }, [sentimentValue]);

  const priceIndicators = React.useMemo(
    () => activeOverlays.filter((type): type is IndicatorKey => PRICE_OVERLAY_IDS.has(type)),
    [activeOverlays]
  );
  const paneIndicators = React.useMemo(
    () => activeOverlays.filter((type) => PANE_INDICATOR_IDS.has(type)).slice(0, 3),
    [activeOverlays]
  );

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
        height: "calc(100vh - 96px)",
        background: "linear-gradient(180deg, #080b10 0%, #06080c 100%)",
        borderRadius: "var(--mer-radius-sm)",
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
          gap: 10,
          padding: "6px 12px",
          borderBottom: "1px solid var(--mer-stroke-hairline)",
          background: "linear-gradient(180deg, rgba(22,26,34,0.92) 0%, var(--mer-surface-1) 100%)",
        }}
      >
        <TickerSelector
          value={selectedTicker ?? ""}
          onChange={setSelectedTicker}
        />

        <div style={{ display: "flex", minWidth: 0, flexDirection: "column", gap: 2 }}>
          <span
            style={{
                fontSize: "var(--fs-body)",
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
                fontSize: "var(--fs-micro)",
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
              fontSize: "var(--fs-body)",
              fontWeight: 700,
              color: "var(--mer-ink-primary)",
            }}
          >
            {formatPrice(currentCompany?.current_price ?? latestClose ?? null)}
          </span>
          <span
            className="num"
            style={{
              fontSize: "var(--fs-small)",
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
            width={60}
            height={20}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(58px, auto))", gap: 5 }}>
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
        {/* Drawing Toolbar (left side) */}
        <div
          style={{
            width: 44,
            flexShrink: 0,
            borderRight: "1px solid var(--mer-stroke-hairline)",
            background: "var(--mer-surface-1)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <DrawingToolbar manager={drawingManager} />
        </div>

        {/* Chart Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            padding: "6px 8px",
            overflow: "hidden",
          }}
        >
          {/* Market Overview Bar */}
          {/* Chart Toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 5,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <TimeRangeSelector compact />
            </div>
            <div style={{ width: 1, height: 20, background: "var(--mer-stroke-hairline)", flexShrink: 0 }} />
            <ChartTypePicker value={chartType} onChange={setChartType} />
            <div style={{ width: 1, height: 20, background: "var(--mer-stroke-hairline)", flexShrink: 0 }} />
            <IndicatorPicker activeIndicators={activeOverlays} onToggle={toggleOverlay} />
            <TerminalButton active={showVolumeProfile} onClick={() => setShowVolumeProfile((v) => !v)}>VPVR</TerminalButton>
            <div style={{ flex: 1 }} />
            <TerminalButton active={showSentiment} onClick={() => setShowSentiment((v) => !v)}>Sentiment</TerminalButton>
            <TerminalButton active={showFundamentals} onClick={() => setShowFundamentals((v) => !v)}>Fundamentals</TerminalButton>
          </div>

          {latestPrice && (
            <div
              style={{
                position: "relative",
                zIndex: 10,
                marginBottom: -30,
                marginLeft: 10,
                display: "flex",
                gap: 12,
                pointerEvents: "none",
                width: "fit-content",
                padding: "4px 7px",
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
              background: "radial-gradient(circle at 50% 0%, rgba(51, 102, 204, 0.08), transparent 36%), #0b0f14",
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
              indicators={priceIndicators}
              showVolumeProfile={showVolumeProfile}
              events={eventMarkers}
              chartType={chartType}
              drawingManager={drawingManager}
              activeDrawingTool={activeDrawingTool}
              externalRange={chartRange.to > chartRange.from ? chartRange : undefined}
              onRangeChange={setChartRange}
            />
          </div>
          {paneIndicators.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${paneIndicators.length}, minmax(0, 1fr))`,
                gap: 6,
                marginTop: 6,
                flexShrink: 0,
              }}
            >
              {paneIndicators.map((type) => (
                <div
                  key={type}
                  style={{
                    overflow: "hidden",
                    border: "1px solid var(--mer-stroke-hairline)",
                    borderRadius: "var(--mer-radius-sm)",
                    background: "var(--mer-surface-1)",
                  }}
                >
                  <IndicatorSubChart
                    type={type}
                    data={filteredData}
                    height={96}
                    range={chartRange.to > chartRange.from ? chartRange : { from: Math.max(0, filteredData.length - 200), to: filteredData.length }}
                    onRangeChange={setChartRange}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fundamentals Panel (collapsible) */}
        {showFundamentals && (
          <div
            style={{
              width: 320,
              flexShrink: 0,
              borderLeft: "1px solid var(--mer-stroke-hairline)",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderBottom: "1px solid var(--mer-stroke-hairline)",
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
                Fundamentals
              </span>
              <button
                type="button"
                onClick={() => setShowFundamentals(false)}
                style={{
                  fontSize: "var(--fs-micro)",
                  color: "var(--mer-ink-tertiary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: "8px 12px", flex: 1 }}>
              <FundamentalsPanel
                financials={financials ?? null}
                company={companyDetail ?? null}
                loading={!financials && !!selectedTicker}
              />
            </div>
          </div>
        )}

          {/* Right Sidebar */}
          <aside
            style={{
              width: 246,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid var(--mer-stroke-hairline)",
              overflow: "auto",
            }}
          >
            {showSentiment && (
              <div
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--mer-stroke-hairline)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--fs-micro)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--mer-ink-tertiary)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Market Sentiment
                </span>
                <SentimentGauge value={sentimentValue} previousValue={prevSentiment} width={218} height={108} />
                <SentimentHistory history={sentimentHistoryRef.current} width={218} height={32} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 5,
                    marginTop: 8,
                  }}
                >
                  <SentimentDriver label="Cycle" value={sentimentDrivers.cycle} />
                  <SentimentDriver label="Breadth" value={sentimentDrivers.breadth} />
                  <SentimentDriver label="Momentum" value={sentimentDrivers.momentum} />
                  <SentimentDriver label="News" value={sentimentDrivers.news} />
                </div>
              </div>
            )}

            <NewsCompactPanel news={newsData ?? []} companyName={currentCompany?.name ?? null} />
          </aside>
      </div>

      {/* Replay Controls */}
      <ReplayControls />
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

function NewsCompactPanel({ news, companyName }: { news: NewsItem[]; companyName: string | null }) {
  const items = React.useMemo(
    () => news.filter((item) => !item.company_name || item.company_name === companyName).slice(0, 6),
    [companyName, news]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderTop: "1px solid var(--mer-stroke-hairline)",
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1px solid var(--mer-stroke-hairline)",
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--mer-ink-tertiary)",
        }}
      >
        News
      </div>
      <div style={{ overflow: "auto", minHeight: 0 }}>
        {items.length === 0 ? (
          <div style={{ padding: 10, fontSize: "var(--fs-small)", color: "var(--mer-ink-tertiary)" }}>
            No relevant news.
          </div>
        ) : (
          items.map((item) => {
            const tone = item.sentiment === "positive" ? "var(--positive)" : item.sentiment === "negative" ? "var(--negative)" : "var(--mer-ink-tertiary)";
            return (
              <div
                key={item.id}
                style={{
                  padding: "9px 10px",
                  borderBottom: "1px solid var(--mer-stroke-hairline)",
                  display: "grid",
                  gridTemplateColumns: "6px minmax(0, 1fr)",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    marginTop: 5,
                    borderRadius: "50%",
                    background: tone,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "var(--mer-ink-primary)",
                      fontSize: "var(--fs-small)",
                      lineHeight: 1.3,
                      fontWeight: 600,
                    }}
                  >
                    {item.headline}
                  </div>
                  <div
                    className="num"
                    style={{
                      marginTop: 4,
                      color: "var(--mer-ink-tertiary)",
                      fontSize: "var(--fs-micro)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {item.sim_date}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SentimentDriver({ label, value }: { label: string; value: number }) {
  const rounded = Math.round(value);
  const color = rounded >= 58 ? "var(--positive)" : rounded <= 42 ? "var(--negative)" : "var(--mer-ink-secondary)";

  return (
    <div
      style={{
        padding: "5px 6px",
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
          letterSpacing: "0.06em",
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
          color,
        }}
      >
        {rounded}
      </div>
    </div>
  );
}

function QuoteStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        minWidth: 58,
        padding: "3px 6px",
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
          fontSize: "var(--fs-micro)",
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
