"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type {
  PerformanceRange,
  PortfolioAnalyticsResponse,
  PortfolioDividendsResponse,
  PortfolioHistoryResponse,
  PortfolioResponse,
  TransactionFilters,
  TransactionItem,
} from "@/lib/api/types";

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

export function useTransactions(timelineId?: number, limit = 25, offset = 0, filters?: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", timelineId, limit, offset, filters],
    queryFn: () =>
      get<TransactionItem[]>("/transactions", {
        timeline_id: timelineId,
        limit,
        offset,
        ticker: filters?.ticker,
        side: filters?.side,
        date_from: filters?.date_from,
        date_to: filters?.date_to,
      }),
    staleTime: 30_000,
  });
}

export function usePortfolioHistory(range: PerformanceRange, timelineId?: number) {
  return useQuery({
    queryKey: ["portfolio-history", range, timelineId],
    queryFn: () => get<PortfolioHistoryResponse>("/portfolio/history", { range, timeline_id: timelineId }),
    staleTime: 60_000,
  });
}

export function usePortfolioDividends(timelineId?: number) {
  return useQuery({
    queryKey: ["portfolio-dividends", timelineId],
    queryFn: () => get<PortfolioDividendsResponse>("/portfolio/dividends", { timeline_id: timelineId }),
    staleTime: 60_000,
  });
}
