"use client";

import * as React from "react";
import type { CompanyGridItem, NewsItem } from "@/lib/api/types";
import {
  SentimentTrackers,
  computeRawInputs,
  computeSentimentDrivers,
  type SentimentDrivers,
} from "@/lib/market/sentimentScore";

/**
 * Shared React-hook orchestration around lib/market/sentimentScore's pure
 * trailing-z-score functions — wraps the tracker lifecycle + tick-dedup
 * pattern SimulationTradingView established, so other pages (Dashboard,
 * Market Explorer) can show the same composite sentiment gauge without each
 * hand-rolling their own tracker/useMemo wiring. Each call site gets its own
 * independent SentimentTrackers instance (own trailing window, warms up over
 * ~8 ticks) — deliberately not shared with SimulationTradingView's, since
 * there's no page-independent store for that and it isn't needed here.
 */
export function useSentimentDrivers(
  companies: CompanyGridItem[],
  cycleMarketSentiment: number | null | undefined,
  news: NewsItem[],
  simDate: string | null | undefined
): SentimentDrivers {
  const trackersRef = React.useRef<SentimentTrackers | null>(null);
  if (!trackersRef.current) trackersRef.current = new SentimentTrackers();

  const lastTickRef = React.useRef<string | null>(null);
  const lastDriversRef = React.useRef<SentimentDrivers | null>(null);

  return React.useMemo(() => {
    // Each tracker assumes exactly one push() per sim tick; recomputing again
    // for the same tick (e.g. a news refetch resolving after the grid) would
    // corrupt the trailing window with a duplicate sample.
    if (simDate != null && simDate === lastTickRef.current && lastDriversRef.current) {
      return lastDriversRef.current;
    }
    const raw = computeRawInputs(companies, cycleMarketSentiment, news);
    const drivers = computeSentimentDrivers(trackersRef.current!, raw);
    lastTickRef.current = simDate ?? null;
    lastDriversRef.current = drivers;
    return drivers;
  }, [companies, cycleMarketSentiment, news, simDate]);
}
