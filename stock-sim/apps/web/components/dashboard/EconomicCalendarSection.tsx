"use client";

import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useNews } from "@/lib/api/hooks/useNews";
import { groupMacroNewsByDate, impactDotCount } from "@/lib/dashboard/economicCalendar";
import { formatDate } from "@/lib/utils";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-positive",
  negative: "bg-negative",
  neutral: "bg-mer-ink-tertiary",
};

/** Real market/industry-wide news, day-grouped — the closest honest analog to an earnings/econ calendar this backend has. */
export function EconomicCalendarSection() {
  const { data, isLoading } = useNews({ limit: 60 });
  const days = groupMacroNewsByDate(data ?? [], 5);

  return (
    <DashboardPanel eyebrow="Scheduled" title="Economic Calendar" icon={CalendarDays} className="col-span-full" noBodyPadding>
      <div className="flex flex-col divide-y divide-[color:var(--mer-stroke-hairline)] lg:grid lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={16} />
            ))}
          </div>
        ) : days.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No market-wide events yet." description="Macro news appears here as the simulation advances." />
          </div>
        ) : (
          days.map((day) => (
            <div key={day.simDate} className="flex gap-3 px-4 py-3">
              <span className="num w-20 shrink-0 pt-0.5 text-micro text-mer-ink-tertiary">{formatDate(day.simDate)}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {day.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[item.sentiment] ?? "bg-mer-ink-tertiary"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small text-mer-ink-primary">{item.headline}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant="default">{item.scopeLabel}</Badge>
                        <span className="flex items-center gap-0.5" aria-label={`Impact: ${impactDotCount(item.severity)} of 3`}>
                          {Array.from({ length: 3 }).map((_, i) => (
                            <span
                              key={i}
                              className={`h-1 w-1 rounded-full ${i < impactDotCount(item.severity) ? "bg-warning" : "bg-mer-surface-4"}`}
                            />
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardPanel>
  );
}
