import type { CompanyGridItem } from "@/lib/api/types";
import type { MarketComparison } from "./outcomeSummary";

/** Compares a branch's live market grid against its parent's, company-by-company
 * (matched by id, since ticker is stable but id is the join key the grid
 * already carries). Returns null when either side has nothing to compare --
 * a branch whose fast-forward hasn't produced any priced companies yet has
 * no meaningful comparison to show. */
export function compareMarketGrids(
  parentCompanies: CompanyGridItem[],
  branchCompanies: CompanyGridItem[]
): MarketComparison | null {
  if (parentCompanies.length === 0 || branchCompanies.length === 0) return null;

  const parentById = new Map(parentCompanies.map((c) => [c.id, c]));

  let higherCount = 0;
  let lowerCount = 0;
  let totalAbsPctDiff = 0;
  let matchedCount = 0;

  for (const branchCompany of branchCompanies) {
    const parentCompany = parentById.get(branchCompany.id);
    if (!parentCompany || parentCompany.current_price === 0) continue;

    matchedCount += 1;
    const pctDiff = ((branchCompany.current_price - parentCompany.current_price) / parentCompany.current_price) * 100;
    totalAbsPctDiff += Math.abs(pctDiff);
    if (pctDiff > 0) higherCount += 1;
    else if (pctDiff < 0) lowerCount += 1;
  }

  if (matchedCount === 0) return null;

  return {
    companyCount: matchedCount,
    avgPctDiff: totalAbsPctDiff / matchedCount,
    higherCount,
    lowerCount,
  };
}
