import { Trophy } from "lucide-react";
import { VirtualGrid } from "@/lib/grid/VirtualGrid";
import type { GridColumn } from "@/lib/grid/types";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/api/types";

export interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  currentUserName?: string;
}

const TROPHY_COLOR: Record<number, string> = {
  1: "text-warning",
  2: "text-text-secondary",
  3: "text-[#b45309]",
};

function RankCell({ rank }: { rank: number }) {
  const color = TROPHY_COLOR[rank];
  return (
    <span className={cn("num flex items-center gap-1", rank <= 3 ? "font-bold" : "text-text-secondary")}>
      {color && <Trophy size={12} className={color} />}
      {rank}
    </span>
  );
}

export function LeaderboardTable({ entries, loading, error, onRetry, currentUserName }: LeaderboardTableProps) {
  const columns: GridColumn<LeaderboardEntry>[] = [
    { key: "rank", header: "Rank", width: 70, sortable: false, render: (v) => <RankCell rank={v as number} /> },
    { key: "display_name", header: "Username", width: "grow", format: "text" },
    { key: "total_value", header: "Value", width: 130, align: "right", format: "large" },
    { key: "return_pct", header: "Return %", width: 100, align: "right", format: "pct" },
  ];

  return (
    <VirtualGrid
      data={entries}
      columns={columns}
      sortable={false}
      getRowId={(row) => row.rank}
      loading={loading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No players yet."
      emptyDescription="Be the first to trade!"
      errorMessage="Could not load leaderboard."
      height={640}
      rowHeight={36}
    />
  );
}
