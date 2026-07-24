"use client";

import * as React from "react";
import { BookOpenText, ChevronDown, Sparkles } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { ApiError } from "@/lib/api/client";
import { useExplainMetric } from "@/lib/api/hooks/useAi";
import { cn } from "@/lib/utils";

const TERMS = [
  "Sharpe Ratio",
  "P/E Ratio",
  "Beta",
  "Volatility",
  "Max Drawdown",
  "Value at Risk (VaR)",
  "Intrinsic Value",
  "Moat Score",
  "Win Rate",
  "Unrealized P&L",
  "Cash Allocation",
  "Sector Concentration",
];

function GlossaryItem({ term, onExplained }: { term: string; onExplained?: () => void }) {
  const [revealed, setRevealed] = React.useState(false);
  const explain = useExplainMetric({ metric_name: term }, revealed);
  const notConfigured = explain.error instanceof ApiError && explain.error.status === 503;

  return (
    <div className={cn("border-b py-2.5 transition-colors duration-150 hover:bg-mer-surface-1 -mx-1.5 px-1.5 rounded-mer-sm", MER_HAIRLINE)}>
      <button
        type="button"
        onClick={() => {
          if (!revealed) onExplained?.();
          setRevealed((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-small font-medium tracking-[0.01em] text-mer-ink-primary">{term}</span>
        <ChevronDown size={14} className={cn("shrink-0 text-mer-ink-tertiary transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-expo)]", revealed && "rotate-180")} />
      </button>
      {revealed && (
        <div className="mt-2 transition-all duration-[var(--duration-base)]">
          {explain.isLoading ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton width="100%" height={12} />
              <Skeleton width="70%" height={12} />
            </div>
          ) : explain.isError ? (
            <p className="text-micro text-mer-ink-tertiary">
              {notConfigured ? "AI advisor isn't configured yet." : "Couldn't generate an explanation."}
            </p>
          ) : (
            <AiMarkdown text={explain.data?.explanation ?? ""} />
          )}
        </div>
      )}
    </div>
  );
}

/** Explain Metrics, embedded directly in the AI Workspace -- a real glossary
 * you can click through, not just a pointer to "go find a tooltip
 * elsewhere." Same useExplainMetric hook + click-to-reveal + cache as the
 * Definition tooltip version (AiMetricExplainer.tsx) -- one term explained
 * once is cached for every tooltip AND this glossary for the rest of the
 * session, no duplicate calls. */
export function MetricsGlossaryPanel({ onExplained }: { onExplained?: () => void } = {}) {
  return (
    <DashboardPanel eyebrow="✦ AI GLOSSARY" title="Explain Metrics" icon={BookOpenText} edge="iris" bodyClassName="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
      {TERMS.map((term) => (
        <GlossaryItem key={term} term={term} onExplained={onExplained} />
      ))}
      <div className={cn("col-span-full flex items-center gap-1.5 pt-2 text-micro text-mer-ink-tertiary")}>
        <Sparkles size={11} className="text-[#8b7cf6]" />
        Metric tooltips throughout the app use this same AI, cached per term.
      </div>
    </DashboardPanel>
  );
}
