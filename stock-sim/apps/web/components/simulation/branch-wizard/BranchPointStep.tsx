"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSimState } from "@/lib/api/hooks/useSimulation";
import type { TimelineResponse } from "@/lib/api/types";
import type { BranchWizardState } from "./BranchWizard";

interface Props {
  state: BranchWizardState;
  timelines: TimelineResponse[] | undefined;
  onChange: (patch: Partial<BranchWizardState>) => void;
}

export function BranchPointStep({ state, timelines, onChange }: Props) {
  // create_branch (apps/api/services/branch_service.py) rejects any
  // branch_point_sim_date after the parent's current_sim_date with a 409 --
  // the simulation runs on its own calendar (seeded 2026-01-02, one day per
  // tick) independent of the real wall-clock date, so nothing here stopped a
  // user from picking a real-world "today" that's actually far in the
  // future relative to the sim. Bounding the date input's `max` to the
  // parent's actual current_sim_date catches this before submit instead of
  // relying on the generic 409 error banner.
  const parentSimState = useSimState(state.parentTimelineId ?? undefined);
  const maxDate = parentSimState.data?.current_sim_date;
  const isPastMax = Boolean(maxDate && state.branchPointSimDate && state.branchPointSimDate > maxDate);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branch-name">Branch name</Label>
        <Input
          id="branch-name"
          placeholder="e.g. Recession Test 1"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="parent-timeline">Parent timeline</Label>
        <Select
          value={state.parentTimelineId ? String(state.parentTimelineId) : undefined}
          onValueChange={(v) => onChange({ parentTimelineId: Number(v) })}
        >
          <SelectTrigger id="parent-timeline">
            <SelectValue placeholder="Select a timeline" />
          </SelectTrigger>
          <SelectContent>
            {timelines?.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} {t.is_live && "(live)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branch-date">Branch point (sim date)</Label>
        <Input
          id="branch-date"
          type="date"
          max={maxDate}
          value={state.branchPointSimDate}
          onChange={(e) => onChange({ branchPointSimDate: e.target.value })}
        />
        {isPastMax ? (
          <p className="text-micro text-negative" role="alert">
            The parent timeline has only simulated up to {maxDate} — pick a date on or before that.
          </p>
        ) : (
          <p className="text-micro text-text-tertiary">
            The branch inherits the parent&apos;s full history up to this date. Everything after is
            simulated independently — the parent is never affected.
          </p>
        )}
      </div>
    </div>
  );
}
