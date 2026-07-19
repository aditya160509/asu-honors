"use client";

import * as React from "react";
import { Gauge } from "lucide-react";
import { useMarketGrid, useCycleState } from "@/lib/api/hooks/useMarket";
import { useNews } from "@/lib/api/hooks/useNews";
import { useSentimentDrivers } from "@/lib/dashboard/useSentimentDrivers";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { KpiCounter } from "@/components/dashboard/primitives/KpiCounter";
import { SentimentGauge } from "@/components/dashboard/SentimentGauge";
import { SentimentHistory } from "@/components/dashboard/SentimentHistory";

const HISTORY_LIMIT = 50;

/** Lighter version of the Simulation page's Fear/Greed sentiment gauge —
 * same underlying trailing-z-score composite (lib/market/sentimentScore),
 * built entirely from data the Dashboard already fetches elsewhere
 * (market grid, cycle state, news) — no new backend endpoint. */
export function MarketSentimentSection() {
  const grid = useMarketGrid();
  const cycle = useCycleState();
  const news = useNews({ limit: 50 });

  const drivers = useSentimentDrivers(
    grid.data?.companies ?? [],
    cycle.data?.market_sentiment,
    news.data ?? [],
    grid.data?.sim_date
  );

  const historyRef = React.useRef<number[]>([]);
  const prevRef = React.useRef(drivers.composite);
  React.useEffect(() => {
    historyRef.current.push(drivers.composite);
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current = historyRef.current.slice(-HISTORY_LIMIT);
    prevRef.current = drivers.composite;
  }, [drivers.composite]);

  const isLoading = grid.isLoading || cycle.isLoading;

  return (
    <DashboardPanel eyebrow="Market Mood" title="Sentiment" icon={Gauge} live className="col-span-full lg:col-span-6">
      <div className="flex flex-wrap items-center gap-4">
        <SentimentGauge value={drivers.composite} previousValue={prevRef.current} width={180} height={120} />
        <div className="min-w-[160px] flex-1">
          <SentimentHistory history={historyRef.current} width={220} height={56} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3">
        <KpiCounter label="Cycle" value={drivers.cycle} loading={isLoading} />
        <KpiCounter label="Breadth" value={drivers.breadth} loading={isLoading} />
        <KpiCounter label="Momentum" value={drivers.momentum} loading={isLoading} />
        <KpiCounter label="News" value={drivers.news} loading={isLoading} />
        <KpiCounter label="Volatility" value={drivers.volatility} loading={isLoading} />
        <KpiCounter label="52w Breadth" value={drivers.highLowBreadth} loading={isLoading} />
      </div>
    </DashboardPanel>
  );
}
