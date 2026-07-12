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

export function usePriceHistory(ticker: string, timelineId?: number, from?: string, to?: string) {
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
    enabled: Boolean(ticker),
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
