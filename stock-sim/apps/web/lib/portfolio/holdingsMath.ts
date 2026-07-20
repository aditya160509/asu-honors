import type { CompanyGridItem, HoldingResponse, SectorAllocation } from "@/lib/api/types";

export interface HoldingWithWeight extends HoldingResponse {
  /** % of total portfolio value (holdings + cash) this position represents. */
  weight: number;
}

/** Weight is a pure derivation of already-real fields (market_value / total_value) — not a
 * backend field, not fabricated data. */
export function withWeights(holdings: HoldingResponse[], totalValue: number): HoldingWithWeight[] {
  return holdings.map((h) => ({
    ...h,
    weight: totalValue > 0 ? (Number(h.market_value) / totalValue) * 100 : 0,
  }));
}

export interface HoldingWithDayChange extends HoldingWithWeight {
  /** Real per-company day-change % joined in from the market grid by ticker — null if not
   * found there yet (e.g. market data still loading), never fabricated. */
  dayChange: number | null;
}

/** Holdings don't carry their own day-change field, but the market grid (already fetched
 * alongside Holdings for the health strip) has it per company — join rather than refetch. */
export function withDayChange(
  holdings: HoldingWithWeight[],
  companies: CompanyGridItem[]
): HoldingWithDayChange[] {
  const byTicker = new Map(companies.map((c) => [c.ticker, c.day_change_pct]));
  return holdings.map((h) => ({ ...h, dayChange: byTicker.get(h.ticker) ?? null }));
}

/** Hypothetical post-trade single-name weight -- reuses the same weight = value / totalValue * 100
 * formula as withWeights(). Buying/selling only shifts value between cash and this one holding, so
 * totalValue (cash + holdings) itself does not change; only this ticker's market_value does. */
export function hypotheticalPostTradeWeight(
  holdings: HoldingResponse[],
  totalValue: number,
  ticker: string,
  price: number,
  side: "buy" | "sell",
  quantity: number
): number | null {
  if (totalValue <= 0 || price <= 0 || quantity <= 0) return null;
  const existing = holdings.find((h) => h.ticker === ticker);
  const existingValue = existing ? Number(existing.market_value) : 0;
  const delta = quantity * price * (side === "buy" ? 1 : -1);
  const newValue = Math.max(0, existingValue + delta);
  return (newValue / totalValue) * 100;
}

export function largestPositions<T extends HoldingWithWeight>(holdings: T[], n = 5): T[] {
  return [...holdings].sort((a, b) => b.weight - a.weight).slice(0, n);
}

export function topWinners<T extends HoldingResponse>(holdings: T[], n = 5): T[] {
  return [...holdings]
    .filter((h) => Number(h.unrealized_pnl_pct) > 0)
    .sort((a, b) => Number(b.unrealized_pnl_pct) - Number(a.unrealized_pnl_pct))
    .slice(0, n);
}

export function topLosers<T extends HoldingResponse>(holdings: T[], n = 5): T[] {
  return [...holdings]
    .filter((h) => Number(h.unrealized_pnl_pct) < 0)
    .sort((a, b) => Number(a.unrealized_pnl_pct) - Number(b.unrealized_pnl_pct))
    .slice(0, n);
}

/** Share of total portfolio value held in the single largest position — a real concentration-risk
 * indicator derived purely from real market_value figures. */
export function singleNameConcentrationPct(holdings: HoldingResponse[], totalValue: number): number | null {
  if (holdings.length === 0 || totalValue <= 0) return null;
  const largest = Math.max(...holdings.map((h) => Number(h.market_value)));
  return (largest / totalValue) * 100;
}

/** Herfindahl-Hirschman Index over real sector-allocation percentages (standard 0-10000 scale,
 * same definition used in antitrust/concentration analysis) — a pure function of the backend's own
 * `allocation_by_sector` percentages, not an invented statistic. */
export function sectorHHI(allocation: SectorAllocation[]): number | null {
  if (allocation.length === 0) return null;
  return allocation.reduce((sum, s) => sum + s.pct * s.pct, 0);
}

export function hhiLabel(hhi: number): "Low" | "Moderate" | "High" {
  if (hhi < 1500) return "Low";
  if (hhi < 2500) return "Moderate";
  return "High";
}

/** Weighted average of each holding's real per-company volatility figure (from the market grid),
 * weighted by portfolio weight — a proxy for portfolio-level volatility since no daily NAV history
 * exists to compute true statistical volatility. Returns null when no holding has volatility data,
 * rather than fabricating a figure. */
export function weightedVolatility(
  holdings: HoldingWithWeight[],
  volatilityByTicker: Map<string, number>
): number | null {
  const withVol = holdings.filter((h) => volatilityByTicker.has(h.ticker));
  if (withVol.length === 0) return null;
  const totalWeight = withVol.reduce((sum, h) => sum + h.weight, 0);
  if (totalWeight <= 0) return null;
  return withVol.reduce((sum, h) => sum + volatilityByTicker.get(h.ticker)! * h.weight, 0) / totalWeight;
}
