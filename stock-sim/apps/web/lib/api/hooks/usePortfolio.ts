"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type { PortfolioAnalyticsResponse, PortfolioResponse, TransactionItem } from "@/lib/api/types";

export function usePortfolio() {
  // NOTE: GET /portfolio takes no timeline_id query param — it resolves the active
  // portfolio via the get_user_portfolio dependency server-side (confirmed in trading.py).
  return useQuery({
    queryKey: ["portfolio"],
    queryFn: () => get<PortfolioResponse>("/portfolio"),
    staleTime: 60_000,
  });
}

export function usePortfolioAnalytics(timelineId?: number) {
  return useQuery({
    queryKey: ["portfolio-analytics", timelineId],
    queryFn: () => get<PortfolioAnalyticsResponse>("/portfolio/analytics", { timeline_id: timelineId }),
    staleTime: 60_000,
  });
}

export function useTransactions(timelineId?: number, limit = 25, offset = 0) {
  return useQuery({
    queryKey: ["transactions", timelineId, limit, offset],
    queryFn: () => get<TransactionItem[]>("/transactions", { timeline_id: timelineId, limit, offset }),
    staleTime: 30_000,
  });
}
