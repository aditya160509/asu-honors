import type { CompanyGridItem, WatchlistItem } from "@/lib/api/types";
import type { WatchlistPreviewRow } from "@/lib/dashboard/types";

/** Cross-references the watchlist (no price data) with the live market grid (has price data), by ticker. */
export function mergeWatchlistWithMarket(
  watchlist: WatchlistItem[],
  companies: CompanyGridItem[]
): WatchlistPreviewRow[] {
  const byTicker = new Map(companies.map((c) => [c.ticker, c]));
  return watchlist.map((w) => {
    const match = byTicker.get(w.ticker);
    return {
      companyId: w.company_id,
      ticker: w.ticker,
      name: w.name,
      price: match ? Number(match.current_price) : null,
      dayChangePct: match?.day_change_pct != null ? Number(match.day_change_pct) : null,
    };
  });
}
