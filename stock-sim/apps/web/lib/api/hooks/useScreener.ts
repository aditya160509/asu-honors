"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, getToken, patch, post } from "@/lib/api/client";
import type {
  BreadthResponse,
  ChartAnnotationResponse,
  CorrelationResponse,
  DcfRequest,
  DcfResponse,
  SavedScreenResponse,
  ResearchNotebookResponse,
  ScreenerHeatmapCell,
  ScreenerHeatmapRequest,
  ScreenerMetric,
  ScreenerPreset,
  ScreenerQuery,
  ScreenerQueryResponse,
  ScreenerRanking,
  ScreenerRankingRequest,
  ScreenerEventImpactResponse,
  ScreenerExposurePoint,
  ScreenerNewsClustersResponse,
  ScreenerTranscriptSearchResponse,
  FormulaEvaluateResponse,
} from "@/lib/api/types";

export function useScreenerQuery(query: ScreenerQuery, enabled = true) {
  return useQuery({
    queryKey: ["screener-query", JSON.stringify(query)],
    queryFn: () => post<ScreenerQueryResponse>("/screener/query", query),
    enabled,
    staleTime: query.as_of_date ? Infinity : 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useScreenerMetrics() {
  return useQuery({
    queryKey: ["screener-metrics"],
    queryFn: () => get<ScreenerMetric[]>("/screener/metrics"),
    staleTime: Infinity,
  });
}

export function useScreenerPresets() {
  return useQuery({
    queryKey: ["screener-presets"],
    queryFn: () => get<ScreenerPreset[]>("/screener/presets"),
    staleTime: Infinity,
  });
}

export function useScreenerHeatmap(query: ScreenerQuery, options: { colorMetric?: string; sizeMetric?: string; enabled?: boolean } = {}) {
  const body: ScreenerHeatmapRequest = { query, color_metric: options.colorMetric ?? "day_change_pct", size_metric: options.sizeMetric ?? "market_cap" };
  return useQuery({
    queryKey: ["screener-heatmap", body],
    queryFn: () => post<ScreenerHeatmapCell[]>("/screener/heatmap", body),
    staleTime: query.as_of_date ? Infinity : 30_000,
    enabled: options.enabled ?? true,
  });
}

export function useScreenerRankings(query: ScreenerQuery, metric: string, options: { direction?: "asc" | "desc"; limit?: number; enabled?: boolean } = {}) {
  const body: ScreenerRankingRequest = { query, metric, direction: options.direction ?? "desc", limit: options.limit ?? 50 };
  return useQuery({
    queryKey: ["screener-rankings", body],
    queryFn: () => post<ScreenerRanking[]>("/screener/rankings", body),
    enabled: Boolean(metric) && (options.enabled ?? true),
    staleTime: query.as_of_date ? Infinity : 30_000,
  });
}

export function useDcf(ticker: string, assumptions: DcfRequest = {}, timelineId?: number, asOfDate?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["screener-dcf", ticker, assumptions, timelineId, asOfDate],
    queryFn: () => post<DcfResponse>(`/screener/dcf/${ticker}?${new URLSearchParams({ ...(timelineId ? { timeline_id: String(timelineId) } : {}), ...(asOfDate ? { as_of_date: asOfDate } : {}) }).toString()}`, assumptions),
    enabled: Boolean(ticker) && enabled,
    staleTime: 60_000,
  });
}

export function useScreenerCorrelation(tickers: string[], options: { timelineId?: number; asOfDate?: string | null; lookback?: number; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["screener-correlation", tickers, options],
    queryFn: () => get<CorrelationResponse>("/screener/correlation", {
      tickers: tickers.join(","),
      timeline_id: options.timelineId,
      as_of_date: options.asOfDate ?? undefined,
      lookback: options.lookback,
    }),
    enabled: tickers.length > 0 && (options.enabled ?? true),
    staleTime: options.asOfDate ? Infinity : 60_000,
  });
}

export function useScreenerBreadth(options: { timelineId?: number; asOfDate?: string | null; lookback?: number; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["screener-breadth", options],
    queryFn: () => get<BreadthResponse>("/screener/breadth", {
      timeline_id: options.timelineId,
      as_of_date: options.asOfDate ?? undefined,
      lookback: options.lookback,
    }),
    enabled: options.enabled ?? true,
    staleTime: options.asOfDate ? Infinity : 60_000,
  });
}

export function useScreenerExposure(query: ScreenerQuery, factors?: string[], enabled = true) {
  const body = { query, factors: factors ?? ["management_quality", "moat_score", "financial_quality", "fcf_quality", "growth_potential", "intrinsic_score"] };
  return useQuery({
    queryKey: ["screener-exposure", body],
    queryFn: () => post<ScreenerExposurePoint[]>("/screener/exposure", body),
    enabled,
    staleTime: query.as_of_date ? Infinity : 30_000,
  });
}

