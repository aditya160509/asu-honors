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
    // Historical snapshots are immutable once fetched — no point polling them.
    refetchInterval: asOfDate ? false : 5000,
    staleTime: asOfDate ? Infinity : 3000,
  });
}

export function useCycleState(timelineId?: number) {
  return useQuery({
    queryKey: ["cycle", timelineId],
    queryFn: () => get<CycleStateResponse>("/market/cycle", { timeline_id: timelineId }),
    refetchInterval: 5000,
    staleTime: 3000,
  });
}
