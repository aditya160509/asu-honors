import type { TimelineOverrideSpec, TimelineOverrideTargetType } from "@/lib/api/types";

/** Which target_types + engine keys a TimelineOverride actually supports
 * (engine/overrides.py). Shared by the branch wizard's Configure step
 * (apps/web/components/simulation/branch-wizard/ConfigureStep.tsx) and the
 * admin scenario-template authoring form, so the two override editors can't
 * drift apart on what keys/help text are valid for a given target_type. */
export const OVERRIDE_TARGET_TYPES: TimelineOverrideTargetType[] = [
  "config",
  "factor_score",
  "event",
  "cycle_transition",
  "driver_bias",
];

// "event" has no fixed key list -- it's not wired into the tick loop yet
// (target_key would be a MarketEvent name if/when it is), so it stays free
// text with a warning label rather than a dropdown of options that don't do
// anything.
export const CYCLE_PHASE_OPTIONS = [
  { value: "expansion", label: "Expansion" },
  { value: "peak", label: "Peak" },
  { value: "contraction", label: "Contraction (recession)" },
  { value: "trough", label: "Trough" },
];

export const DRIVER_BIAS_OPTIONS = [
  { value: "value_opportunity", label: "Value opportunity" },
  { value: "earnings_surprise", label: "Earnings surprise" },
  { value: "news_severity", label: "News severity" },
  { value: "economic_outlook", label: "Economic outlook" },
  { value: "guidance", label: "Guidance" },
  { value: "technical_momentum", label: "Technical momentum" },
  { value: "institutional_buying", label: "Institutional buying" },
];

export const FACTOR_SCORE_OPTIONS = [
  { value: "management_quality", label: "Management quality" },
  { value: "moat_score", label: "Moat score" },
  { value: "financial_quality", label: "Financial quality" },
  { value: "fcf_quality", label: "FCF quality" },
  { value: "growth_potential", label: "Growth potential" },
];

// config keys are open-ended (any ConfigParameter key), but these are the
// ones Future Lab scenarios actually reference today (theta_default drives
// mean-reversion speed, kyle_lambda_scale drives trade-impact size) --
// offered as suggestions via a datalist rather than a closed dropdown, since
// unlike cycle_transition/driver_bias/factor_score, config keys aren't a
// fixed enum in the engine.
export const CONFIG_KEY_SUGGESTIONS = [
  "theta_default",
  "kyle_lambda_scale",
  "r_cap",
  "growth_rate_min",
  "growth_rate_max",
];

export function keyOptionsFor(targetType: TimelineOverrideTargetType): { value: string; label: string }[] | null {
  if (targetType === "cycle_transition") return CYCLE_PHASE_OPTIONS;
  if (targetType === "driver_bias") return DRIVER_BIAS_OPTIONS;
  if (targetType === "factor_score") return FACTOR_SCORE_OPTIONS;
  return null; // config (datalist suggestions) / event (free text)
}

// Target types whose override_value the engine parses as a float
// (engine/overrides.py: driver_bias/config/factor_score/cycle_transition all
// do `float(row.override_value)` wrapped in a silent try/except that just
// drops the override on failure -- a user who fat-fingers "0.4x" previously
// got no error anywhere, just a scenario that silently did nothing). "event"
// is free text since it isn't wired into the tick loop yet. Ranges mirror
// apps/api/services/branch_service.py's _validate_overrides.
const NUMERIC_TARGET_TYPES: TimelineOverrideTargetType[] = ["driver_bias", "config", "factor_score", "cycle_transition"];

/** Client-side mirror of branch_service._validate_overrides's numeric checks,
 * surfaced inline in the wizard so a bad value is caught before submission
 * instead of being silently dropped by the engine or rejected by a 409 the
 * user has to decode. Returns null when the value is valid (or not
 * applicable / still empty). */
export function overrideValueError(override: TimelineOverrideSpec): string | null {
  if (!NUMERIC_TARGET_TYPES.includes(override.target_type)) return null;
  if (override.override_value.trim() === "") return null;
  const value = Number(override.override_value);
  if (Number.isNaN(value)) return "Must be a number";
  if (override.target_type === "cycle_transition" && (value < 0 || value > 1)) return "Must be between 0.0 and 1.0";
  if (override.target_type === "driver_bias" && (value < -1 || value > 1)) return "Must be between -1.0 and 1.0";
  if (override.target_type === "factor_score" && (value < -100 || value > 100)) return "Must be between -100 and 100";
  return null;
}

export function valueHelpFor(targetType: TimelineOverrideTargetType): string {
  switch (targetType) {
    case "cycle_transition":
      return "Strength 0.0–1.0 (1.0 = hard-force this phase for the override's duration)";
    case "driver_bias":
      return "Additive delta, e.g. -0.3 (clamped to [-1, 1] after applying)";
    case "factor_score":
      return "Additive delta in points, e.g. -15 (clamped to [0, 100] after applying)";
    case "config":
      return "The new value itself (replaces the current setting), e.g. 0.08";
    case "event":
      return "Not wired into the simulation yet — saved but currently has no effect";
    default:
      return "";
  }
}
