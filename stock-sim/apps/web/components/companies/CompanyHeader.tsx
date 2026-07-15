"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniAreaSpark } from "@/components/dashboard/primitives/MiniAreaSpark";
import { DeltaBadge } from "@/components/dashboard/primitives/DeltaBadge";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/lib/api/hooks/useWatchlist";
import { cssVar, formatPrice, formatPct, cn } from "@/lib/utils";
import type { CompanyDetail, PriceHistoryItem } from "@/lib/api/types";

export interface CompanyHeaderProps {
  company: CompanyDetail;
  dayChangePct: number | null;
  history?: PriceHistoryItem[];
}

/** Hero header for the Company Details terminal — ticker/name/industry, live price + day change,
 * IV gap, a 30-day trend spark, and a real watchlist toggle (existing /watchlist endpoints). */
export function CompanyHeader({ company, dayChangePct, history }: CompanyHeaderProps) {
  const watchlist = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const isWatched = watchlist.data?.some((w) => w.company_id === company.id) ?? false;
  const watchlistPending = addToWatchlist.isPending || removeFromWatchlist.isPending;

  function toggleWatchlist() {
    if (watchlistPending) return;
    if (isWatched) {
      removeFromWatchlist.mutate(company.id);
    } else {
      addToWatchlist.mutate({ company_id: company.id });
    }
  }

  const ivGap =
    company.latest_iv && Number(company.latest_iv) > 0 && company.latest_price
      ? ((Number(company.latest_price) - Number(company.latest_iv)) / Number(company.latest_iv)) * 100
      : null;

  const sparkData = React.useMemo(() => {
    if (!history || history.length < 2) return [];
    return history.slice(-30).map((item, i) => ({ time: i, value: Number(item.close) }));
  }, [history]);
  const sparkPositive = sparkData.length >= 2 ? sparkData[sparkData.length - 1].value >= sparkData[0].value : true;

  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={toggleWatchlist}
          disabled={watchlistPending}
          aria-pressed={isWatched}
          aria-label={isWatched ? `Remove ${company.ticker} from watchlist` : `Add ${company.ticker} to watchlist`}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-mer-sm border transition-colors",
            "border-[color:var(--mer-stroke-hairline)] bg-mer-surface-2 hover:border-[color:var(--mer-stroke-emphasis)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--mer-accent-500)] focus-visible:outline-offset-2",
            "disabled:opacity-50"
          )}
        >
          <Star
            size={16}
            className={isWatched ? "fill-mer-accent-500 text-mer-accent-500" : "text-mer-ink-tertiary"}
          />
        </button>

        <span className="num text-h2 font-bold text-mer-ink-primary">{company.ticker}</span>
        <span className="max-w-[280px] truncate text-base text-mer-ink-secondary">{company.name}</span>
        <Badge>{company.industry_name}</Badge>

        <div className="flex-1" />

        {sparkData.length >= 2 && (
          <div className="hidden w-28 sm:block">
            <MiniAreaSpark data={sparkData} height={36} color={sparkPositive ? cssVar('--positive') : cssVar('--negative')} />
          </div>
        )}

        <div className="flex flex-col items-end gap-0.5">
          <span className="num text-h2 font-bold text-mer-ink-primary">
            {formatPrice(company.latest_price ? Number(company.latest_price) : null)}
          </span>
          <div className="flex items-center gap-2">
            <DeltaBadge value={dayChangePct} />
            {ivGap != null && (
              <span className="num text-micro text-mer-ink-tertiary">IV gap {formatPct(ivGap)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-mer-accent-500 to-transparent opacity-70" />
    </div>
  );
}

export function CompanyHeaderSkeleton() {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Skeleton width={36} height={36} className="rounded-mer-sm" />
        <Skeleton width={80} height={28} />
        <Skeleton width={160} height={20} />
        <div className="flex-1" />
        <Skeleton width={100} height={28} />
      </div>
      <Skeleton width="100%" height={1} />
    </div>
  );
}
