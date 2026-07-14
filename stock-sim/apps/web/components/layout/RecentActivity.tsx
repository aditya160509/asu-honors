"use client";

import { Bell, GitBranch, Inbox, LogIn, Navigation, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActivityFeed, type ActivityKind } from "@/lib/activity/useActivityLog";
import { createSharedToggle } from "@/lib/hooks/createSharedToggle";

const recentActivityToggle = createSharedToggle();

/** Call from anywhere (e.g. the Command Palette's "View Recent Activity" action) to open the panel. */
export const openRecentActivity = recentActivityToggle.open;

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  nav: Navigation,
  auth: LogIn,
  workspace: GitBranch,
  system: Bell,
};

function timeAgo(ts: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

/**
 * There is no notifications backend, and inventing fake alerts is banned by
 * this project's own anti-slop rules — so this reads real session events
 * (navigation, auth, workspace switches) from `useActivityLog` instead of
 * fabricated content. Bell shows a dot only, never a count.
 */
export function RecentActivity() {
  const entries = useActivityFeed();
  const open = recentActivityToggle.useValue();

  return (
    <DropdownMenu open={open} onOpenChange={recentActivityToggle.set}>
      <DropdownMenuTrigger
        className="relative flex items-center justify-center h-8 w-8 rounded-mer-sm text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors outline-none"
        aria-label="Recent activity"
      >
        <Bell size={15} />
        {entries.length > 0 && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-3 py-2.5 text-small font-medium text-text-primary border-b border-border">
          Recent Activity
        </div>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            <Inbox size={22} className="text-text-tertiary" />
            <p className="text-small text-text-secondary">Nothing here yet.</p>
            <p className="text-micro text-text-tertiary">
              Your recent navigation and session activity will show up here.
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {entries.map((entry) => {
              const Icon = KIND_ICON[entry.kind];
              return (
                <div key={entry.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-bg-hover">
                  <Icon size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small text-text-primary">{entry.label}</p>
                    {entry.detail && <p className="truncate text-micro text-text-tertiary">{entry.detail}</p>}
                  </div>
                  <span className="shrink-0 text-micro text-text-tertiary">{timeAgo(entry.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
