"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api/client";
import type { WatchlistAddRequest, WatchlistItem } from "@/lib/api/types";

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
