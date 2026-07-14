import type { TransactionItem } from "@/lib/api/types";
import type { LinePoint } from "@/lib/charts/types";

/**
 * Cumulative realized P&L over time — the only genuinely time-series
 * "performance" signal this backend exposes (there's no daily portfolio
 * NAV snapshot endpoint). Real values from `realized_pnl`, not a synthetic
 * curve. Shared by the hero sparkline and the full Performance panel so the
 * two never quietly disagree.
 */
export function cumulativeRealizedPnl(transactions: TransactionItem[]): LinePoint[] {
  const sorted = [...transactions].sort((a, b) => (a.sim_date < b.sim_date ? -1 : a.sim_date > b.sim_date ? 1 : 0));
  let running = 0;
  const points: LinePoint[] = [];
  for (const t of sorted) {
    if (t.realized_pnl == null) continue;
    running += Number(t.realized_pnl);
    points.push({ time: new Date(t.sim_date).getTime(), value: running });
  }
  return points;
}