export function useScreenerNewsClusters(ticker?: string, options: { timelineId?: number; asOfDate?: string | null; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["screener-news-clusters", ticker, options],
    queryFn: () => get<ScreenerNewsClustersResponse>("/screener/news-clusters", { ticker, timeline_id: options.timelineId, as_of_date: options.asOfDate ?? undefined }),
    enabled: options.enabled ?? Boolean(ticker),
    staleTime: options.asOfDate ? Infinity : 30_000,
  });
}

export function useScreenerTranscriptSearch(ticker: string, search: string, options: { timelineId?: number; asOfDate?: string | null; enabled?: boolean } = {}) {
  const normalized = search.trim();
  return useQuery({
    queryKey: ["screener-transcript-search", ticker, normalized, options],
    queryFn: () => get<ScreenerTranscriptSearchResponse>(`/screener/transcript-search/${ticker}`, {
      q: normalized,
      timeline_id: options.timelineId,
      as_of_date: options.asOfDate ?? undefined,
      limit: 100,
    }),
    enabled: Boolean(ticker) && Boolean(normalized) && (options.enabled ?? true),
    staleTime: options.asOfDate ? Infinity : 30_000,
  });
}

export function useScreenerEventImpacts(ticker: string, options: { timelineId?: number; asOfDate?: string | null; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["screener-event-impacts", ticker, options],
    queryFn: () => get<ScreenerEventImpactResponse>(`/screener/event-impacts/${ticker}`, { timeline_id: options.timelineId, as_of_date: options.asOfDate ?? undefined }),
    enabled: Boolean(ticker) && (options.enabled ?? true),
    staleTime: options.asOfDate ? Infinity : 30_000,
  });
}

export function useScreenerPeers(ticker: string, options: { timelineId?: number; asOfDate?: string | null; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["screener-peers", ticker, options],
    queryFn: () => get<ScreenerQueryResponse>(`/screener/peers/${ticker}`, { timeline_id: options.timelineId, as_of_date: options.asOfDate ?? undefined }),
    enabled: Boolean(ticker) && (options.enabled ?? true),
    staleTime: options.asOfDate ? Infinity : 30_000,
  });
}

export function useScreenerFormula(query: ScreenerQuery, formula: string, enabled = true) {
  return useQuery({
    queryKey: ["screener-formula", query, formula],
    queryFn: () => post<FormulaEvaluateResponse>("/screener/formulas/evaluate", { formula, query }),
    enabled: enabled && Boolean(formula.trim()),
    staleTime: query.as_of_date ? Infinity : 30_000,
  });
}

export function useResearchNotebooks() {
  const queryClient = useQueryClient();
  const authenticated = typeof window !== "undefined" && Boolean(getToken());
  const query = useQuery({
    queryKey: ["research-notebooks"],
    queryFn: () => get<ResearchNotebookResponse[]>("/screener/notebooks"),
    enabled: authenticated,
    staleTime: 30_000,
  });
  const create = useMutation({
    mutationFn: (body: unknown) => post<ResearchNotebookResponse>("/screener/notebooks", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["research-notebooks"] }),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) => patch<ResearchNotebookResponse>(`/screener/notebooks/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["research-notebooks"] }),
  });
  const createBlock = useMutation({
    mutationFn: ({ notebookId, body }: { notebookId: number; body: unknown }) => post(`/screener/notebooks/${notebookId}/blocks`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["research-notebooks"] }),
  });
  return { ...query, authenticated, create, update, createBlock };
}

export function useChartAnnotations(ticker: string, timelineId?: number) {
  const queryClient = useQueryClient();
  const authenticated = typeof window !== "undefined" && Boolean(getToken());
  const query = useQuery({
    queryKey: ["chart-annotations", ticker, timelineId],
    queryFn: () => get<ChartAnnotationResponse[]>("/screener/annotations", { ticker, timeline_id: timelineId }),
    enabled: Boolean(ticker) && authenticated,
    staleTime: 30_000,
  });
  const create = useMutation({
    mutationFn: (body: unknown) => post<ChartAnnotationResponse>("/screener/annotations", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chart-annotations", ticker, timelineId] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => del<void>(`/screener/annotations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chart-annotations", ticker, timelineId] }),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) => patch<ChartAnnotationResponse>(`/screener/annotations/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chart-annotations", ticker, timelineId] }),
  });
  return { ...query, authenticated, create, update, remove };
}

export function useSavedScreenerScreens() {
  const queryClient = useQueryClient();
  const authenticated = typeof window !== "undefined" && Boolean(getToken());
  const query = useQuery({
    queryKey: ["saved-screener-screens"],
    queryFn: () => get<SavedScreenResponse[]>("/screener/saved-screens"),
    enabled: authenticated,
    staleTime: 30_000,
  });
  const create = useMutation({
    mutationFn: (body: unknown) => post<SavedScreenResponse>("/screener/saved-screens", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-screener-screens"] }),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) => patch<SavedScreenResponse>(`/screener/saved-screens/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-screener-screens"] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => del<void>(`/screener/saved-screens/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-screener-screens"] }),
  });
  return { ...query, authenticated, create, update, remove };
}
