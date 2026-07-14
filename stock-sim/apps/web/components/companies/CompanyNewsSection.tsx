"use client";

import { Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useNews } from "@/lib/api/hooks/useNews";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/api/types";

export interface CompanyNewsSectionProps {
  companyId: number;
  ticker: string;
}

const SENTIMENT_VARIANT: Record<string, "positive" | "negative" | "default"> = {
  positive: "positive",
  negative: "negative",
  neutral: "default",
};

function NewsRow({ item }: { item: NewsItem }) {
  const variant = SENTIMENT_VARIANT[item.sentiment] ?? "default";
  return (
    <div className={cn("flex flex-col gap-1 border-b py-3 last:border-b-0", MER_HAIRLINE)}>
      <div className="flex items-center gap-2">
        <span className="num text-micro text-mer-ink-tertiary">{item.sim_date}</span>
        <Badge variant={variant}>{item.sentiment}</Badge>
      </div>
      <p className="text-small text-mer-ink-primary">{item.headline}</p>
    </div>
  );
}

/** Recent news scoped to this company via GET /news?company_id — a real, backend-filtered feed
 * (confirmed in apps/api/routers/news.py), not a fabricated corporate-events timeline. */
export function CompanyNewsSection({ companyId, ticker }: CompanyNewsSectionProps) {
  const { data, isLoading } = useNews({ companyId, limit: 8 });

  return (
    <DashboardPanel eyebrow="Coverage" title="Recent News" icon={Newspaper}>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={36} />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={`No recent news for ${ticker}.`} />
      ) : (
        <div className="flex flex-col">
          {data.map((item) => (
            <NewsRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
