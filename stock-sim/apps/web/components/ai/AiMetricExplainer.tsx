"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplainMetric } from "@/lib/api/hooks/useAi";

interface Props {
  metricName: string;
  value?: number;
}

/** DESIGN_SPEC's "AI content marker" rule (reserved iris #8b7cf6, ✦ glyph,
 * never unlabeled) applied at tooltip scale -- see AiInsightSection.tsx for
 * the full-card version of the same rule.
 *
 * Click-to-reveal, not fetch-on-open: Radix Tooltip.Content mounts twice per
 * open (a visible popup + a visually-hidden a11y copy), and fetching
 * automatically on mount means a quick, incidental hover across a row of
 * metric cards would fire a real, billed LLM call per card. A deliberate
 * click is the only thing that enables the query (see useExplainMetric).
 */
export function AiMetricExplainer({ metricName, value }: Props) {
  const [revealed, setRevealed] = React.useState(false);
  const explainMetric = useExplainMetric({ metric_name: metricName, value }, revealed);

  return (
    <div className="mt-2 border-t border-[color:var(--mer-stroke-hairline)] pt-2">
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="flex items-center gap-1 text-micro font-medium uppercase tracking-wide text-[#8b7cf6] hover:underline"
        >
          <Sparkles size={10} />
          Explain with AI
        </button>
      ) : (
        <>
          <p className="flex items-center gap-1 text-micro font-medium uppercase tracking-wide text-[#8b7cf6]">
            <Sparkles size={10} />
            AI Explain
          </p>
          {explainMetric.isLoading ? (
            <Skeleton width="100%" height={12} className="mt-1.5" />
          ) : explainMetric.isError ? (
            <p className="mt-1 text-micro text-mer-ink-tertiary">Couldn&apos;t generate an explanation.</p>
          ) : (
            <p className="mt-1 text-micro leading-relaxed text-mer-ink-secondary">{explainMetric.data?.explanation}</p>
          )}
        </>
      )}
    </div>
  );
}
