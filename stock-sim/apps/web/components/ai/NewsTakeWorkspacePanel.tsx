"use client";

import { Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { ExplainNewsButton } from "@/components/ai/ExplainNewsButton";
import { useNews } from "@/lib/api/hooks/useNews";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SENTIMENT_VARIANT: Record<string, "positive" | "negative" | "default"> = {
  positive: "positive",
  negative: "negative",
  neutral: "default",
};

/** Explain News, embedded directly in the AI Workspace -- a real recent-news
 * list with an inline "AI take" per item, not a link out to /news. */
export function NewsTakeWorkspacePanel({ onGenerated }: { onGenerated?: () => void } = {}) {
  const news = useNews({ limit: 12 });

  if (news.isLoading) {
    return (
      <DashboardPanel eyebrow="Recent News" title="News Take" icon={Newspaper}>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={48} />
          ))}
        </div>
      </DashboardPanel>
    );
  }

  if (!news.data || news.data.length === 0) {
    return (
      <DashboardPanel eyebrow="Recent News" title="News Take" icon={Newspaper}>
        <EmptyState icon={Newspaper} title="No news yet." description="Advance the simulation to generate market events." />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel eyebrow="Recent News" title="News Take" icon={Newspaper} noBodyPadding>
      <div className={cn("flex flex-col divide-y", MER_HAIRLINE)}>
        {news.data.map((item) => (
          <div key={item.id} className="flex flex-col gap-1 p-3">
            <div className="flex items-center gap-2">
              <span className="num text-micro text-mer-ink-tertiary">{formatDate(item.sim_date)}</span>
              <Badge variant={SENTIMENT_VARIANT[item.sentiment] ?? "default"}>{item.sentiment}</Badge>
              {(item.company_name || item.industry_name) && (
                <Badge variant="accent">{item.company_name ?? item.industry_name}</Badge>
              )}
            </div>
            <p className="text-small font-medium text-mer-ink-primary">{item.headline}</p>
            <ExplainNewsButton newsId={item.id} onGenerated={onGenerated} />
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}
