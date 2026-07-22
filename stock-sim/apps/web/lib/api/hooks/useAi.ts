"use client";

import { useQuery } from "@tanstack/react-query";
import { post } from "@/lib/api/client";
import type {
  AiGroundedResponse,
  CompanyReviewRequest,
  ExplainMetricRequest,
  ExplainMetricResponse,
  ExplainNewsRequest,
  StrategyBuilderRequest,
  StrategyBuilderResponse,
} from "@/lib/api/types";

/** AI Financial Advisor, Phase 1 (Explain Metrics) -- POST /ai/explain-metric.
 *
 * A useQuery, not a useMutation: Radix Tooltip mounts its content in TWO
 * places simultaneously (the visible popup, plus a visually-hidden copy for
 * screen readers), so this hook mounts twice per single tooltip open. A
 * mutation has no request de-duplication, so that used to fire two real API
 * calls (and burn two rate-limit hits, two LLM calls) for one hover.
 * useQuery keys both mounts identically and React Query's own
 * de-duplication collapses them into a single network request for free.
 *
 * `enabled` gates the fetch behind deliberate user action (a click, not
 * hover-open) -- see AiMetricExplainer's "Explain with AI" button. Without
 * this, scanning across a row of metric cards fires a real, billed LLM call
 * per card just from incidental mouse movement.
 */
export function useExplainMetric(request: ExplainMetricRequest, enabled: boolean) {
  return useQuery({
    queryKey: ["explain-metric", request.metric_name, request.value ?? null, request.context ?? null],
    queryFn: () => post<ExplainMetricResponse>("/ai/explain-metric", request),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

// --------------------------------------------------------------------------
// Portfolio Review / Company Review / Explain News / Strategy Builder --
// each is a deliberate, single-fire click (never auto-fetched), but backed
// by useQuery rather than useMutation so a generated result SURVIVES a
// remount -- Radix Tabs unmounts inactive TabsContent by default, so
// switching to another AI Workspace tab and back used to throw away the
// answer entirely, and clicking "Generate" again burned a second real LLM
// call for a question already answered. `enabled: false` + `staleTime:
// Infinity` means the query never fires or goes stale on its own; calling
// `.refetch()` always forces a real network request regardless (that's
// what "Regenerate" needs), while a plain remount just re-reads the cached
// result for free. `dataUpdatedAt` (a real timestamp React Query already
// tracks) doubles as the "generated N ago" source instead of a separately
// tracked timestamp, and survives the same remounts.
// --------------------------------------------------------------------------

export function usePortfolioReview() {
  const query = useQuery({
    queryKey: ["portfolio-review"],
    queryFn: () => post<AiGroundedResponse>("/ai/portfolio-review", {}),
    enabled: false,
    staleTime: Infinity,
    retry: false,
  });
  return {
    data: query.data,
    isPending: query.fetchStatus === "fetching",
    isError: query.isError,
    error: query.error,
    generatedAt: query.dataUpdatedAt || null,
    generate: () => query.refetch(),
  };
}

export function useCompanyReview(ticker: string) {
  const query = useQuery({
    queryKey: ["company-review", ticker],
    queryFn: () => post<AiGroundedResponse>("/ai/company-review", { ticker } satisfies CompanyReviewRequest),
    enabled: false,
    staleTime: Infinity,
    retry: false,
  });
  return {
    data: query.data,
    isPending: query.fetchStatus === "fetching",
    isError: query.isError,
    error: query.error,
    generatedAt: query.dataUpdatedAt || null,
    generate: () => query.refetch(),
  };
}

export function useExplainNews(newsId: number) {
  const query = useQuery({
    queryKey: ["explain-news", newsId],
    queryFn: () => post<AiGroundedResponse>("/ai/explain-news", { news_id: newsId } satisfies ExplainNewsRequest),
    enabled: false,
    staleTime: Infinity,
    retry: false,
  });
  return {
    data: query.data,
    isPending: query.fetchStatus === "fetching",
    isError: query.isError,
    error: query.error,
    generatedAt: query.dataUpdatedAt || null,
    generate: () => query.refetch(),
  };
}

export function useStrategyBuilder(request: StrategyBuilderRequest) {
  const query = useQuery({
    queryKey: ["strategy-builder", request.risk_tolerance, request.goal, request.time_horizon, request.use_context ?? false],
    queryFn: () => post<StrategyBuilderResponse>("/ai/strategy-builder", request),
    enabled: false,
    staleTime: Infinity,
    retry: false,
  });
  return {
    data: query.data,
    isPending: query.fetchStatus === "fetching",
    isError: query.isError,
    error: query.error,
    generatedAt: query.dataUpdatedAt || null,
    generate: () => query.refetch(),
  };
}

// --------------------------------------------------------------------------
// AI Chat (Phase 2) -- scope-parameterized: "portfolio" | "market". Not a
// duplicate endpoint per scope; see apps/api/routers/ai.py's chat endpoint.
// --------------------------------------------------------------------------

export type AiChatScope = "portfolio" | "market";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Mirrors lib/api/client.ts's ApiError shape for the one endpoint that
 * can't go through the normal request() helper (streaming body). */
export class AiChatStreamError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "AiChatStreamError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Streams a chat completion via SSE (POST /ai/chat). Not a TanStack Query
 * hook -- streaming responses don't fit the request/response query model,
 * so this is a plain async generator the caller drives directly. */
export async function* streamAiChat(
  messages: AiChatMessage[],
  scope: AiChatScope,
  useContext: boolean,
): AsyncGenerator<string, void, unknown> {
  const { getToken } = await import("@/lib/api/client");
  const token = getToken();
  const base = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  const res = await fetch(`${base}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, scope, use_context: useContext }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
    throw new AiChatStreamError(
      body?.detail || `HTTP ${res.status}`,
      res.status,
      Number.isFinite(retryAfter as number) ? retryAfter : null,
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
