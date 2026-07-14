import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Insight, InsightTone } from "@/lib/dashboard/types";

const TONE_ICON: Record<InsightTone, LucideIcon> = {
  positive: TrendingUp,
  negative: TrendingDown,
  warning: AlertTriangle,
  neutral: Sparkles,
};

const TONE_CLASS: Record<InsightTone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
  neutral: "text-mer-accent-300",
};

/** Shared renderer for a single deterministic `Insight` (icon + text + source badge) — any
 * DESIGN_SPEC "AI card" (edge="iris") consuming lib/dashboard/generateInsights output can reuse
 * this instead of re-implementing the row. */
export function InsightRow({ insight }: { insight: Insight }) {
  const Icon = TONE_ICON[insight.tone];
  return (
    <div className="flex items-start gap-2.5 py-2.5">
      <Icon size={14} className={cn("mt-0.5 shrink-0", TONE_CLASS[insight.tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-small leading-relaxed text-mer-ink-primary">{insight.text}</p>
        <Badge variant="default" className="mt-1.5">
          {insight.sourceLabel}
        </Badge>
      </div>
    </div>
  );
}

export function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <div className="flex flex-col divide-y divide-[color:var(--mer-stroke-hairline)]">
      {insights.map((insight) => (
        <InsightRow key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
