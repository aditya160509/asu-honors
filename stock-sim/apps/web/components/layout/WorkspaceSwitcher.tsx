"use client";

import * as React from "react";
import { Check, ChevronsUpDown, GitBranch } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimelines } from "@/lib/api/hooks/useSimulation";
import { logActivity } from "@/lib/activity/useActivityLog";

/**
 * Real data (useTimelines), presentational selection only — see
 * DESIGN_SPEC/plan scope note: no page currently threads a "current
 * timeline" concept through its data fetches, so switching here does not
 * yet re-scope what any page loads. That would require a cross-page
 * business-logic change out of scope for the Global Layout pass.
 */
export function WorkspaceSwitcher() {
  const { data: timelines, isLoading } = useTimelines();
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const liveTimeline = timelines?.find((t) => t.is_live);
  const activeId = selectedId ?? liveTimeline?.id;
  const active = timelines?.find((t) => t.id === activeId);

  if (isLoading) return <Skeleton width={140} height={28} />;
  if (!timelines || timelines.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex max-w-[180px] items-center gap-2 h-8 px-2.5 rounded-mer-sm text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors outline-none"
        aria-label="Switch timeline"
      >
        <GitBranch size={14} className="shrink-0 text-mer-ink-tertiary" />
        <span className="truncate text-small">{active?.name ?? "Live"}</span>
        <ChevronsUpDown size={13} className="shrink-0 text-mer-ink-tertiary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-micro uppercase text-text-secondary">Timelines</div>
        <DropdownMenuSeparator />
        {timelines.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => {
              setSelectedId(t.id);
              logActivity({ kind: "workspace", label: `Switched to timeline "${t.name}"` });
            }}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2 truncate">
              {activeId === t.id ? (
                <Check size={13} className="shrink-0 text-accent" />
              ) : (
                <span className="w-[13px] shrink-0" />
              )}
              <span className="truncate">{t.name}</span>
            </span>
            {t.is_live && <span className="shrink-0 text-micro text-positive">Live</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
