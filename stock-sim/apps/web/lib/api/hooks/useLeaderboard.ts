"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api/client";
import type { LeaderboardEntry } from "@/lib/api/types";

export function useLeaderboard(timelineId?: number, limit = 25, offset = 0) {
  return useQuery({
    queryKey: ["leaderboard", timelineId, limit, offset],
    queryFn: () => get<LeaderboardEntry[]>("/leaderboard", { timeline_id: timelineId, limit, offset }),
    staleTime: 30_000,
  });
}
