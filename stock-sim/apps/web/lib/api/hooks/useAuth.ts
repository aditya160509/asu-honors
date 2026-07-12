"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
import type { LoginRequest, TokenResponse, UserCreateRequest, UserResponse } from "@/lib/api/types";

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => get<UserResponse>("/auth/me"),
    enabled,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => post<TokenResponse>("/auth/login", body),
    onSuccess: (data) => {
      localStorage.setItem("token", data.access_token);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: UserCreateRequest) => post<UserResponse>("/auth/register", body),
  });
}
