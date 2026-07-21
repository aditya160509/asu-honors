"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { del, get, getToken, post } from "@/lib/api/client";
import { buildWsUrl } from "@/lib/api/ws";
import type {
  MarkAllReadResponse,
  NotificationResponse,
  PriceAlertCreateRequest,
  PriceAlertResponse,
} from "@/lib/api/types";

const NOTIFICATIONS_KEY = ["notifications"];

export function useNotifications(limit = 30) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, limit],
    queryFn: () => get<NotificationResponse[]>("/notifications", { limit }),
    // Fallback cadence for whenever the realtime WS (useNotificationSocket)
    // isn't connected -- same as the market grid's live-price polling.
    // With the socket connected, a new notification invalidates this query
    // immediately instead of waiting out the interval.
    refetchInterval: 15_000,
  });
}

/**
 * Opens a WebSocket to apps/api/routers/ws.py's /ws/notifications endpoint
 * and invalidates the notifications query the moment a push arrives, so the
 * bell (and its toast-on-arrival) update near-instantly instead of waiting
 * up to 15s for the next poll. Purely additive: if the socket never
 * connects, fails to authenticate, or drops, useNotifications' own polling
 * keeps the bell correct regardless -- this is a latency optimization only.
 * Reconnects with a capped linear backoff on unexpected close.
 */
export function useNotificationSocket(enabled: boolean) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    function connect() {
      if (stopped) return;
      socket = new WebSocket(buildWsUrl(`/ws/notifications?token=${encodeURIComponent(token!)}`));

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.type === "notification") {
            queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
          }
        } catch {
          // Ignore malformed frames -- polling still covers correctness.
        }
      };

      socket.onopen = () => {
        attempt = 0;
      };

      socket.onclose = () => {
        if (stopped) return;
        const delay = Math.min(1000 * 2 ** attempt, 15_000);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [enabled, queryClient]);
}

/**
 * Fires a toast the first time a given session observes a new unread
 * notification. Tracked via an in-memory "highest id seen" ref (not
 * localStorage) so a page reload doesn't replay a toast storm for every
 * notification that arrived while the tab was closed -- those are still
 * visible (and unread) in the bell dropdown, just without the popup.
 */
export function useNotificationToasts(notifications: NotificationResponse[] | undefined) {
  const highestSeenId = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    const maxId = Math.max(...notifications.map((n) => n.id));

    if (highestSeenId.current === null) {
      // First observation this session -- establish the baseline without
      // toasting for everything already unread (likely from before this
      // tab was open).
      highestSeenId.current = maxId;
      return;
    }

    const fresh = notifications
      .filter((n) => n.id > highestSeenId.current!)
      .sort((a, b) => a.id - b.id);
    for (const n of fresh) {
      toast(notificationTitle(n), { description: notificationMessage(n) });
    }
    if (fresh.length > 0) highestSeenId.current = maxId;
  }, [notifications]);
}

export function notificationTitle(n: NotificationResponse): string {
  switch (n.notification_type) {
    case "branch_ready":
      return "Branch ready";
    case "branch_failed":
      return "Branch failed";
    case "price_alert":
      return "Price alert";
    case "watchlist_mover":
      return "Watchlist mover";
    default:
      return "Notification";
  }
}

export function notificationMessage(n: NotificationResponse): string {
  const p = n.payload;
  switch (n.notification_type) {
    case "branch_ready":
      return `"${p.timeline_name ?? "Your branch"}" finished fast-forwarding.`;
    case "branch_failed":
      return `"${p.timeline_name ?? "Your branch"}" failed${p.error ? `: ${p.error}` : "."}`;
    case "price_alert":
      return `${p.ticker ?? "A company"} crossed ${p.direction === "above" ? "above" : "below"} $${p.target_price} (now $${p.current_price}).`;
    case "watchlist_mover":
      return `${p.ticker ?? "A watchlist company"} moved ${
        Number(p.pct_change) > 0 ? "+" : ""
      }${(Number(p.pct_change) * 100).toFixed(1)}% (now $${p.latest_close}).`;
    default:
      return "";
  }
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => post<NotificationResponse>(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => post<MarkAllReadResponse>("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function usePriceAlerts(timelineId?: number, activeOnly = true) {
  return useQuery({
    queryKey: ["price-alerts", timelineId, activeOnly],
    queryFn: () =>
      get<PriceAlertResponse[]>("/notifications/price-alerts", {
        timeline_id: timelineId,
        active_only: activeOnly,
      }),
  });
}

export function useCreatePriceAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PriceAlertCreateRequest) =>
      post<PriceAlertResponse>("/notifications/price-alerts", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
    },
  });
}

export function useDeletePriceAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => del<void>(`/notifications/price-alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
    },
  });
}
