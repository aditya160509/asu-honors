"use client";

import { Bell, GitBranch, History, LogIn, Navigation, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useActivityFeed, type ActivityKind } from "@/lib/activity/useActivityLog";
import { timeAgo } from "@/lib/dashboard/timeAgo";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  nav: Navigation,
  auth: LogIn,
  workspace: GitBranch,
  system: Bell,
};

/** Reuses the shared session activity log (lib/activity/useActivityLog) that already backs the Header's bell panel. */
export function RecentActivitySection() {
  const entries = useActivityFeed();

  return (
    <DashboardPanel eyebrow="Session" title="Recent Activity" icon={History} className="col-span-full lg:col-span-4" noBodyPadding>
      {entries.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={History}
            title="Nothing here yet."
            description="Your navigation and session activity will show up here."
          />
        </div>
      ) : (
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-2">
          {entries.slice(0, 10).map((entry) => {
            const Icon = KIND_ICON[entry.kind];
            return (
              <div key={entry.id} className="flex items-start gap-2.5 rounded-mer-sm px-2 py-1.5 hover:bg-mer-surface-3">
                <Icon size={13} className="mt-0.5 shrink-0 text-mer-ink-tertiary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small text-mer-ink-primary">{entry.label}</p>
                  {entry.detail && <p className="truncate text-micro text-mer-ink-tertiary">{entry.detail}</p>}
                </div>
                <span className="shrink-0 text-micro text-mer-ink-tertiary">{timeAgo(entry.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
