"use client";

import { cn } from "@/lib/utils";
import type { TimelinePrimitive } from "@/lib/api/types";
import type { BranchWizardState } from "./BranchWizard";

interface Props {
  state: BranchWizardState;
  onChange: (patch: Partial<BranchWizardState>) => void;
}

const PRIMITIVES: { value: TimelinePrimitive; label: string; description: string }[] = [
  {
    value: "manual",
    label: "Clean baseline",
    description: "Copy the market exactly, then let it evolve along a new path.",
  },
  {
    value: "structural_override",
    label: "Company fundamentals",
    description: "Change quality, growth, moat, valuation behavior, or another structural input.",
  },
  {
    value: "macro_shock",
    label: "Economy shock",
    description: "Move the economy toward expansion, peak, recession, or recovery.",
  },
  {
    value: "sensitivity_sweep",
    label: "What-if range",
    description: "Run five levels of one assumption and reveal the response curve.",
  },
  {
    value: "monte_carlo",
    label: "Probability range",
    description: "Measure percentiles, confidence bands, and tail outcomes across independent paths.",
  },
  {
    value: "liquidity_scenario",
    label: "Liquidity stress",
    description: "Test thinner volume, wider spreads, and more expensive exits.",
  },
];

export function PrimitiveStep({ state, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PRIMITIVES.map((p) => {
        const active = state.primitive === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              // Configuration from a different primitive means nothing here --
              // e.g. macro_shock overrides materialized from a scenario
              // template shouldn't silently ride along into a "manual"
              // branch (which the Configure step claims needs no overrides
              // at all) or a template picked for a different category.
              if (p.value === state.primitive) return;
              onChange({ primitive: p.value, scenarioTemplateId: null, overrides: [] });
            }}
            className={cn(
              "min-h-24 text-left border px-3 py-3 transition-all",
              active ? "border-[#f4b740] bg-[#f4b740]/[.08] shadow-[inset_3px_0_0_#f4b740]" : "border-[#202a38] bg-[#0b1119] hover:border-[#47566d]"
            )}
          >
            <p className={cn("text-body font-medium", active ? "text-accent" : "text-text-primary")}>
              {p.label}
            </p>
            <p className="text-small text-text-secondary mt-0.5">{p.description}</p>
          </button>
        );
      })}
    </div>
  );
}
