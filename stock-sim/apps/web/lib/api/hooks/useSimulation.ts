"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
import type {
  AdvanceRequest,
  AdvanceResponse,
  SimulationStateResponse,
  TimelineCreateRequest,
  TimelineResponse,
} from "@/lib/api/types";

export function useSimState(timelineId?: number) {
  return useQuery({
    queryKey: ["sim-state", timelineId],
    queryFn: () => get<SimulationStateResponse>("/sim/state", { timeline_id: timelineId }),
    staleTime: 5000,
  });
}

export function useTimelines() {
  return useQuery({
    queryKey: ["timelines"],
    queryFn: () => get<TimelineResponse[]>("/sim/timelines"),
    staleTime: 30_000,
  });
}

export function useAdvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AdvanceRequest) => post<AdvanceResponse>("/sim/advance", body),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useCreateTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TimelineCreateRequest) => post<TimelineResponse>("/sim/timelines", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timelines"] });
    },
  });
}
