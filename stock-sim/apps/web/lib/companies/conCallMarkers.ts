import type { ConCallItem, PriceHistoryItem } from "@/lib/api/types";
import type { EventMarker, EventSentiment } from "@/components/charts/EventMarkers";

const SENTIMENT_BY_BUCKET: Record<ConCallItem["performance_bucket"], EventSentiment> = {
  beat: "positive",
  inline: "neutral",
  miss: "negative",
};

/** Nearest PriceHistoryItem index to a con-call's call_date — con-calls land on
 * fiscal-quarter boundaries, which don't always coincide with a trading day. */
function nearestBarIndex(callDate: string, data: PriceHistoryItem[]): number {
  const target = new Date(callDate).getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < data.length; i++) {
    const diff = Math.abs(new Date(data[i].sim_date).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** Maps con-call transcripts onto chart event markers so "why did this move"
 * is answerable by hovering the marker — reuses PriceChart's existing
 * `events` prop/tooltip, no chart-engine changes. */
export function buildConCallMarkers(conCalls: ConCallItem[], data: PriceHistoryItem[]): EventMarker[] {
  if (data.length === 0) return [];
  return conCalls.map((call) => ({
    time: nearestBarIndex(call.call_date, data),
    type: "earnings",
    label: `${call.fiscal_period} · ${call.performance_bucket.toUpperCase()}`,
    sentiment: SENTIMENT_BY_BUCKET[call.performance_bucket],
    detail: call.statements.guidance ?? call.statements.opening ?? undefined,
  }));
}
