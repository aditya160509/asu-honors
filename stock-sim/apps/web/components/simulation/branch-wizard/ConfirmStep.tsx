"use client";

import { Loader2 } from "lucide-react";
import { useBranchCostEstimate } from "@/lib/api/hooks/useSimulation";
import type { BranchWizardState } from "./BranchWizard";

interface Props {
  state: BranchWizardState;
}

const PRIMITIVE_LABELS: Record<BranchWizardState["primitive"], string> = {
  manual: "a manual branch",
  structural_override: "a structural override",
  macro_shock: "a macro shock",
  sensitivity_sweep: "a sensitivity sweep",
  monte_carlo: "a Monte Carlo ensemble",
  liquidity_scenario: "a liquidity scenario",
};

export function ConfirmStep({ state }: Props) {
  const costEstimate = useBranchCostEstimate(state.parentTimelineId, state.fastForwardDays);

  const summary = `Branching "${state.name}" from ${state.branchPointSimDate}, applying ${
    PRIMITIVE_LABELS[state.primitive]
  }${state.overrides.length > 0 ? ` with ${state.overrides.length} override(s)` : ""}${
    state.fastForwardDays > 0
      ? `, then running ${state.fastForwardDays} sim-day(s) forward`
      : " (no fast-forward — branch stays frozen at the branch point)"
  }.`;

  return (
    <div className="flex flex-col gap-4">
      <div className="card-flat p-4">
        <p className="text-body text-text-primary">{summary}</p>
      </div>

      <div className="card-flat p-4">
        <p className="text-small font-medium text-text-primary mb-2">Estimated cost</p>
        {costEstimate.isLoading ? (
          <p className="text-small text-text-tertiary flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Estimating…
          </p>
        ) : costEstimate.data ? (
          <div className="flex flex-col gap-1 text-small text-text-secondary">
            <p>
              {costEstimate.data.fast_forward_days} sim-day(s) × {costEstimate.data.company_count} companies
            </p>
            <p className="num text-text-primary">
              ~{costEstimate.data.estimated_compute_ms.toLocaleString()} ms compute
            </p>
          </div>
        ) : (
          <p className="text-small text-text-tertiary">Unable to estimate cost.</p>
        )}
      </div>

      {state.overrides.length > 0 && (
        <div className="card-flat p-4">
          <p className="text-small font-medium text-text-primary mb-2">Overrides</p>
          <div className="flex flex-col gap-1">
            {state.overrides.map((o, i) => (
              <p key={i} className="text-micro text-text-secondary num">
                {o.target_type}.{o.target_key} = {o.override_value}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
