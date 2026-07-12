"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api/client";
import type {
  ConfigParameterResponse,
  ConfigUpdateRequest,
  EventInjectRequest,
  EventInstanceResponse,
} from "@/lib/api/types";

export function useConfigParameters(scope?: string, scopeId?: number) {
  return useQuery({
    queryKey: ["admin-config", scope, scopeId],
    queryFn: () => get<ConfigParameterResponse[]>("/sim/admin/config", { scope, scope_id: scopeId }),
    staleTime: 30_000,
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ConfigUpdateRequest) => put<ConfigParameterResponse>("/sim/admin/config", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-config"] }),
  });
}

export function useInjectEvent() {
  return useMutation({
    mutationFn: (body: EventInjectRequest) => post<EventInstanceResponse>("/sim/admin/events", body),
  });
}
