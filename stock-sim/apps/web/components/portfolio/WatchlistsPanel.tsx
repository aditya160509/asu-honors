"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, GripVertical, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { DashboardPanel } from "@/components/dashboard/primitives/DashboardPanel";
import { CompanyRow } from "@/components/dashboard/primitives/CompanyRow";
import { MER_HAIRLINE } from "@/components/dashboard/primitives/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddWatchlistItem,
  useCreateWatchlistGroup,
  useDeleteWatchlistGroup,
  useRemoveWatchlistItem,
  useRenameWatchlistGroup,
  useReorderWatchlistItems,
  useWatchlistGroups,
} from "@/lib/api/hooks/useWatchlist";
import { useMarketGrid } from "@/lib/api/hooks/useMarket";
import { cn } from "@/lib/utils";
import type { CompanyGridItem, WatchlistGroupResponse } from "@/lib/api/types";

/**
 * C7 — Watchlists: full-page expansion of the Dashboard dock. Left rail of
 * named lists, main table reusing the dock's CompanyRow, ticker typeahead to
 * add, hover-reveal remove, and row-grip drag reordering persisted via
 * PUT /watchlists/{id}/order.
 */
export function WatchlistsPanel() {
  const groups = useWatchlistGroups();
  const market = useMarketGrid();
  const createGroup = useCreateWatchlistGroup();
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [newListName, setNewListName] = React.useState("");
  const [showNewList, setShowNewList] = React.useState(false);

  const groupList = groups.data ?? [];
  const selected = groupList.find((g) => g.id === selectedId) ?? groupList[0] ?? null;

  const handleCreate = () => {
    const name = newListName.trim();
    if (!name) return;
    createGroup.mutate(name, {
      onSuccess: (g) => {
        setSelectedId(g.id);
        setNewListName("");
        setShowNewList(false);
      },
    });
  };

  if (groups.isError) {
    return (
      <DashboardPanel eyebrow="Watchlists" title="Tracked Companies" icon={Star}>
        <ErrorState message="Could not load watchlists." onRetry={() => groups.refetch()} />
      </DashboardPanel>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <aside className="lg:col-span-3">
        <DashboardPanel eyebrow="Lists" title="Watchlists" icon={Star} noBodyPadding>
          <div className="flex flex-col p-2">
            {groups.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} width="100%" height={36} className="mb-1" />)
            ) : (
              <>
                {groupList.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    className={cn(
                      "relative flex items-center justify-between rounded-mer-sm px-3 py-2 text-left text-small transition-colors",
                      selected?.id === g.id
                        ? "bg-mer-surface-3 font-medium text-mer-ink-primary"
                        : "text-mer-ink-secondary hover:bg-mer-surface-3 hover:text-mer-ink-primary"
                    )}
                  >
                    {selected?.id === g.id && (
                      <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-mer-accent-500" />
                    )}
                    <span className="truncate">{g.name}</span>
                    <span className="num text-micro text-mer-ink-tertiary">{g.items.length}</span>
                  </button>
                ))}
                {showNewList ? (
                  <div className="mt-1 flex items-center gap-1 px-1">
                    <Input
                      autoFocus
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      placeholder="List name…"
                      className="h-7"
                      maxLength={60}
                    />
                    <Button variant="ghost" size="sm" onClick={handleCreate} aria-label="Create watchlist">
                      <Check size={13} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewList(false)} aria-label="Cancel">
                      <X size={13} />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNewList(true)}
                    className="mt-1 flex items-center gap-1.5 rounded-mer-sm px-3 py-2 text-small text-mer-ink-tertiary transition-colors hover:bg-mer-surface-3 hover:text-mer-ink-primary"
                  >
                    <Plus size={13} /> New watchlist
                  </button>
                )}
              </>
            )}
          </div>
        </DashboardPanel>
      </aside>

      <div className="lg:col-span-9">
        {selected ? (
          <WatchlistDetail group={selected} companies={market.data?.companies ?? []} loading={groups.isLoading} />
        ) : groups.isLoading ? (
          <Skeleton height={320} className="w-full" />
        ) : (
          <DashboardPanel eyebrow="Watchlist" title="Start tracking companies you care about" icon={Star}>
            <EmptyState
              icon={Star}
              title="Start tracking companies you care about"
              description="Create a watchlist on the left, then add tickers to keep an eye on them."
            />
          </DashboardPanel>
        )}
      </div>
    </div>
  );
}

