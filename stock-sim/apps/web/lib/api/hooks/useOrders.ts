"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "@/lib/api/client";
import type { OrderRequest, OrderResponse, OrderStatus } from "@/lib/api/types";

const ORDER_QUERY_KEYS = [
  ["portfolio"],
  ["portfolio-analytics"],
  ["transactions"],
  ["orders"],
  ["market"],
  ["company"],
] as const;

function invalidateOrderQueries(queryClient: ReturnType<typeof useQueryClient>) {
  ORDER_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (order: OrderRequest) => post<OrderResponse>("/orders", order),
    onSuccess: () => invalidateOrderQueries(queryClient),
  });
}

/** Open orders / filled orders / order history are all this one endpoint with a status filter. */
export function useOrders(status?: OrderStatus, timelineId?: number) {
  return useQuery({
    queryKey: ["orders", status, timelineId],
    queryFn: () => get<OrderResponse[]>("/orders", { status, timeline_id: timelineId }),
    refetchInterval: status === "open" ? 5000 : undefined,
    staleTime: 3000,
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) => del<OrderResponse>(`/orders/${orderId}`),
    onSuccess: () => invalidateOrderQueries(queryClient),
  });
}
