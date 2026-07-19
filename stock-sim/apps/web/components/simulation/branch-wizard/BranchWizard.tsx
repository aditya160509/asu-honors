"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useCreateTimeline,
  useScenarioLibrary,
  useSimState,
  useTimelineStatus,
  useTimelines,
} from "@/lib/api/hooks/useSimulation";
import { ApiError } from "@/lib/api/client";
import type { TimelineOverrideSpec, TimelinePrimitive } from "@/lib/api/types";
import { BranchPointStep } from "./BranchPointStep";
import { PrimitiveStep } from "./PrimitiveStep";
import { ConfigureStep } from "./ConfigureStep";
import { FastForwardStep } from "./FastForwardStep";
import { ConfirmStep } from "./ConfirmStep";

const STEPS = ["Branch point", "Primitive", "Configure", "Fast-forward", "Confirm"] as const;

export interface BranchWizardState {
  name: string;
  parentTimelineId: number | null;
  branchPointSimDate: string;
  primitive: TimelinePrimitive;
  scenarioTemplateId: number | null;
  overrides: TimelineOverrideSpec[];
  fastForwardDays: number;
}

const INITIAL_STATE: BranchWizardState = {
  name: "",
  parentTimelineId: null,
  branchPointSimDate: "",
  primitive: "manual",
  scenarioTemplateId: null,
  overrides: [],
  fastForwardDays: 0,
};

