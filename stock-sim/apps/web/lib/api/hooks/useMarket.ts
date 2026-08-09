"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type {
  CycleStateResponse,
  MarketGridResponse,
  MarketNewsBulletinResponse,
  MarketOrderBookResponse,
  MarketRegimeResponse,
  MarketSessionResponse,
} from "@/lib/api/types";

/** `asOfDate` (YYYY-MM-DD) fetches a historical snapshot instead of the live
 * grid — powers the Market Explorer's "time machine" view. Omit for live. */
export function useMarketGrid(timelineId?: number, asOfDate?: string | null) {
  return useQuery({
    queryKey: ["market", timelineId, asOfDate ?? null],
    queryFn: () => get<MarketGridResponse>("/market", { timeline_id: timelineId, as_of_date: asOfDate ?? undefined }),
    // Simulation mutations invalidate market queries immediately. Avoid idle
    // polling so the free Render process does no work while a screen is merely
    // open; focus/reconnect still refreshes a stale live snapshot.
    refetchInterval: false,
    staleTime: asOfDate ? Infinity : 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useCycleState(timelineId?: number) {
  return useQuery({
    queryKey: ["cycle", timelineId],
    queryFn: () => get<CycleStateResponse>("/market/cycle", { timeline_id: timelineId }),
    refetchInterval: false,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useMarketSession(timelineId?: number, simDate?: string | null) {
  return useQuery({
    queryKey: ["market-session", timelineId, simDate ?? null],
    queryFn: () => get<MarketSessionResponse>("/market/session", { timeline_id: timelineId, sim_date: simDate ?? undefined }),
    refetchInterval: 4000,
    staleTime: 1500,
    refetchOnWindowFocus: true,
  });
}

export function useMarketRegime(timelineId?: number) {
  return useQuery({
    queryKey: ["market-regime", timelineId],
    queryFn: () => get<MarketRegimeResponse>("/market/regime", { timeline_id: timelineId }),
    refetchInterval: 5000,
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });
}

export function useMarketOrderBook(ticker: string | null | undefined, timelineId?: number, simDate?: string | null) {
  return useQuery({
    queryKey: ["market-order-book", ticker, timelineId, simDate ?? null],
    queryFn: () => get<MarketOrderBookResponse>(`/market/order-book/${ticker}`, {
      timeline_id: timelineId,
      sim_date: simDate ?? undefined,
    }),
    enabled: Boolean(ticker),
    refetchInterval: 2500,
    staleTime: 1000,
    refetchOnWindowFocus: true,
  });
}

export function useMarketNewsBulletins(timelineId?: number, simDate?: string | null, limit = 3) {
  return useQuery({
    queryKey: ["market-news-bulletins", timelineId, simDate ?? null, limit],
    queryFn: () => get<MarketNewsBulletinResponse[]>("/market/news/bulletins", {
      timeline_id: timelineId,
      sim_date: simDate ?? undefined,
      limit,
    }),
    refetchInterval: 7000,
    staleTime: 3000,
    refetchOnWindowFocus: true,
  });
}
