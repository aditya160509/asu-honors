"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from "@/lib/api/hooks/useGoals";
import { usePortfolio } from "@/lib/api/hooks/usePortfolio";
import { cn, formatPrice } from "@/lib/utils";
import type { GoalResponse } from "@/lib/api/types";

const goalSchema = z.object({
  label: z.string().trim().min(1, "Give this goal a name").max(60),
  target_value: z
    .string()
    .min(1, "Enter a target value")
    .refine((v) => Number(v) > 0, "Target must be greater than zero"),
  target_date: z.string().min(1, "Pick a target date"),
});

type GoalFormValues = z.infer<typeof goalSchema>;

/**
 * C8 — Goals v1: one goal type (target portfolio value by target date).
 * Progress bars are accent-filled — generic progress, never market green (A2).
 * Achieved goals keep an accent badge and move to their own section below.
 */
export function GoalsPanel() {
  const goals = useGoals();
  const portfolio = usePortfolio();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<GoalResponse | null>(null);

  const currentValue = portfolio.data ? Number(portfolio.data.total_value) : 0;
  const list = goals.data ?? [];
  const active = list.filter((g) => g.achieved_at == null);
  const achieved = list.filter((g) => g.achieved_at != null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (goal: GoalResponse) => {
    setEditing(goal);
    setDialogOpen(true);
  };

  if (goals.isError) {
    return (
      <DashboardPanel eyebrow="Goals" title="Portfolio Goals" icon={Target}>
        <ErrorState message="Could not load goals." onRetry={() => goals.refetch()} />
      </DashboardPanel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardPanel
        eyebrow="Goals"
        title="Portfolio Goals"
        icon={Target}
        actions={
          list.length > 0 ? (
            <Button size="sm" onClick={openCreate}>
              <Plus size={13} className="mr-1" /> New goal
            </Button>
          ) : undefined
        }
        noBodyPadding
      >
        {goals.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={88} />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Set your first goal"
            description="Track progress toward a target portfolio value."
            action={{ label: "Create a goal", onClick: openCreate }}
          />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {active.length === 0 && (
              <p className="text-small text-mer-ink-tertiary">All goals achieved — set a new target.</p>
            )}
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} onEdit={() => openEdit(g)} />
            ))}
            {achieved.length > 0 && (
              <>
                <p className={cn("border-t pt-3 text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary", MER_HAIRLINE)}>
                  Achieved
                </p>
                {achieved.map((g) => (
                  <GoalCard key={g.id} goal={g} onEdit={() => openEdit(g)} />
                ))}
              </>
            )}
          </div>
        )}
      </DashboardPanel>

      <GoalFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        currentValue={currentValue}
      />
    </div>
  );
}

