"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { AiGroundedCard } from "@/components/ai/AiGroundedCard";
import { useExplainNews } from "@/lib/api/hooks/useAi";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { cn } from "@/lib/utils";

/** "AI take" ghost action for a news item -- click-to-reveal (see
 * AiMetricExplainer's rationale): a news feed can render many cards at
 * once, so nothing fetches until the user deliberately asks for a take on
 * this specific item. useExplainNews is cached per newsId (see useAi.ts),
 * so if a take was already generated earlier this session it shows
 * immediately revealed instead of behind another click. */
export function ExplainNewsButton({ newsId, onGenerated }: { newsId: number; onGenerated?: () => void }) {
  const explain = useExplainNews(newsId);
  const [revealed, setRevealed] = React.useState(() => explain.data !== undefined);

  const generate = () =>
    explain.generate().then((result) => {
      if (result.data) onGenerated?.();
    });

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => {
          setRevealed(true);
          generate();
        }}
        className="flex items-center gap-1 self-start text-micro font-medium uppercase tracking-wide text-[#8b7cf6] hover:underline"
      >
        <Sparkles size={10} />
        AI take
      </button>
    );
  }

  return (
    <div className={cn("mt-1 border-t pt-2", MER_HAIRLINE)}>
      <AiGroundedCard
        badgeLabel="AI NEWS TAKE"
        title="AI News Take"
        actionLabel="Generate Take"
        data={explain.data}
        isPending={explain.isPending}
        isError={explain.isError}
        error={explain.error}
        generatedAt={explain.generatedAt}
        onGenerate={generate}
        bare
      />
    </div>
  );
}
