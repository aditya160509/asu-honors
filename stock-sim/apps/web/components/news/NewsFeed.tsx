"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsCard } from "@/components/news/NewsCard";
import { useNews } from "@/lib/api/hooks/useNews";

const PAGE_SIZE = 20;

export interface NewsFeedProps {
  companyId?: number;
}

export function NewsFeed({ companyId }: NewsFeedProps) {
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const { data, isLoading, isError, refetch } = useNews({ companyId, limit });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={90} />
        ))}
      </div>
    );
  }

  if (isError) return <ErrorState message="Could not load news." onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No news yet." description="Advance the simulation to generate events." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((item) => (
        <NewsCard key={item.id} item={item} />
      ))}
      {data.length >= limit && (
        <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE_SIZE)} className="self-center">
          Load more
        </Button>
      )}
    </div>
  );
}
