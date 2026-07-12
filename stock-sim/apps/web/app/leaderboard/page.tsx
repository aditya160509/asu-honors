"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { TerminalShell } from "@/components/layout/TerminalShell";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { useLeaderboard } from "@/lib/api/hooks/useLeaderboard";

const PAGE_SIZE = 25;

export default function LeaderboardPage() {
  const [offset, setOffset] = React.useState(0);
  const { data, isLoading, isError, refetch } = useLeaderboard(undefined, PAGE_SIZE, offset);

  return (
    <TerminalShell>
      <h1 className="text-h2 font-semibold text-text-primary mb-4">Leaderboard</h1>
      <LeaderboardTable entries={data ?? []} loading={isLoading} error={isError} onRetry={() => refetch()} />
      <div className="flex items-center justify-between mt-3">
        <span className="text-small text-text-secondary">
          Showing {offset + 1}–{offset + (data?.length ?? 0)}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(data?.length ?? 0) < PAGE_SIZE}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </TerminalShell>
  );
}
