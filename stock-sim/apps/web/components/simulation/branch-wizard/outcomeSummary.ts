import type { TimelinePrimitive } from "@/lib/api/types";

export interface MarketComparison {
  companyCount: number;
  /** Average absolute % price difference vs. the parent, across companies with data on both timelines. */
  avgPctDiff: number;
  /** Count of companies priced higher on the branch than on the parent at this same sim date. */
  higherCount: number;
  /** Count of companies priced lower on the branch than on the parent at this same sim date. */
  lowerCount: number;
}

export interface BranchOutcomeInput {
  primitive: TimelinePrimitive;
  overrideCount: number;
  branchPointSimDate: string;
  fastForwardDays: number;
  tickCount: number;
  marketComparison: MarketComparison | null;
}

const PRIMITIVE_LABELS: Record<TimelinePrimitive, string> = {
  manual: "manual branch",
  structural_override: "structural override",
  macro_shock: "macro shock",
  sensitivity_sweep: "sensitivity sweep",
  monte_carlo: "Monte Carlo ensemble",
  liquidity_scenario: "liquidity scenario",
};

/** Composes the plain-language explanation shown once a branch finishes
 * creating, so a non-technical user understands what this new timeline
 * actually represents and how (if at all) it has diverged from the live
 * market it forked from -- rather than just a bare "ready" status. */
export function buildBranchOutcomeSummary(input: BranchOutcomeInput): string {
  const { primitive, overrideCount, branchPointSimDate, fastForwardDays, tickCount, marketComparison } = input;

  const parts: string[] = [];

  const overrideClause = overrideCount > 0 ? `${overrideCount} override(s)` : "no overrides";
  parts.push(
    `This is a ${PRIMITIVE_LABELS[primitive]} forked from the live market on ${branchPointSimDate}, with ${overrideClause} applied at the branch point.`
  );

  if (fastForwardDays <= 0) {
    parts.push("It stays frozen at its branch point — no simulated time has passed on this branch yet.");
  } else if (tickCount >= fastForwardDays) {
    parts.push(`It has been fast-forwarded ${fastForwardDays} sim-day(s) beyond the branch point.`);
  } else {
    parts.push(
      `It has completed ${tickCount} of the requested ${fastForwardDays} sim-day(s) so far — the rest are still fast-forwarding in the background.`
    );
  }

  if (marketComparison) {
    const { companyCount, avgPctDiff, higherCount, lowerCount } = marketComparison;
    if (Math.round(avgPctDiff * 10) === 0) {
      parts.push("So far, this branch has tracked the live market's prices closely — no meaningful divergence yet.");
    } else {
      const majorityDirection = lowerCount >= higherCount ? "lower" : "higher";
      const majorityCount = lowerCount >= higherCount ? lowerCount : higherCount;
      parts.push(
        `Compared to what the live market shows today, ${majorityCount} of ${companyCount} companies are priced ${majorityDirection} on this branch, by an average of ${avgPctDiff.toFixed(1)}%.`
      );
    }
  }

  return parts.join(" ");
}
