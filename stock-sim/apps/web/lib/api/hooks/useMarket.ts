"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type { CycleStateResponse, MarketGridResponse } from "@/lib/api/types";

export function useMarketGrid(timelineId?: number) {
  return useQuery({
    queryKey: ["market", timelineId],
    queryFn: () => get<MarketGridResponse>("/market", { timeline_id: timelineId }),
    refetchInterval: 5000,
    staleTime: 3000,
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
