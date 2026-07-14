"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useWatchlist } from "@/lib/api/hooks/useWatchlist";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { mergeWatchlistWithMarket } from "@/lib/dashboard/watchlistPreview";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";

export function WatchlistPreviewSection() {
  const router = useRouter();
  const watchlist = useWatchlist();
  const market = useMarketGrid();
  const rows = mergeWatchlistWithMarket(watchlist.data ?? [], market.data?.companies ?? []).slice(0, 6);
  const loading = watchlist.isLoading || market.isLoading;

  return (
    <DashboardPanel
      eyebrow="Pinned"
      title="Watchlist"
      icon={Star}
      className="col-span-full md:col-span-6 lg:col-span-4"
      noBodyPadding
      actions={
        <Link href="/market" className="flex items-center gap-1 text-micro text-mer-ink-tertiary hover:text-mer-ink-primary">
          View all <ArrowRight size={11} />
        </Link>
      }
    >
      <div className="flex flex-col gap-0.5 p-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={40} />)
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No pinned companies yet."
            description="Star a company from the Market screener to track it here."
            action={{ label: "Go to Market", onClick: () => router.push("/market") }}
          />
        ) : (
          rows.map((r) => (
            <CompanyRow key={r.companyId} ticker={r.ticker} name={r.name} price={r.price} changePct={r.dayChangePct} />
          ))
        )}
      </div>
    </DashboardPanel>
  );
}
