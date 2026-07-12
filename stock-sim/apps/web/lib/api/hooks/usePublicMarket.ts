"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type { MarketGridResponse } from "@/lib/api/types";

/** Public, unauthenticated market snapshot for the marketing landing page. */
export function usePublicMarketSnapshot() {
  return useQuery({
    queryKey: ["public-market"],
    queryFn: () => get<MarketGridResponse>("/market"),
    staleTime: 60_000,
    retry: 1,
  });
}