function GoalCard({ goal, onEdit }: { goal: GoalResponse; onEdit: () => void }) {
  const deleteGoal = useDeleteGoal();
  const [confirming, setConfirming] = React.useState(false);
  const progress = Math.min(goal.progress_pct, 100);
  const daysRemaining = Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000);
  const overdue = goal.achieved_at == null && daysRemaining < 0;

  return (
    <div className={cn("group flex flex-col gap-2 rounded-mer-md border bg-mer-surface-2 p-4", MER_HAIRLINE)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-body font-semibold text-mer-ink-primary">{goal.label}</h3>
          {goal.achieved_at != null && (
            <span className="rounded-mer-xs bg-mer-accent-500/15 px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide text-mer-accent-300">
              Achieved {goal.achieved_at.slice(0, 10)}
            </span>
          )}
        </div>
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="sm" aria-label={`Edit ${goal.label}`} onClick={onEdit}>
            <Pencil size={13} />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete ${goal.label}`} onClick={() => setConfirming(true)}>
            <Trash2 size={13} />
          </Button>
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="num text-small text-mer-ink-secondary">
          {formatPrice(goal.current_value)} <span className="text-mer-ink-tertiary">/ {formatPrice(goal.target_value)}</span>
        </span>
        <span className="num text-small font-medium text-mer-ink-primary">{goal.progress_pct.toFixed(1)}%</span>
      </div>

      {/* Accent progress fill — a generic progress signal, not market data (A2). */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-mer-surface-3">
        <div className="h-full rounded-full bg-mer-accent-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <span className="text-micro text-mer-ink-tertiary">
        Target {goal.target_date}
        {goal.achieved_at == null &&
          (overdue ? (
            <span className="ml-2" style={{ color: "var(--warning)" }}>
              Past target date
            </span>
          ) : (
            <span className="ml-2">{daysRemaining} days remaining</span>
          ))}
      </span>

      {confirming && (
        <div className={cn("flex items-center justify-between gap-3 rounded-mer-sm border p-2.5", MER_HAIRLINE)}>
          <span className="text-small text-mer-ink-secondary">Delete this goal? This can&apos;t be undone.</span>
          <span className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              style={{ backgroundColor: "var(--warning)", color: "#1a1408" }}
              onClick={() => deleteGoal.mutate(goal.id)}
              disabled={deleteGoal.isPending}
            >
              Delete
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

function GoalFormDialog({
  open,
  onOpenChange,
  editing,
  currentValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: GoalResponse | null;
  currentValue: number;
}) {
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    values: editing
      ? { label: editing.label, target_value: String(editing.target_value), target_date: editing.target_date }
      : { label: "", target_value: "", target_date: "" },
  });

  const targetValue = form.watch("target_value");
  const targetDate = form.watch("target_date");
  const alreadyAchieved = Number(targetValue) > 0 && Number(targetValue) <= currentValue;
  const dateInPast = !!targetDate && new Date(targetDate).getTime() < Date.now() - 86_400_000;

  const onSubmit = (values: GoalFormValues) => {
    const body = { label: values.label, target_value: Number(values.target_value), target_date: values.target_date };
    const done = () => {
      onOpenChange(false);
      form.reset();
    };
    if (editing) {
      updateGoal.mutate({ id: editing.id, body }, { onSuccess: done });
    } else {
      createGoal.mutate(body, { onSuccess: done });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogTitle>{editing ? "Edit goal" : "Create a goal"}</DialogTitle>
        <DialogDescription>Reach a target portfolio value by a target date.</DialogDescription>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-label" className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
              Goal name
            </label>
            <Input id="goal-label" placeholder="e.g. Emergency fund" maxLength={60} {...form.register("label")} />
            {form.formState.errors.label && (
              <p className="text-micro" style={{ color: "var(--warning)" }}>
                {form.formState.errors.label.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-target" className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
              Target value
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-small text-mer-ink-tertiary">$</span>
              <Input
                id="goal-target"
                type="number"
                step="any"
                min="0"
                className="num pl-7 text-right"
                {...form.register("target_value")}
              />
            </div>
            {form.formState.errors.target_value ? (
              <p className="text-micro" style={{ color: "var(--warning)" }}>
                {form.formState.errors.target_value.message}
              </p>
            ) : alreadyAchieved ? (
              <p className="text-micro" style={{ color: "var(--warning)" }}>
                This goal is already achieved — try a higher target (current value {formatPrice(currentValue)}).
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-date" className="text-micro font-medium uppercase tracking-wide text-mer-ink-tertiary">
              Target date
            </label>
            <Input id="goal-date" type="date" className="num" {...form.register("target_date")} />
            {form.formState.errors.target_date ? (
              <p className="text-micro" style={{ color: "var(--warning)" }}>
                {form.formState.errors.target_date.message}
              </p>
            ) : dateInPast ? (
              <p className="text-micro" style={{ color: "var(--warning)" }}>
                Target date must be in the future.
              </p>
            ) : null}
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createGoal.isPending || updateGoal.isPending || dateInPast}>
              {editing ? "Save changes" : "Create goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
