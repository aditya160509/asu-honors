"use client";

import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { cn, formatPrice } from "@/lib/utils";
import type { TransactionItem } from "@/lib/api/types";

export interface TransactionTimelineProps {
  transactions: TransactionItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

function groupByDate(transactions: TransactionItem[]): [string, TransactionItem[]][] {
  const map = new Map<string, TransactionItem[]>();
  for (const t of transactions) {
    const list = map.get(t.sim_date) ?? [];
    list.push(t);
    map.set(t.sim_date, list);
  }
  return Array.from(map);
}

/** Real chronology of the existing `useTransactions` feed, grouped by trade date — replaces the flat
 * unsorted list on the previous Portfolio page with actual date grouping. */
export function TransactionTimeline({ transactions, loading, error, onRetry, hasMore, onLoadMore, loadingMore }: TransactionTimelineProps) {
  return (
    <DashboardPanel eyebrow="Chronology" title="Recent Transactions" icon={History} noBodyPadding>
      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={32} />
          ))}
        </div>
      ) : error ? (
        <div className="p-4">
          <ErrorState message="Could not load transactions." onRetry={onRetry} />
        </div>
      ) : transactions.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No transactions yet." description="Trades you place will appear here in chronological order." />
        </div>
      ) : (
        <div className="flex flex-col">
          {groupByDate(transactions).map(([date, items]) => (
            <div key={date} className={cn("border-b px-4 py-3", MER_HAIRLINE)}>
              <span className="num text-micro uppercase text-mer-ink-tertiary">{date}</span>
              <div className="mt-2 flex flex-col gap-2">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.side === "buy" ? "bg-positive" : "bg-negative")} />
                    <span
                      className={cn(
                        "num w-10 shrink-0 text-micro font-semibold uppercase",
                        t.side === "buy" ? "text-positive" : "text-negative"
                      )}
                    >
                      {t.side}
                    </span>
                    <span className="num flex-1 truncate text-small text-mer-ink-primary">
                      {t.quantity} {t.ticker}
                    </span>
                    <span className="num text-small text-mer-ink-secondary">{formatPrice(t.price)}</span>
                    {t.realized_pnl != null && (
                      <span className={cn("num text-small", Number(t.realized_pnl) >= 0 ? "text-positive" : "text-negative")}>
                        {formatPrice(t.realized_pnl)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <div className="p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}
    </DashboardPanel>
  );
}
