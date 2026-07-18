"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type { ConCallItem } from "@/lib/api/types";

export interface UseConCallsParams {
  ticker: string;
  limit?: number;
  offset?: number;
}

export function useConCalls({ ticker, limit = 20, offset = 0 }: UseConCallsParams) {
  return useQuery({
    queryKey: ["concalls", ticker, limit, offset],
    queryFn: () => get<ConCallItem[]>(`/companies/${ticker}/concalls`, { limit, offset }),
    enabled: Boolean(ticker),
    staleTime: 15_000,
  });
}
