"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "@/lib/api/client";
import type { OrderRequest, OrderResponse } from "@/lib/api/types";

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (order: OrderRequest) => post<OrderResponse>("/orders", order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["market"] });
      queryClient.invalidateQueries({ queryKey: ["company"] });
    },
  });
}
