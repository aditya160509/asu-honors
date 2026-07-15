"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "@/lib/api/client";
import type { GoalCreateRequest, GoalResponse, GoalUpdateRequest } from "@/lib/api/types";

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => get<GoalResponse[]>("/goals"),
    staleTime: 30_000,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GoalCreateRequest) => post<GoalResponse>("/goals", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: GoalUpdateRequest }) =>
      patch<GoalResponse>(`/goals/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => del(`/goals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}
