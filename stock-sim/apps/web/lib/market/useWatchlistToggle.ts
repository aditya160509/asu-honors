"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import { useAddToWatchlist, useRemoveFromWatchlist, useWatchlist } from "@/lib/api/hooks/useWatchlist";
import type { CompanyDetail } from "@/lib/api/types";
import { toast } from "sonner";

/**
 * Watchlist add/remove by ticker. The market grid payload has no company id
 * (see CompanyGridItem), so adding resolves the id on demand via the company
 * detail endpoint (cached by React Query) rather than widening the grid API.
 */
export function useWatchlistToggle() {
  const { data: watchlist } = useWatchlist();
  const add = useAddToWatchlist();
  const remove = useRemoveFromWatchlist();
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const watchedTickers = React.useMemo(() => new Set((watchlist ?? []).map((w) => w.ticker)), [watchlist]);

  const setPendingFor = React.useCallback((ticker: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(ticker);
      else next.delete(ticker);
      return next;
    });
  }, []);

  const toggle = React.useCallback(
    async (ticker: string) => {
      const existing = (watchlist ?? []).find((w) => w.ticker === ticker);
      setPendingFor(ticker, true);
      try {
        if (existing) {
          await remove.mutateAsync(existing.company_id);
        } else {
          const detail = await queryClient.fetchQuery({
            queryKey: ["company", ticker, undefined],
            queryFn: () => get<CompanyDetail>(`/companies/${ticker}`),
          });
          await add.mutateAsync({ company_id: detail.id });
        }
      } catch {
        toast.error(`Could not update watchlist for ${ticker}.`);
      } finally {
        setPendingFor(ticker, false);
      }
    },
    [watchlist, remove, add, queryClient, setPendingFor]
  );

  return { watchedTickers, toggle, pending };
}
