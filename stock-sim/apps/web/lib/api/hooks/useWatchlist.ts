"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post, put } from "@/lib/api/client";
import type { WatchlistAddRequest, WatchlistGroupResponse, WatchlistItem } from "@/lib/api/types";

export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: () => get<WatchlistItem[]>("/watchlist"),
    staleTime: 30_000,
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: WatchlistAddRequest) => post<WatchlistItem>("/watchlist", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId: number) => del(`/watchlist/${companyId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

// ---------------------------------------------------------------------------
// Named watchlist groups (Phase 2). The flat hooks above stay for the
// Dashboard dock, which operates on the user's default group.
// ---------------------------------------------------------------------------

const GROUPS_KEY = ["watchlist-groups"];

/** Invalidate both shapes — the flat default-group view mirrors group content. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
  queryClient.invalidateQueries({ queryKey: ["watchlist"] });
}

export function useWatchlistGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: () => get<WatchlistGroupResponse[]>("/watchlists"),
    staleTime: 30_000,
  });
}

export function useCreateWatchlistGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => post<WatchlistGroupResponse>("/watchlists", { name }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRenameWatchlistGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, name }: { groupId: number; name: string }) =>
      patch<WatchlistGroupResponse>(`/watchlists/${groupId}`, { name }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteWatchlistGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: number) => del(`/watchlists/${groupId}`),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useAddWatchlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, companyId }: { groupId: number; companyId: number }) =>
      post<WatchlistGroupResponse>(`/watchlists/${groupId}/items`, { company_id: companyId }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useRemoveWatchlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, companyId }: { groupId: number; companyId: number }) =>
      del(`/watchlists/${groupId}/items/${companyId}`),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useReorderWatchlistItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, companyIds }: { groupId: number; companyIds: number[] }) =>
      put<WatchlistGroupResponse>(`/watchlists/${groupId}/order`, { company_ids: companyIds }),
    onSuccess: () => invalidateAll(queryClient),
  });
}
