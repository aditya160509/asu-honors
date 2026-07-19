"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDateFull } from "@/lib/utils";
import { useDeleteTimeline, useTimelines } from "@/lib/api/hooks/useSimulation";
import { ApiError } from "@/lib/api/client";
import { BranchWizard } from "./branch-wizard/BranchWizard";

export function TimelineBranch() {
  const { data: timelines, isLoading } = useTimelines();
  const deleteTimeline = useDeleteTimeline();
  // useDeleteTimeline/useExtendTimeline existed with zero UI consumers --
  // the only way to archive a stale/failed branch was a direct API call.
  // armedId tracks a two-click "are you sure" without pulling in a whole
  // confirm-dialog primitive for one destructive action.
  const [armedId, setArmedId] = React.useState<number | null>(null);
  const [errorByTimelineId, setErrorByTimelineId] = React.useState<Record<number, string>>({});

  if (isLoading) return <Skeleton width="100%" height={120} />;

  function handleDeleteClick(id: number) {
    if (armedId !== id) {
      setArmedId(id);
      return;
    }
    setArmedId(null);
    setErrorByTimelineId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    deleteTimeline.mutate(id, {
      onError: (error) => {
        // archive_timeline (apps/api/services/branch_service.py) rejects a
        // pinned or the live timeline with a 409 -- surface that reason
        // instead of the delete button silently doing nothing.
        const message = error instanceof ApiError ? error.message : "Failed to delete timeline.";
        setErrorByTimelineId((prev) => ({ ...prev, [id]: message }));
      },
    });
  }

  return (
    <div className="card-flat p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-header font-medium text-text-primary">Timelines</h3>
        <BranchWizard />
      </div>

      {!timelines || timelines.length === 0 ? (
        <EmptyState title="No timelines yet." description="Create one to start." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {timelines.map((t) => (
            <div key={t.id} className="flex flex-col gap-0.5">
              <div
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-sm text-small",
                  t.is_live && "border-l-2 border-accent bg-bg-tertiary"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-text-primary">{t.name}</span>
                  {!t.is_live && t.status !== "ready" && (
                    <span
                      className={cn(
                        "text-micro px-1.5 py-0.5 rounded-sm",
                        t.status === "failed" ? "text-negative bg-negative/10" : "text-text-tertiary bg-bg-tertiary"
                      )}
                    >
                      {t.status}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="num text-text-tertiary">{formatDateFull(t.created_at)}</span>
                  {!t.is_live && !t.pinned && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(t.id)}
                      disabled={deleteTimeline.isPending}
                      title={armedId === t.id ? "Click again to confirm delete" : "Delete this branch"}
                      className={cn(armedId === t.id && "text-negative")}
                    >
                      <Trash2 size={13} />
                      {armedId === t.id ? "Confirm?" : ""}
                    </Button>
                  )}
                </div>
              </div>
              {errorByTimelineId[t.id] && (
                <p className="text-micro text-negative px-3" role="alert">
                  {errorByTimelineId[t.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
