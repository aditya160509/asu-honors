import { describe, expect, it } from "vitest";
import { notificationMessage, notificationTitle } from "./useNotifications";
import type { NotificationResponse } from "@/lib/api/types";

function makeNotification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 1,
    notification_type: "branch_ready",
    payload: {},
    sim_date: "2026-01-02",
    read_at: null,
    created_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("notificationTitle", () => {
  it("maps each notification_type to a distinct human title", () => {
    expect(notificationTitle(makeNotification({ notification_type: "branch_ready" }))).toBe("Branch ready");
    expect(notificationTitle(makeNotification({ notification_type: "branch_failed" }))).toBe("Branch failed");
    expect(notificationTitle(makeNotification({ notification_type: "price_alert" }))).toBe("Price alert");
    expect(notificationTitle(makeNotification({ notification_type: "watchlist_mover" }))).toBe("Watchlist mover");
  });
});

describe("notificationMessage", () => {
  it("formats a branch_ready message using the timeline name", () => {
    const msg = notificationMessage(
      makeNotification({ notification_type: "branch_ready", payload: { timeline_name: "My Branch" } })
    );
    expect(msg).toContain("My Branch");
    expect(msg).toContain("finished fast-forwarding");
  });

  it("formats a branch_failed message including the error", () => {
    const msg = notificationMessage(
      makeNotification({
        notification_type: "branch_failed",
        payload: { timeline_name: "My Branch", error: "simulated failure" },
      })
    );
    expect(msg).toContain("My Branch");
    expect(msg).toContain("simulated failure");
  });

  it("formats a price_alert message with ticker, target, and current price", () => {
    const msg = notificationMessage(
      makeNotification({
        notification_type: "price_alert",
        payload: { ticker: "TST", direction: "above", target_price: "120", current_price: "121.5" },
      })
    );
    expect(msg).toContain("TST");
    expect(msg).toContain("above");
    expect(msg).toContain("120");
    expect(msg).toContain("121.5");
  });

  it("formats a watchlist_mover message with a signed percentage", () => {
    const msg = notificationMessage(
      makeNotification({
        notification_type: "watchlist_mover",
        payload: { ticker: "TST", pct_change: "0.11", latest_close: "111" },
      })
    );
    expect(msg).toContain("TST");
    expect(msg).toContain("+11.0%");
    expect(msg).toContain("111");
  });

  it("formats a negative watchlist_mover move without a double sign", () => {
    const msg = notificationMessage(
      makeNotification({
        notification_type: "watchlist_mover",
        payload: { ticker: "TST", pct_change: "-0.08", latest_close: "92" },
      })
    );
    expect(msg).toContain("-8.0%");
    expect(msg).not.toContain("+-");
  });
});
