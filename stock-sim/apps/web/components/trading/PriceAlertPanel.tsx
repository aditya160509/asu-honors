"use client";

import * as React from "react";
import { Bell, TrendingDown, TrendingUp, X } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimelines } from "@/lib/api/hooks/useSimulation";
import { useCreatePriceAlert, useDeletePriceAlert, usePriceAlerts } from "@/lib/api/hooks/useNotifications";
import { ApiError } from "@/lib/api/client";
import { formatPrice, cn } from "@/lib/utils";
import type { PriceAlertDirection } from "@/lib/api/types";

export interface PriceAlertPanelProps {
  companyId: number;
  ticker: string;
  currentPrice: number | null;
}

/** Section 23 — a user-set target price per company, notified via the
 * notifications bell (RecentActivity) once evaluate_price_alerts (evaluated
 * once per sim-day advance) sees it crossed. Scoped to the live timeline --
 * Future Lab branches get their own alerts via the wizard/branch context,
 * not this company-page panel. */
export function PriceAlertPanel({ companyId, ticker, currentPrice }: PriceAlertPanelProps) {
  const { data: timelines } = useTimelines();
  const liveTimeline = timelines?.find((t) => t.is_live);
  const timelineId = liveTimeline?.id;

  const { data: alerts } = usePriceAlerts(timelineId);
  const createAlert = useCreatePriceAlert();
  const deleteAlert = useDeletePriceAlert();

  const [direction, setDirection] = React.useState<PriceAlertDirection>("above");
  const [targetPrice, setTargetPrice] = React.useState<number | "">("");

  const companyAlerts = (alerts ?? []).filter((a) => a.company_id === companyId);

  const errorMessage =
    createAlert.isError
      ? createAlert.error instanceof ApiError
        ? createAlert.error.message
        : "Failed to create alert."
      : null;

  function handleAdd() {
    if (!timelineId || !targetPrice || targetPrice <= 0) return;
    createAlert.mutate(
      { company_id: companyId, timeline_id: timelineId, target_price: targetPrice, direction },
      { onSuccess: () => setTargetPrice("") },
    );
  }

  return (
    <DashboardPanel eyebrow="Alerts" title={`Price Alerts — ${ticker}`} icon={Bell}>
      <div className="flex flex-col gap-3">
        {companyAlerts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {companyAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-mer-sm border border-border px-2.5 py-1.5"
              >
                <span className="flex items-center gap-1.5 text-small text-text-primary">
                  {alert.direction === "above" ? (
                    <TrendingUp size={13} className="text-positive" />
                  ) : (
                    <TrendingDown size={13} className="text-negative" />
                  )}
                  {alert.direction === "above" ? "Above" : "Below"} {formatPrice(Number(alert.target_price))}
                </span>
                <button
                  type="button"
                  onClick={() => deleteAlert.mutate(alert.id)}
                  className="text-text-tertiary hover:text-negative"
                  aria-label="Remove alert"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <div className="flex rounded-mer-sm border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setDirection("above")}
              className={cn(
                "px-2 py-1.5 text-small",
                direction === "above" ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-hover"
              )}
            >
              Above
            </button>
            <button
              type="button"
              onClick={() => setDirection("below")}
              className={cn(
                "px-2 py-1.5 text-small",
                direction === "below" ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-hover"
              )}
            >
              Below
            </button>
          </div>
          <Input
            type="number"
            placeholder={currentPrice ? formatPrice(currentPrice) : "Target price"}
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!timelineId || !targetPrice || targetPrice <= 0 || createAlert.isPending}
          >
            Set
          </Button>
        </div>
        {errorMessage && (
          <p className="text-micro text-negative" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </DashboardPanel>
  );
}