function WatchlistDetail({
  group,
  companies,
  loading,
}: {
  group: WatchlistGroupResponse;
  companies: CompanyGridItem[];
  loading: boolean;
}) {
  const router = useRouter();
  const rename = useRenameWatchlistGroup();
  const deleteGroup = useDeleteWatchlistGroup();
  const addItem = useAddWatchlistItem();
  const removeItem = useRemoveWatchlistItem();
  const reorder = useReorderWatchlistItems();

  const [search, setSearch] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(group.name);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [localOrder, setLocalOrder] = React.useState<number[] | null>(null);

  React.useEffect(() => {
    // Server order wins whenever the group content changes.
    setLocalOrder(null);
    setRenameValue(group.name);
  }, [group.id, group.items, group.name]);

  const byId = new Map(companies.map((c) => [c.ticker, c]));
  const inList = new Set(group.items.map((i) => i.company_id));
  const companyIdByTicker = new Map<string, number>();
  for (const item of group.items) companyIdByTicker.set(item.ticker, item.company_id);

  const orderedItems = React.useMemo(() => {
    if (!localOrder) return group.items;
    const map = new Map(group.items.map((i) => [i.company_id, i]));
    return localOrder.map((id) => map.get(id)).filter((i): i is NonNullable<typeof i> => i != null);
  }, [group.items, localOrder]);

  const matches = search.trim()
    ? companies
        .filter(
          (c) =>
            !inList.has(companyIdFor(c, group)) &&
            (c.ticker.toLowerCase().includes(search.trim().toLowerCase()) ||
              c.name.toLowerCase().includes(search.trim().toLowerCase()))
        )
        .slice(0, 8)
    : [];

  const handleDrop = (targetIndex: number) => {
    if (dragIndex == null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const ids = orderedItems.map((i) => i.company_id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(targetIndex, 0, moved);
    setLocalOrder(ids);
    setDragIndex(null);
    reorder.mutate({ groupId: group.id, companyIds: ids });
  };

  return (
    <DashboardPanel
      eyebrow={`${group.items.length} tracked`}
      title={group.name}
      icon={Star}
      noBodyPadding
      actions={
        <div className="flex items-center gap-1">
          {renaming ? (
            <>
              <Input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameValue.trim()) {
                    rename.mutate({ groupId: group.id, name: renameValue.trim() }, { onSuccess: () => setRenaming(false) });
                  }
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="h-7 w-40"
                maxLength={60}
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Save name"
                onClick={() =>
                  renameValue.trim() &&
                  rename.mutate({ groupId: group.id, name: renameValue.trim() }, { onSuccess: () => setRenaming(false) })
                }
              >
                <Check size={13} />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" aria-label="Rename watchlist" onClick={() => setRenaming(true)}>
                <Pencil size={13} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Delete watchlist"
                onClick={() => {
                  if (window.confirm(`Delete watchlist "${group.name}"? Its tickers are not deleted from the market.`)) {
                    deleteGroup.mutate(group.id);
                  }
                }}
              >
                <Trash2 size={13} />
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className={cn("relative border-b px-4 py-2.5", MER_HAIRLINE)}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Add a ticker — search by symbol or name…"
          className="h-8"
          autoFocus={group.items.length === 0}
          aria-label="Search companies to add"
        />
        {matches.length > 0 && (
          <div
            className={cn(
              "absolute inset-x-4 top-full z-20 mt-1 flex flex-col overflow-hidden rounded-mer-sm border bg-mer-surface-3 shadow-mer-raised",
              "border-[color:var(--mer-stroke-emphasis)]"
            )}
          >
            {matches.map((c) => (
              <button
                key={c.ticker}
                type="button"
                className="flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-mer-surface-4"
                onClick={() => {
                  const companyId = companyIdFor(c, group);
                  addItem.mutate({ groupId: group.id, companyId });
                  setSearch("");
                }}
              >
                <span className="num text-small font-bold uppercase text-mer-ink-primary">{c.ticker}</span>
                <span className="truncate pl-3 text-micro text-mer-ink-tertiary">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-1.5 p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={40} />
          ))}
        </div>
      ) : orderedItems.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Start tracking companies you care about"
          description="Add tickers with the search box above to keep an eye on them."
        />
      ) : (
        <div className="flex flex-col gap-0.5 p-2">
          {orderedItems.map((item, index) => {
            const c = byId.get(item.ticker);
            return (
              <div
                key={item.company_id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => setDragIndex(null)}
                className={cn("group flex items-center gap-1", dragIndex === index && "opacity-50")}
              >
                <span
                  className="cursor-grab p-1 text-mer-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Drag to reorder"
                >
                  <GripVertical size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <CompanyRow
                    ticker={item.ticker}
                    name={item.name}
                    price={c?.current_price != null ? Number(c.current_price) : null}
                    changePct={c?.day_change_pct ?? null}
                    rightSlot={
                      <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Trade ${item.ticker}`}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/companies/${item.ticker}`);
                          }}
                        >
                          <Plus size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${item.ticker} from ${group.name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            removeItem.mutate({ groupId: group.id, companyId: item.company_id });
                          }}
                        >
                          <X size={13} />
                        </Button>
                      </span>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}

function companyIdFor(company: CompanyGridItem, group: WatchlistGroupResponse): number {
  const existing = group.items.find((i) => i.ticker === company.ticker);
  return existing ? existing.company_id : company.id;
}
