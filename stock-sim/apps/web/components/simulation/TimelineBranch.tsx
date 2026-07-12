"use client";

import * as React from "react";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateFull } from "@/lib/utils";
import { useCreateTimeline, useTimelines } from "@/lib/api/hooks/useSimulation";

export function TimelineBranch() {
  const { data: timelines, isLoading } = useTimelines();
  const createTimeline = useCreateTimeline();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");

  const liveTimeline = timelines?.find((t) => t.is_live);

  function handleCreate() {
    if (!name.trim() || !liveTimeline) return;
    createTimeline.mutate(
      {
        name: name.trim(),
        parent_timeline_id: liveTimeline.id,
        branch_point_sim_date: new Date().toISOString().slice(0, 10),
      },
      { onSuccess: () => setOpen(false) }
    );
    setName("");
  }

  if (isLoading) return <Skeleton width="100%" height={120} />;

  return (
    <div className="card-flat p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-header font-medium text-text-primary">Timelines</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <GitBranch size={14} />
              Create Branch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Create Branch Timeline</DialogTitle>
            <div className="flex flex-col gap-3">
              <Input placeholder="Timeline name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={handleCreate} disabled={!name.trim() || createTimeline.isPending}>
                {createTimeline.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!timelines || timelines.length === 0 ? (
        <EmptyState title="No timelines yet." description="Create one to start." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {timelines.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-sm text-small",
                t.is_live && "border-l-2 border-accent bg-bg-tertiary"
              )}
            >
              <span className="text-text-primary">{t.name}</span>
              <span className="num text-text-tertiary">{formatDateFull(t.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
