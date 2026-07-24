import { SearchX, ServerCrash, TelescopeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_ROW_HEIGHT, PINNED_COLUMN_WIDTH } from "@/lib/market/columns";
import type { ColumnDef, Density } from "@/lib/market/types";

export function ExplorerSkeleton({ columns, density }: { columns: ColumnDef[]; density: Density }) {
  const rowHeight = DEFAULT_ROW_HEIGHT[density];
  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex border-b border-[var(--term-divider)] bg-[var(--term-bg)]" style={{ height: 32 }}>
        <div style={{ width: PINNED_COLUMN_WIDTH }} className="flex items-center pl-2">
          <Skeleton width={60} height={10} />
        </div>
        {columns.map((c, i) => (
          <div key={i} style={{ width: c.width }} className="flex items-center px-3">
            <Skeleton width={Math.max(30, c.width - 24)} height={10} />
          </div>
        ))}
      </div>
      {Array.from({ length: 16 }).map((_, r) => (
        <div key={r} className="flex items-center border-b border-[var(--term-hairline)]" style={{ height: rowHeight }}>
          <div style={{ width: PINNED_COLUMN_WIDTH }} className="flex items-center gap-2 pl-2 pr-2">
            <Skeleton width={44} height={11} />
            <Skeleton width={90} height={9} />
          </div>
          {columns.map((c, i) => (
            <div key={i} style={{ width: c.width }} className="flex items-center justify-end px-3">
              <Skeleton width={Math.max(24, c.width - 32)} height={11} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ExplorerErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--term-down)]/10">
        <ServerCrash size={24} className="text-[color:var(--term-down)]" />
      </div>
      <p className="text-body font-medium text-[color:var(--term-ink)]">Couldn&apos;t load market data.</p>
      <p className="max-w-sm text-small text-[color:var(--term-ink-secondary)]">
        The screener couldn&apos;t reach the market feed. This module failed independently — the rest of the app is
        unaffected.
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Retry
        </Button>
      )}
    </div>
  );
}

export function ExplorerEmptyFiltered({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--term-bg)]">
        <SearchX size={22} className="text-[color:var(--term-ink-tertiary)]" />
      </div>
      <p className="text-body font-medium text-[color:var(--term-ink)]">No companies match this screen.</p>
      <p className="max-w-sm text-small text-[color:var(--term-ink-secondary)]">
        Try widening a range filter, clearing an industry pill, or resetting the screen entirely.
      </p>
      <Button variant="outline" size="sm" onClick={onReset} className="mt-1">
        Reset filters
      </Button>
    </div>
  );
}

export function ExplorerEmptyUniverse() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--term-bg)]">
        <TelescopeIcon size={22} className="text-[color:var(--term-accent)]" />
      </div>
      <p className="text-body font-medium text-[color:var(--term-ink)]">No companies loaded yet.</p>
      <p className="max-w-sm text-small text-[color:var(--term-ink-secondary)]">
        The simulated market hasn&apos;t been seeded. Run the seed data job to populate the screener.
      </p>
    </div>
  );
}
