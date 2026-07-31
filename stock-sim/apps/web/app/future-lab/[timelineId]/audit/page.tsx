"use client";
import { useParams } from "next/navigation";
import { ResultShell } from "@/components/future-lab/ResultShell";
import {
  useAuditLog,
  useTimelineDiff,
  useTimelineStatus,
  useTimelines,
} from "@/lib/api/hooks/useSimulation";
import { formatDateFull } from "@/lib/utils";
export default function AuditPage() {
  const id = Number(useParams<{ timelineId: string }>().timelineId);
  const { data: status } = useTimelineStatus(id, { pollWhilePending: true });
  const { data: audit = [] } = useAuditLog(id);
  const { data: timelines = [] } = useTimelines();
  const timeline = timelines.find((t) => t.id === id);
  const { data: diff } = useTimelineDiff(id, timeline?.parent_timeline_id ?? undefined);
  return (
    <ResultShell timelineId={id}>
      <div className="space-y-5">
        {status?.status === "failed" && (
          <section className="border border-[#ff8585]/40 bg-[#35171b] p-4">
            <h2 className="text-sm font-semibold text-[#ffb1b1]">
              Exact engine failure
            </h2>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-[#ffd2d2]">
              {status.failure_error ?? "No error text was persisted."}
            </pre>
            <div className="mt-3 border-t border-white/10 pt-3 text-xs text-[#ffc4c4]">
              Recovery:{" "}
              {status.recovery_action ??
                "Duplicate the experiment and retry after correcting its inputs."}
            </div>
          </section>
        )}
        <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] p-4">
          <h2 className="text-sm font-semibold text-white">
            Applied overrides
          </h2>
          <div className="mt-3 divide-y divide-white/5">
            {(diff?.entries ?? []).map((r, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 py-2 text-xs">
                <span>{r.target_type}</span>
                <span>{r.target_key}</span>
                <span>scope {r.target_scope_id ?? "market"}</span>
                <span className="font-mono">
                  {r.right_value ?? "—"} → {r.left_value ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="border border-[var(--mer-stroke-hairline)] bg-[var(--mer-surface-1)] p-4">
          <h2 className="text-sm font-semibold text-white">Audit trail</h2>
          <div className="mt-3 divide-y divide-white/5">
            {audit.map((row) => (
              <div key={row.id} className="py-3 text-xs">
                <div className="flex justify-between">
                  <b className="text-[var(--mer-ink-secondary)]">
                    {row.action.replaceAll("_", " ")}
                  </b>
                  <span className="text-[var(--mer-ink-muted)]">
                    {formatDateFull(row.created_at)}
                  </span>
                </div>
                {row.after_value && (
                  <pre className="mt-2 overflow-auto text-[10px] text-[var(--mer-ink-muted)]">
                    {JSON.stringify(row.after_value, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ResultShell>
  );
}
