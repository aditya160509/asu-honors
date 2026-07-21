"use client";

import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  GitBranch,
  Inbox,
  LogIn,
  Navigation,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActivityFeed, type ActivityKind } from "@/lib/activity/useActivityLog";
import { createSharedToggle } from "@/lib/hooks/createSharedToggle";
import { cn } from "@/lib/utils";
import {
  notificationMessage,
  notificationTitle,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationSocket,
  useNotificationToasts,
} from "@/lib/api/hooks/useNotifications";
import { useAuth } from "@/components/layout/AuthContext";
import type { NotificationResponse, NotificationType } from "@/lib/api/types";

const recentActivityToggle = createSharedToggle();

/** Call from anywhere (e.g. the Command Palette's "View Recent Activity" action) to open the panel. */
export const openRecentActivity = recentActivityToggle.open;

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  nav: Navigation,
  auth: LogIn,
  workspace: GitBranch,
  system: Bell,
};

const NOTIFICATION_ICON: Record<NotificationType, LucideIcon> = {
  branch_ready: CheckCircle2,
  branch_failed: AlertTriangle,
  price_alert: TrendingUp,
  watchlist_mover: TrendingDown,
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

function notificationTimeAgo(isoDate: string): string {
  return timeAgo(new Date(isoDate).getTime());
}

/**
 * Notifications backend (Section 23): branch ready/failed, price alerts, and
 * watchlist movers -- see apps/api/services/notification_service.py. Local
 * session activity (nav/auth/workspace switches, from useActivityLog) has no
 * server backend and never did; it's kept as a secondary section below the
 * real notifications rather than replaced, since it's still genuine
 * information, just a different kind (this session's own actions vs. server
 * events).
 */
export function RecentActivity() {
  const entries = useActivityFeed();
  const open = recentActivityToggle.useValue();
  const { isAuthenticated } = useAuth();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  useNotificationSocket(isAuthenticated);
  useNotificationToasts(notifications);

  const unreadCount = notifications?.filter((n) => n.read_at === null).length ?? 0;
  const hasAnything = (notifications?.length ?? 0) > 0 || entries.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={recentActivityToggle.set}>
      <DropdownMenuTrigger
        className="relative flex items-center justify-center h-8 w-8 rounded-mer-sm text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary transition-colors outline-none"
        aria-label="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-medium leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : (
          entries.length > 0 && (
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          )
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-small font-medium text-text-primary">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-micro text-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {!hasAnything ? (
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            <Inbox size={22} className="text-text-tertiary" />
            <p className="text-small text-text-secondary">Nothing here yet.</p>
            <p className="text-micro text-text-tertiary">
              Branch status, price alerts, and watchlist movers will show up here.
            </p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {notifications?.map((n) => {
              const Icon = NOTIFICATION_ICON[n.notification_type];
              const unread = n.read_at === null;
              return (
                <button
                  key={`n-${n.id}`}
                  type="button"
                  onClick={() => unread && markRead.mutate(n.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-bg-hover",
                    unread && "bg-bg-tertiary/40"
                  )}
                >
                  <Icon size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small text-text-primary">{notificationTitle(n)}</p>
                    <p className="truncate text-micro text-text-tertiary">{notificationMessage(n)}</p>
                  </div>
                  <span className="shrink-0 text-micro text-text-tertiary">
                    {notificationTimeAgo(n.created_at)}
                  </span>
                  {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                </button>
              );
            })}

            {entries.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-micro font-medium text-text-tertiary border-t border-border mt-1">
                  Session activity
                </div>
                {entries.map((entry) => {
                  const Icon = KIND_ICON[entry.kind];
                  return (
                    <div key={entry.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-bg-hover">
                      <Icon size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small text-text-primary">{entry.label}</p>
                        {entry.detail && (
                          <p className="truncate text-micro text-text-tertiary">{entry.detail}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-micro text-text-tertiary">{timeAgo(entry.timestamp)}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