export function BranchWizard() {
  const { data: timelines } = useTimelines();
  const { data: scenarioLibrary } = useScenarioLibrary();
  const createTimeline = useCreateTimeline();

  const [open, setOpen] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [state, setState] = React.useState<BranchWizardState>(INITIAL_STATE);
  const [createdTimelineId, setCreatedTimelineId] = React.useState<number | undefined>(undefined);

  const liveTimeline = timelines?.find((t) => t.is_live);
  const status = useTimelineStatus(createdTimelineId, { pollWhilePending: true });
  // The simulation runs on its own calendar (seeded at 2026-01-02, advancing
  // one day per tick) that has no relationship to the real wall-clock date --
  // defaulting to `new Date()` (today's REAL date) produced a branch_point_sim_date
  // far in the future relative to the parent's actual simulated history the
  // moment the sim's in-game date fell behind the real calendar date, which
  // create_branch's own validation rejects outright (branch_date must be <=
  // the parent's current_sim_date). Default from (and validate against) the
  // selected parent's real simulated "now" instead. Keyed on
  // state.parentTimelineId (not liveTimeline.id) so it also re-validates
  // correctly if the user changes the parent away from the live timeline.
  const parentSimState = useSimState(state.parentTimelineId ?? liveTimeline?.id);

  React.useEffect(() => {
    if (open && liveTimeline && parentSimState.data && state.parentTimelineId === null) {
      setState((s) => ({
        ...s,
        parentTimelineId: liveTimeline.id,
        branchPointSimDate: parentSimState.data.current_sim_date,
      }));
    }
  }, [open, liveTimeline, parentSimState.data, state.parentTimelineId]);

  function resetAndClose() {
    setOpen(false);
    setStepIndex(0);
    setState(INITIAL_STATE);
    setCreatedTimelineId(undefined);
  }

  function updateState(patch: Partial<BranchWizardState>) {
    setState((s) => ({ ...s, ...patch }));
  }

  function canAdvance(): boolean {
    switch (stepIndex) {
      case 0: {
        const maxDate = parentSimState.data?.current_sim_date;
        const isPastMax = Boolean(maxDate && state.branchPointSimDate > maxDate);
        return Boolean(state.name.trim() && state.parentTimelineId && state.branchPointSimDate) && !isPastMax;
      }
      case 1:
        return Boolean(state.primitive);
      default:
        return true;
    }
  }

  function handleNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function handleSubmit() {
    if (!state.parentTimelineId) return;
    createTimeline.reset();
    createTimeline.mutate(
      {
        name: state.name.trim(),
        parent_timeline_id: state.parentTimelineId,
        branch_point_sim_date: state.branchPointSimDate,
        primitive: state.primitive,
        overrides: state.overrides.length > 0 ? state.overrides : undefined,
        fast_forward_days: state.fastForwardDays,
      },
      {
        onSuccess: (timeline) => setCreatedTimelineId(timeline.id),
      }
    );
  }

  // createTimeline had no onError handler at all before this fix -- a failed
  // request (validation error, 409 conflict, 500, network drop) left the
  // dialog silently stuck on the confirm step with the button re-enabled and
  // no indication anything had gone wrong, indistinguishable from "hasn't
  // been clicked yet." Surfacing the actual message lets the user retry
  // (fix the input) instead of re-submitting blind or assuming it's broken.
  const submitErrorMessage = createTimeline.isError
    ? createTimeline.error instanceof ApiError
      ? createTimeline.error.message
      : "Failed to create branch. Please try again."
    : null;

  const isLastStep = stepIndex === STEPS.length - 1;
  const isSubmitting = createTimeline.isPending;
  const hasCreated = createdTimelineId !== undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitBranch size={14} />
          Branch (Future Lab)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[640px]">
        <DialogTitle>Create Branch Timeline</DialogTitle>

        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className={cn("h-px flex-1", i <= stepIndex ? "bg-accent" : "bg-border")} />}
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-micro font-medium",
                  i < stepIndex && "bg-accent text-white",
                  i === stepIndex && "border border-accent text-accent",
                  i > stepIndex && "border border-border text-text-tertiary"
                )}
              >
                {i + 1}
              </div>
            </React.Fragment>
          ))}
        </div>
        <p className="text-micro text-text-tertiary mb-3">{STEPS[stepIndex]}</p>

        {!hasCreated && (
          <>
            {stepIndex === 0 && (
              <BranchPointStep state={state} timelines={timelines} onChange={updateState} />
            )}
            {stepIndex === 1 && <PrimitiveStep state={state} onChange={updateState} />}
            {stepIndex === 2 && (
              <ConfigureStep state={state} scenarioLibrary={scenarioLibrary} onChange={updateState} />
            )}
            {stepIndex === 3 && <FastForwardStep state={state} onChange={updateState} />}
            {stepIndex === 4 && <ConfirmStep state={state} />}

            {submitErrorMessage && (
              <p className="text-small text-negative mt-3" role="alert">
                {submitErrorMessage}
              </p>
            )}

            <div className="flex items-center justify-between mt-5">
              <Button variant="ghost" size="sm" onClick={handleBack} disabled={stepIndex === 0}>
                <ArrowLeft size={14} />
                Back
              </Button>
              {isLastStep ? (
                <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                  {isSubmitting ? "Creating…" : "Create branch"}
                </Button>
              ) : (
                <Button size="sm" onClick={handleNext} disabled={!canAdvance()}>
                  Next
                  <ArrowRight size={14} />
                </Button>
              )}
            </div>
          </>
        )}

        {hasCreated && (
          <div className="flex flex-col gap-3">
            <div className="card-flat p-4">
              <p className="text-body text-text-primary">
                Branch <span className="font-medium">{state.name}</span> created.
              </p>
              <p className="text-small text-text-secondary mt-1">
                Status:{" "}
                <span className={cn(status.data?.status === "failed" && "text-negative")}>
                  {status.data?.status ?? "pending"}
                </span>
                {status.data?.tick_count !== null && status.data?.tick_count !== undefined && (
                  <> — {status.data.tick_count} tick(s) applied</>
                )}
              </p>
              {(status.data?.status === "pending" || status.data?.status === "running") && (
                <p className="text-micro text-text-tertiary mt-2 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Fast-forwarding in the background…
                </p>
              )}
            </div>
            <Button size="sm" onClick={resetAndClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
