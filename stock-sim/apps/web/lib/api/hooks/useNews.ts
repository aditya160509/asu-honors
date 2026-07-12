"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type { NewsItem } from "@/lib/api/types";

export interface UseNewsParams {
  timelineId?: number;
  simDate?: string;
  companyId?: number;
  limit?: number;
  offset?: number;
}

export function useNews({ timelineId, simDate, companyId, limit = 20, offset = 0 }: UseNewsParams) {
  return useQuery({
    queryKey: ["news", timelineId, simDate, companyId, limit, offset],
    queryFn: () =>
      get<NewsItem[]>("/news", {
        timeline_id: timelineId,
        sim_date: simDate,
        company_id: companyId,
        limit,
        offset,
      }),
    staleTime: 15_000,
  });
}
