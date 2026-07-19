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
        min={0}
        step={1}
        value={state.fastForwardDays}
        onChange={(e) => onChange({ fastForwardDays: Math.max(0, Number(e.target.value) || 0) })}
      />
      <p className="text-micro text-text-tertiary">
        0 creates the branch frozen at the branch point — you can fast-forward it later. A
        non-zero value dispatches an async job that ticks the branch forward in the background;
        the confirm step polls its status once created.
      </p>
    </div>
  );
}
