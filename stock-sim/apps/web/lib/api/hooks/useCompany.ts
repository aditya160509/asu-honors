"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type {
  CompanyDetail,
  DriverBreakdown,
  FinancialStatementResponse,
  PriceHistoryItem,
  ValuationResponse,
} from "@/lib/api/types";

export function useCompany(ticker: string, timelineId?: number) {
  return useQuery({
    queryKey: ["company", ticker, timelineId],
    queryFn: () => get<CompanyDetail>(`/companies/${ticker}`, { timeline_id: timelineId }),
    staleTime: 30_000,
    enabled: Boolean(ticker),
  });
}

export function usePriceHistory(
  ticker: string,
  timelineId?: number,
  from?: string,
  to?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["history", ticker, timelineId, from, to],
    queryFn: () =>
      get<PriceHistoryItem[]>(`/companies/${ticker}/history`, {
        // NOTE: this endpoint's query param is `timeline` (alias), not `timeline_id` like every
        // other market/company endpoint — confirmed in apps/api/routers/market.py.
        timeline: timelineId,
        from,
        to,
      }),
    staleTime: 30_000,
    // Callers that omit timelineId want "whatever timeline the backend
    // defaults to" (settings.default_timeline_id) -- that's a legitimate,
    // widely-used call shape (company detail page, portfolio holdings,
    // market preview), so timelineId being undefined must NOT disable the
    // query on its own. `options.enabled` lets a caller with a fixed number
    // of parallel slots (e.g. TimelineComparisonView, one useQuery call per
    // color-palette entry regardless of how many are actually filled) opt
    // a specific slot out explicitly instead.
    enabled: Boolean(ticker) && (options?.enabled ?? true),
  });
}

export function useDrivers(ticker: string, timelineId?: number, simDate?: string) {
  return useQuery({
    queryKey: ["drivers", ticker, timelineId, simDate],
    queryFn: () => get<DriverBreakdown[]>(`/companies/${ticker}/drivers`, { timeline_id: timelineId, sim_date: simDate }),
    staleTime: 30_000,
    enabled: Boolean(ticker),
  });
}

export function useFinancials(ticker: string, period?: string) {
  return useQuery({
    queryKey: ["financials", ticker, period],
    queryFn: () => get<FinancialStatementResponse>(`/companies/${ticker}/financials`, { period }),
    staleTime: 60_000,
    enabled: Boolean(ticker),
  });
}

export function useValuation(ticker: string, timelineId?: number) {
  return useQuery({
    queryKey: ["valuation", ticker, timelineId],
    queryFn: () => get<ValuationResponse>(`/companies/${ticker}/valuation`, { timeline_id: timelineId }),
    staleTime: 30_000,
    enabled: Boolean(ticker),
  });
}
