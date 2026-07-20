export type RiskTier = "Low" | "Medium" | "High";

export interface RiskTierCutoffs {
  /** Volatility (annualized %) below which a company is "Low" risk. */
  low: number;
  /** Volatility (annualized %) below which a company is "Medium" risk (at/above is "High"). */
  medium: number;
}

/** Data-driven Low/Medium/High cutoffs computed as terciles over the live
 * cross-section of company volatilities -- not arbitrary fixed thresholds,
 * since "high volatility" only means something relative to the current
 * market's own distribution. */
export function computeRiskTierCutoffs(volatilities: number[]): RiskTierCutoffs | null {
  const sorted = volatilities.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { low: pick(1 / 3), medium: pick(2 / 3) };
}

export function riskTierFor(volatility: number | null | undefined, cutoffs: RiskTierCutoffs | null): RiskTier | null {
  if (volatility == null || !Number.isFinite(volatility) || cutoffs == null) return null;
  if (volatility < cutoffs.low) return "Low";
  if (volatility < cutoffs.medium) return "Medium";
  return "High";
}

export const RISK_TIER_COLOR: Record<RiskTier, string> = {
  Low: "var(--positive)",
  Medium: "var(--warning)",
  High: "var(--negative)",
};
