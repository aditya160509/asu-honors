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
import { usePriceHistory, useFinancials, useCompany, useCompanyDividends } from "@/lib/api/hooks/useCompany";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";
import { useNews } from "@/lib/api/hooks/useNews";
import { useTimeControlStore } from "@/lib/stores/timeControlStore";
import { formatPrice, formatLarge } from "@/lib/utils";
import { SentimentTrackers, computeRawInputs, computeSentimentDrivers, bootstrapFromPriceHistory } from "@/lib/market/sentimentScore";
import type { SentimentDrivers } from "@/lib/market/sentimentScore";
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
  { label: "10D", days: 10 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "YTD", days: -1 },
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

function sameRange(a: VisibleRange, b: VisibleRange): boolean {
  return a.from === b.from && a.to === b.to;
}

function toNumber(value: number | string | null | undefined, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function TerminalBtn({
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
      onMouseDown={(e) => {
        const el = e.currentTarget;
        el.style.transform = "scale(0.95)";
        setTimeout(() => { el.style.transform = ""; }, 100);
      }}
      style={{
        height: 24,
        padding: "0 8px",
        border: "1px solid",
        borderColor: active ? "var(--mer-stroke-accent)" : "var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-xs)",
        background: active ? "rgba(62, 111, 224, 0.14)" : "transparent",
        color: active ? "var(--mer-accent-300)" : "var(--mer-ink-secondary)",
        fontSize: "var(--fs-micro)",
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        lineHeight: 1,
        transition: "background 180ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 80ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </button>
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
  const updateChartRange = React.useCallback((next: VisibleRange) => {
    setChartRange((current) => (sameRange(current, next) ? current : next));
  }, []);

  const timeRange = useTimeControlStore((s) => s.timeRange);
  const customRange = useTimeControlStore((s) => s.customRange);
  const replayMode = useTimeControlStore((s) => s.replayMode);
  const currentTick = useTimeControlStore((s) => s.currentTick);
  const setTotalTicks = useTimeControlStore((s) => s.setTotalTicks);
  const goToTick = useTimeControlStore((s) => s.goToTick);
  const pause = useTimeControlStore((s) => s.pause);
  const play = useTimeControlStore((s) => s.play);
  const setReplayMode = useTimeControlStore((s) => s.setReplayMode);

  const timelineId = simState?.timeline_id;

  const { data: cycleData } = useCycleState(timelineId);
  const { data: financials } = useFinancials(selectedTicker ?? "");
  const { data: companyDetail } = useCompany(selectedTicker ?? "", timelineId);
  const { data: companyDividends } = useCompanyDividends(selectedTicker ?? "", timelineId);
  const { data: newsData } = useNews({ timelineId, limit: 50 });

  const [showFundamentals, setShowFundamentals] = React.useState(false);
  const [showSentiment, setShowSentiment] = React.useState(true);
  const [chartType, setChartType] = React.useState<ChartType>("candlestick");
  const [activeOverlays, setActiveOverlays] = React.useState<IndicatorType[]>(["sma20"]);
  const [drawingManager] = React.useState(() => new DrawingManager());
  const [activeDrawingTool, setActiveDrawingTool] = React.useState<DrawingToolType | null>(null);
  const [replayPickMode, setReplayPickMode] = React.useState(false);
  const sentimentHistoryRef = React.useRef<number[]>([]);
  const sentimentTrackersRef = React.useRef<SentimentTrackers>(new SentimentTrackers());

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
      bootstrapFromPriceHistory(sentimentTrackersRef.current, priceHistory);
    }
    // Runs once per priceHistory load; TrailingZScore.seed() no-ops once a tracker
    // already has live-pushed samples, so this can't clobber real data on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceHistory]);

  React.useEffect(() => {
    if (priceHistory && priceHistory.length > 0) {
      const lastTick = priceHistory.length - 1;
      setTotalTicks(lastTick);
      if (!replayMode && currentTick !== lastTick) {
        goToTick(lastTick);
      }
    }
  }, [currentTick, goToTick, priceHistory, replayMode, setTotalTicks]);

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
      if (range) {
        if (range.days === -1) {
          // YTD — filter to current calendar year
          const lastDate = new Date(data[data.length - 1].sim_date);
          const yearStart = new Date(lastDate.getFullYear(), 0, 1);
          data = data.filter((p) => new Date(p.sim_date) >= yearStart);
        } else if (range.days !== null) {
          const lastDate = new Date(data[data.length - 1].sim_date);
          const cutoff = new Date(lastDate);
          cutoff.setDate(cutoff.getDate() - range.days);
          data = data.filter((p) => new Date(p.sim_date) >= cutoff);
        }
        // days === null → ALL, no filtering
      }
    }

    if (replayMode && currentTick < priceHistory.length) {
      data = data.slice(0, currentTick + 1);
    }

    return data;
  }, [priceHistory, timeRange, customRange, replayMode, currentTick]);

  React.useEffect(() => {
    updateChartRange({ from: 0, to: 0 });
  }, [customRange, filteredData.length, selectedTicker, timeRange, updateChartRange]);

  // Recent OHLC for header
  const latestPrice = priceHistory && priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
  const prevClose = priceHistory && priceHistory.length > 1 ? toNumber(priceHistory[priceHistory.length - 2].close) : null;
  const latestClose = latestPrice ? toNumber(latestPrice.close) : null;
  const dayChange = latestClose != null && prevClose
    ? ((latestClose - prevClose) / prevClose) * 100
    : toNumber(currentCompany?.day_change_pct);
  const lastVolume = latestPrice ? toNumber(latestPrice.volume) : null;
  const isPositive = dayChange >= 0;

  const currentRange = TIME_RANGES.find((r) => r.label === timeRange) ?? null;

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

  const lastSentimentTickRef = React.useRef<string | null>(null);
  const lastSentimentDriversRef = React.useRef<SentimentDrivers | null>(null);
  const sentimentDrivers = React.useMemo(() => {
    const companies = grid?.companies ?? [];
    const relevantNews = (newsData ?? []).filter((item) => !item.company_name || item.company_name === currentCompany?.name);
    const raw = computeRawInputs(companies, cycleData?.market_sentiment, relevantNews);

    // Each trailing z-score tracker assumes exactly one push per simulation tick;
    // pushing again for the same tick (e.g. when newsData resolves after grid) would
    // corrupt the trailing window with a duplicate sample.
    const tick = grid?.sim_date ?? null;
    if (tick !== null && tick === lastSentimentTickRef.current && lastSentimentDriversRef.current) {
      return lastSentimentDriversRef.current;
    }

    const drivers = computeSentimentDrivers(sentimentTrackersRef.current, raw);
    lastSentimentTickRef.current = tick;
    lastSentimentDriversRef.current = drivers;
    return drivers;
  }, [grid?.companies, grid?.sim_date, cycleData?.market_sentiment, currentCompany?.name, newsData]);

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

  const handleReplayPointSelect = React.useCallback(
    (_localIndex: number, item: PriceHistoryItem) => {
      if (!priceHistory || priceHistory.length === 0) return;
      const fullIndex = priceHistory.findIndex((point) => point.sim_date === item.sim_date);
      const tick = fullIndex >= 0 ? fullIndex : _localIndex;
      pause();
      setReplayMode(true);
      goToTick(tick);
      play();
      setReplayPickMode(false);
      updateChartRange({ from: 0, to: 0 });
    },
    [goToTick, pause, play, priceHistory, setReplayMode, updateChartRange]
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
        background: cycleData?.market_sentiment != null && cycleData.market_sentiment < 40
          ? "linear-gradient(180deg, #0b0808 0%, #06080c 100%)"
          : cycleData?.market_sentiment != null && cycleData.market_sentiment > 60
            ? "linear-gradient(180deg, #080b0e 0%, #06080c 100%)"
            : "linear-gradient(180deg, #080b10 0%, #06080c 100%)",
        borderRadius: "var(--mer-radius-sm)",
        border: "1px solid var(--mer-stroke-hairline)",
        overflow: "hidden",
        transition: "background 800ms cubic-bezier(0.16, 1, 0.3, 1)",
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
          gap: 6,
          padding: "4px 10px",
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
              fontSize: "var(--fs-header)",
              fontWeight: 700,
              color: "var(--mer-ink-primary)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0em",
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          {latestPrice && (
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginRight: 6, paddingRight: 6, borderRight: "1px solid var(--mer-stroke-hairline)" }}>
              <OhlcBadge label="O" value={latestPrice.open} />
              <OhlcBadge label="H" value={latestPrice.high} />
              <OhlcBadge label="L" value={latestPrice.low} />
              <OhlcBadge label="C" value={latestPrice.close} />
            </div>
          )}
          <span
            className="num"
            style={{
              fontSize: "var(--fs-header)",
              fontWeight: 700,
              color: "var(--mer-ink-primary)",
              transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {formatPrice(currentCompany?.current_price ?? latestClose ?? null)}
          </span>
          <span
            className="num"
            style={{
              fontSize: "var(--fs-body)",
              fontWeight: 600,
              color: isPositive ? "var(--positive)" : "var(--negative)",
              transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {isPositive ? "+" : ""}
            {dayChange.toFixed(2)}%
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(54px, auto))", gap: 4 }}>
          <QuoteStat label="Range" value={customRange ? `${customRange.start.slice(5)}–${customRange.end.slice(5)}` : currentRange?.label ?? "--"} />
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
            padding: "4px 6px",
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
              marginBottom: 3,
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
            <TerminalBtn active={showVolumeProfile} onClick={() => setShowVolumeProfile((v) => !v)}>VPVR</TerminalBtn>
            <div style={{ flex: 1 }} />
            <TerminalBtn active={showSentiment} onClick={() => setShowSentiment((v) => !v)}>Sentiment</TerminalBtn>
            <TerminalBtn active={showFundamentals} onClick={() => setShowFundamentals((v) => !v)}>Fundamentals</TerminalBtn>
          </div>



          {/* Chart */}
          <div
            ref={chartContainerRef}
            className="chart-surface"
            style={{
              flex: 1,
              background: "radial-gradient(circle at 50% 0%, rgba(51, 102, 204, 0.08), transparent 36%), #0b0f14",
              border: "1px solid var(--mer-stroke-hairline)",
              borderRadius: "var(--mer-radius-xs)",
              overflow: "hidden",
              minHeight: 0,
              boxShadow: "0 0 0 1px rgba(62, 111, 224, 0.06), var(--mer-shadow-rest)",
              transition: "box-shadow 600ms cubic-bezier(0.16, 1, 0.3, 1)",
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
              onRangeChange={updateChartRange}
              replayPickMode={replayPickMode}
              onReplayPointSelect={handleReplayPointSelect}
            />
            {replayPickMode && (
              <ReplayPickPrompt onCancel={() => setReplayPickMode(false)} />
            )}
          </div>
          {paneIndicators.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${paneIndicators.length}, minmax(0, 1fr))`,
                gap: 4,
                marginTop: 4,
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
                    onRangeChange={updateChartRange}
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
              animation: "fade-slide-down 220ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
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
            <div style={{ padding: "6px 10px", flex: 1 }}>
              <FundamentalsPanel
                financials={financials ?? null}
                company={companyDetail ?? null}
                dividendYieldPct={companyDividends?.trailing_12m_yield_pct ?? null}
                loading={!financials && !!selectedTicker}
              />
            </div>
          </div>
        )}

          {/* Right Sidebar */}
          <aside
            style={{
              width: 220,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid var(--mer-stroke-hairline)",
              overflow: "auto",
              animation: "fade-slide-down 250ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {showSentiment && (
              <div
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--mer-stroke-hairline)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 3, height: 12, borderRadius: 2, background: "var(--mer-accent-500)", flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--mer-ink-tertiary)",
                    }}
                  >
                    Market Sentiment
                  </span>
                </div>
                <SentimentGauge value={sentimentValue} previousValue={prevSentiment} width={200} height={96} />
                <SentimentHistory history={sentimentHistoryRef.current} width={200} height={32} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 4,
                    marginTop: 6,
                  }}
                >
                  <SentimentDriver label="Cycle" value={sentimentDrivers.cycle} warmingUp={sentimentDrivers.warmingUp.cycle} />
                  <SentimentDriver label="Breadth" value={sentimentDrivers.breadth} warmingUp={sentimentDrivers.warmingUp.breadth} />
                  <SentimentDriver label="Momentum" value={sentimentDrivers.momentum} warmingUp={sentimentDrivers.warmingUp.momentum} />
                  <SentimentDriver label="News" value={sentimentDrivers.news} warmingUp={sentimentDrivers.warmingUp.news} />
                  <SentimentDriver label="Volatility" value={sentimentDrivers.volatility} warmingUp={sentimentDrivers.warmingUp.volatility} />
                  <SentimentDriver label="52W Range" value={sentimentDrivers.highLowBreadth} warmingUp={sentimentDrivers.warmingUp.highLowBreadth} />
                </div>
              </div>
            )}

            <NewsCompactPanel news={newsData ?? []} companyName={currentCompany?.name ?? null} />
          </aside>
      </div>

      {/* Replay Controls */}
      <ReplayControls
        replayPickMode={replayPickMode}
        onRequestReplayPick={() => {
          pause();
          setReplayPickMode(true);
        }}
        onCancelReplayPick={() => setReplayPickMode(false)}
      />
    </div>
  );
}

function OhlcBadge({ label, value }: { label: string; value: number | string | null | undefined }) {
  const numericValue = Number(value);

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
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
          color: "var(--mer-ink-primary)",
          fontWeight: 600,
        }}
      >
        {Number.isFinite(numericValue) ? numericValue.toFixed(2) : "--"}
      </span>
    </div>
  );
}

function ReplayPickPrompt({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px",
        border: "1px solid var(--mer-stroke-accent)",
        borderRadius: "var(--mer-radius-sm)",
        boxShadow: "0 4px 24px rgba(4, 6, 10, 0.5), 0 0 0 1px var(--mer-stroke-emphasis)",
        background: "rgba(10, 14, 22, 0.94)",
        boxShadow: "var(--mer-shadow-overlay)",
        color: "var(--mer-ink-primary)",
        fontSize: "var(--fs-small)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--mer-accent-300)",
          boxShadow: "0 0 12px rgba(62,111,224,0.9)",
        }}
      />
      <span>Click any candle to replay from that point.</span>
      <button
        type="button"
        onClick={onCancel}
        style={{
          height: 24,
          padding: "0 8px",
          border: "1px solid var(--mer-stroke-hairline)",
          borderRadius: "var(--mer-radius-sm)",
          background: "var(--mer-surface-2)",
          color: "var(--mer-ink-secondary)",
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
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
          padding: "6px 8px",
          borderBottom: "1px solid var(--mer-stroke-hairline)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--mer-ink-tertiary)",
        }}
      >
        <span style={{ width: 3, height: 12, borderRadius: 2, background: "var(--mer-accent-500)", flexShrink: 0 }} />
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
                  padding: "7px 8px",
                  borderBottom: "1px solid var(--mer-stroke-hairline)",
                  display: "grid",
                  gridTemplateColumns: "6px minmax(0, 1fr)",
                  gap: 8,
                  cursor: "default",
                  transition: "background 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
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
                      fontWeight: 500,
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

function SentimentDriver({ label, value, warmingUp }: { label: string; value: number; warmingUp?: boolean }) {
  const rounded = Math.round(value);
  const color = warmingUp
    ? "var(--mer-ink-tertiary)"
    : rounded >= 58
      ? "var(--positive)"
      : rounded <= 42
        ? "var(--negative)"
        : "var(--mer-ink-secondary)";

  return (
    <div
      title={warmingUp ? "Warming up \u2014 not enough trailing history for a reliable reading yet" : undefined}
      style={{
        padding: "4px 6px",
        border: "1px solid var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-xs)",
        background: "rgba(255,255,255,0.025)",
        cursor: "default",
        transition: "background 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.045)"; e.currentTarget.style.borderColor = "var(--mer-stroke-emphasis)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = "var(--mer-stroke-hairline)"; }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--mer-ink-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        className="num"
        style={{
          marginTop: 1,
          fontSize: "var(--fs-small)",
          fontWeight: 700,
          color,
          fontStyle: warmingUp ? "italic" : "normal",
        }}
      >
        {warmingUp ? "\u2026" : rounded}
      </div>
    </div>
  );
}


function QuoteStat({ label, value }: { label: string; value: React.ReactNode }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 52,
        padding: "2px 5px",
        border: "1px solid",
        borderColor: hovered ? "var(--mer-stroke-emphasis)" : "var(--mer-stroke-hairline)",
        borderRadius: "var(--mer-radius-xs)",
        background: hovered ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.025)",
        cursor: "default",
        transition: "background 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--mer-ink-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        className="num"
        style={{
          marginTop: 1,
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
