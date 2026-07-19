"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api/client";
import type {
  AdvanceRequest,
  AdvanceResponse,
  AuditLogEntryResponse,
  BranchCostEstimateResponse,
  DistributionResponse,
  ScenarioTemplateCreateRequest,
  ScenarioTemplateResponse,
  SimulationStateResponse,
  TimelineCreateRequest,
  TimelineDiffResponse,
  TimelineExtendRequest,
  TimelineGroupResponse,
  TimelineResponse,
  TimelineStatusResponse,
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
    // A branch's fast-forward job runs async (Celery) -- without this, the
    // only place that ever refreshed a branch's status was the wizard's own
    // useTimelineStatus poll while its dialog stayed open. Closing the
    // dialog (or never opening it, e.g. after a page reload) froze every
    // pending/running branch's displayed status until the 30s staleTime
    // happened to lapse and something else triggered a refetch -- so
    // TimelineBranch's list could show "pending" long after a branch had
    // actually finished or failed. Poll every 2s (matching
    // useTimelineStatus's cadence) whenever any listed timeline is still
    // pending/running, so the list stays live wherever it's rendered.
    refetchInterval: (query) => {
      const timelines = query.state.data;
      const hasInFlight = timelines?.some((t) => t.status === "pending" || t.status === "running");
      return hasInFlight ? 2000 : false;
    },
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

export function useBranchCostEstimate(parentTimelineId: number | null, fastForwardDays: number) {
  return useQuery({
    queryKey: ["branch-cost-estimate", parentTimelineId, fastForwardDays],
    queryFn: () =>
      get<BranchCostEstimateResponse>("/sim/timelines/estimate-cost", {
        parent_timeline_id: parentTimelineId,
        fast_forward_days: fastForwardDays,
      }),
    enabled: parentTimelineId !== null,
  });
}

export function useTimelineStatus(timelineId: number | undefined, options?: { pollWhilePending?: boolean }) {
  return useQuery({
    queryKey: ["timeline-status", timelineId],
    queryFn: () => get<TimelineStatusResponse>(`/sim/timelines/${timelineId}/status`),
    enabled: timelineId !== undefined,
    // Branch fast-forward jobs run async (Celery) -- poll every 2s while a
    // status query result is still pending/running so the wizard's confirm
    // step can show live progress without the caller having to wire up
    // its own interval.
    refetchInterval: (query) => {
      if (!options?.pollWhilePending) return false;
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2000 : false;
    },
  });
}

export function useTimelineDiff(timelineId: number | undefined, vsTimelineId: number | undefined) {
  return useQuery({
    queryKey: ["timeline-diff", timelineId, vsTimelineId],
    queryFn: () => get<TimelineDiffResponse>(`/sim/timelines/${timelineId}/diff`, { vs: vsTimelineId }),
    enabled: timelineId !== undefined && vsTimelineId !== undefined,
  });
}

export function useExtendTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ timelineId, days }: { timelineId: number; days: number }) =>
      post<TimelineResponse>(`/sim/timelines/${timelineId}/extend`, { days } satisfies TimelineExtendRequest),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["timelines"] });
      queryClient.invalidateQueries({ queryKey: ["timeline-status", variables.timelineId] });
    },
  });
}

export function useDeleteTimeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (timelineId: number) => del<TimelineResponse>(`/sim/timelines/${timelineId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timelines"] });
    },
  });
}

export function useTimelineGroup(groupId: number | undefined) {
  return useQuery({
    queryKey: ["timeline-group", groupId],
    queryFn: () => get<TimelineGroupResponse>(`/sim/timeline-groups/${groupId}`),
    enabled: groupId !== undefined,
  });
}

export function useTimelineGroupDistribution(groupId: number | undefined, metric: string = "portfolio_return") {
  return useQuery({
    queryKey: ["timeline-group-distribution", groupId, metric],
    queryFn: () => get<DistributionResponse>(`/sim/timeline-groups/${groupId}/distribution`, { metric }),
    enabled: groupId !== undefined,
  });
}

export function useScenarioLibrary() {
  return useQuery({
    queryKey: ["scenario-library"],
    queryFn: () => get<ScenarioTemplateResponse[]>("/sim/scenario-library"),
    staleTime: 60_000,
  });
}

export function useCreateScenarioTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ScenarioTemplateCreateRequest) =>
      post<ScenarioTemplateResponse>("/sim/scenario-library", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenario-library"] });
    },
  });
}

export function useAuditLog(timelineId?: number) {
  return useQuery({
    queryKey: ["audit-log", timelineId],
    queryFn: () => get<AuditLogEntryResponse[]>("/audit-log", { timeline_id: timelineId }),
  });
}
