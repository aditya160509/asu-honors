import type { CompanyGridItem } from "@/lib/api/types";

/**
 * Companies sharing the same `industry_name` from the live market grid, ranked by market cap.
 * There is no comparables/peer-group endpoint in the backend — this is a real, derived "same
 * industry" grouping, not a curated peer analysis, and must be labeled as such in the UI.
 */
export function sameIndustryCompanies(
  companies: CompanyGridItem[],
  industryName: string,
  excludeTicker: string,
  n = 6
): CompanyGridItem[] {
  return companies
    .filter((c) => c.industry_name === industryName && c.ticker !== excludeTicker)
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .slice(0, n);
}
