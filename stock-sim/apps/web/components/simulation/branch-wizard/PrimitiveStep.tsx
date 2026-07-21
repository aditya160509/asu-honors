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
    label: "Manual / freeform",
    description: "No canned scenario — just fork and fast-forward, or add your own overrides later.",
  },
  {
    value: "structural_override",
    label: "Structural override",
    description: "Force factor scores or config parameters from the branch point forward.",
  },
  {
    value: "macro_shock",
    label: "Macro shock",
    description: "Force the economic cycle into a phase (e.g. recession) for N sim-days.",
  },
  {
    value: "sensitivity_sweep",
    label: "Sensitivity sweep",
    description: "Run N branches varying one config parameter, same seed, same events.",
  },
  {
    value: "monte_carlo",
    label: "Monte Carlo ensemble",
    description: "Run the same scenario N times with random seeds — a distribution, not one path.",
  },
  {
    value: "liquidity_scenario",
    label: "Liquidity scenario",
    description: "Widen market impact / spread — tests behavior when exits get expensive.",
  },
];

export function PrimitiveStep({ state, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
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
              "text-left rounded-sm border px-3 py-2.5 transition-colors",
              active ? "border-accent bg-bg-tertiary" : "border-border hover:bg-bg-hover"
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
