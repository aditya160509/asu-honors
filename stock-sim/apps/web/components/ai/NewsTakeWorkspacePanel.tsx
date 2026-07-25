"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import { Newspaper } from "lucide-react";
import gsap from "gsap";
import { EASE_OUT_EXPO } from "@/lib/motion/tokens";
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
  const newsListRef = useRef<HTMLDivElement>(null);

  // Staggered entry for news items
  useEffect(() => {
    if (!newsListRef.current) return;
    const items = newsListRef.current.querySelectorAll<HTMLElement>("[data-news-item]");
    if (items.length === 0) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, stagger: 0.03, duration: 0.25, ease: EASE_OUT_EXPO }
    );
  }, [news.data]);

  if (news.isLoading) {
    return (
      <DashboardPanel eyebrow="Recent News" title="News Take" icon={Newspaper}>
        <div className="flex flex-col gap-3 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Skeleton width={48} height={8} />
                <Skeleton width={32} height={8} />
              </div>
              <Skeleton width="100%" height={10} />
              <Skeleton width="55%" height={10} />
            </div>
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
        <div ref={newsListRef}>
          {news.data.map((item) => (
            <div
              key={item.id}
              data-news-item
              className="flex flex-col gap-1.5 p-3 transition-all duration-150 hover:bg-mer-surface-3/20"
            >
            <div className="flex items-center gap-2">
              <span className="num text-micro font-medium text-mer-ink-tertiary">{formatDate(item.sim_date)}</span>
              <Badge variant={SENTIMENT_VARIANT[item.sentiment] ?? "default"} className="transition-transform duration-100 hover:scale-105">
                {item.sentiment}
              </Badge>
              {(item.company_name || item.industry_name) && (
                <Badge variant="accent">{item.company_name ?? item.industry_name}</Badge>
              )}
            </div>
            <p className="text-small font-medium leading-snug text-mer-ink-primary">{item.headline}</p>
            <ExplainNewsButton newsId={item.id} onGenerated={onGenerated} />
          </div>
        ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
