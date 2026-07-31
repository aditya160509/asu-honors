"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BranchWizardState } from "./BranchWizard";

interface Props {
  state: BranchWizardState;
  onChange: (patch: Partial<BranchWizardState>) => void;
}

export function FastForwardStep({ state, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="fast-forward-days">Fast-forward target (sim-days)</Label>
      <Input
        id="fast-forward-days"
        type="number"
        min={1}
        max={730}
        step={1}
        value={state.fastForwardDays}
        onChange={(e) => onChange({ fastForwardDays: Math.min(730, Math.max(1, Number(e.target.value) || 1)) })}
      />
      <p className="text-micro text-text-tertiary">
        Choose 1–730 days. The run executes in the API&apos;s bounded background worker and streams
        committed progress to the result workspace.
      </p>
    </div>
  );
}
