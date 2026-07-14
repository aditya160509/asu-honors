import type { CompanyGridItem } from "@/lib/api/types";
import type { SectorStat } from "@/lib/dashboard/types";

/** Sector (industry) rollups — powers Sector Performance and the Market Heatmap. */
export function groupBySector(companies: CompanyGridItem[]): SectorStat[] {
  const byIndustry = new Map<string, CompanyGridItem[]>();
  for (const c of companies) {
    const list = byIndustry.get(c.industry_name) ?? [];
    list.push(c);
    byIndustry.set(c.industry_name, list);
  }

  const stats: SectorStat[] = [];
  for (const [industry, group] of byIndustry) {
    const withChange = group.filter((c) => c.day_change_pct != null);
    const avgChangePct =
      withChange.length > 0
        ? withChange.reduce((sum, c) => sum + Number(c.day_change_pct), 0) / withChange.length
        : 0;
    const totalMarketCap = group.reduce((sum, c) => sum + (c.market_cap != null ? Number(c.market_cap) : 0), 0);
    stats.push({ industry, avgChangePct, totalMarketCap, companyCount: group.length, companies: group });
  }

  return stats.sort((a, b) => b.totalMarketCap - a.totalMarketCap);
}

export function topGainers(companies: CompanyGridItem[], n: number): CompanyGridItem[] {
  return [...companies]
    .filter((c) => c.day_change_pct != null)
    .sort((a, b) => Number(b.day_change_pct) - Number(a.day_change_pct))
    .slice(0, n);
}

export function topLosers(companies: CompanyGridItem[], n: number): CompanyGridItem[] {
  return [...companies]
    .filter((c) => c.day_change_pct != null)
    .sort((a, b) => Number(a.day_change_pct) - Number(b.day_change_pct))
    .slice(0, n);
}

/** "Trending" — largest combined move + volatility, a real derived heuristic (no external trend/view data exists). */
export function trendingCompanies(companies: CompanyGridItem[], n: number): CompanyGridItem[] {
  return [...companies]
    .filter((c) => c.day_change_pct != null)
    .sort((a, b) => {
      const scoreA = Math.abs(Number(a.day_change_pct)) + Number(a.volatility ?? 0) * 0.5;
      const scoreB = Math.abs(Number(b.day_change_pct)) + Number(b.volatility ?? 0) * 0.5;
      return scoreB - scoreA;
    })
    .slice(0, n);
}

export interface MarketOverviewStats {
  companyCount: number;
  gainerCount: number;
  loserCount: number;
  unchangedCount: number;
  avgChangePct: number;
  totalMarketCap: number;
  breadthPct: number;
}

export function marketOverviewStats(companies: CompanyGridItem[]): MarketOverviewStats {
  const withChange = companies.filter((c) => c.day_change_pct != null);
  const gainerCount = withChange.filter((c) => Number(c.day_change_pct) > 0).length;
  const loserCount = withChange.filter((c) => Number(c.day_change_pct) < 0).length;
  const unchangedCount = withChange.length - gainerCount - loserCount;
  const avgChangePct =
    withChange.length > 0 ? withChange.reduce((sum, c) => sum + Number(c.day_change_pct), 0) / withChange.length : 0;
  const totalMarketCap = companies.reduce((sum, c) => sum + (c.market_cap != null ? Number(c.market_cap) : 0), 0);
  const breadthPct = withChange.length > 0 ? (gainerCount / withChange.length) * 100 : 0;

  return { companyCount: companies.length, gainerCount, loserCount, unchangedCount, avgChangePct, totalMarketCap, breadthPct };
}
