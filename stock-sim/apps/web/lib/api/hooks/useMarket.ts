"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type { CycleStateResponse, MarketGridResponse } from "@/lib/api/types";

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
    staleTime: asOfDate ? Infinity : 30_000,
    refetchOnWindowFocus: !asOfDate,
  });
}

export function useCycleState(timelineId?: number) {
  return useQuery({
    queryKey: ["cycle", timelineId],
    queryFn: () => get<CycleStateResponse>("/market/cycle", { timeline_id: timelineId }),
    refetchInterval: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
