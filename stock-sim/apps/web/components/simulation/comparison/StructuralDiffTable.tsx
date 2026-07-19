"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useTimelineDiff } from "@/lib/api/hooks/useSimulation";

interface Props {
  leftTimelineId: number;
  rightTimelineId: number;
}

/** Section 11.5 — side-by-side table of every config/override that differs
 * between two timelines, so a user can audit WHY two paths diverged, not
 * just THAT they did. */
export function StructuralDiffTable({ leftTimelineId, rightTimelineId }: Props) {
  const { data, isLoading } = useTimelineDiff(leftTimelineId, rightTimelineId);

  if (isLoading) return <Skeleton width="100%" height={120} />;
  if (!data || data.entries.length === 0) {
    return <EmptyState title="No structural differences" description="These timelines have identical overrides." />;
  }

  return (
    <div className="card-flat p-4">
      <h4 className="text-small font-medium text-text-primary mb-2">Structural diff</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Target</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Left</TableHead>
            <TableHead>Right</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.entries.map((entry, i) => (
            <TableRow key={i}>
              <TableCell className="text-small text-text-secondary">{entry.target_type}</TableCell>
              <TableCell className="text-small num text-text-primary">
                {entry.target_key}
                {entry.target_scope_id !== null && <span className="text-text-tertiary"> #{entry.target_scope_id}</span>}
              </TableCell>
              <TableCell className="text-small num text-text-secondary">{entry.left_value ?? "—"}</TableCell>
              <TableCell className="text-small num text-text-secondary">{entry.right_value ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
