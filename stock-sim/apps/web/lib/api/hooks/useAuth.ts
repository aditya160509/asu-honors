"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, get, post } from "@/lib/api/client";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponse,
  OtpRequestBody,
  OtpVerifyBody,
  OtpVerifyResponse,
  ResetPasswordRequest,
  TokenResponse,
  UserCreateRequest,
  UserResponse,
} from "@/lib/api/types";

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => get<UserResponse>("/auth/me"),
    enabled,
    // A real 401 means the session is actually gone — client.ts has already
    // tried a silent refresh before this error surfaces, so retrying here
    // would just repeat a known-final answer. Anything else (429 rate limit,
    // a network blip, a transient 5xx) is worth retrying rather than treating
    // as "logged out" — see AuthContext.tsx's isDefinitivelyUnauthenticated.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false;
      return failureCount < 3;
    },
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

export function useLogout() {
  return useMutation({
    mutationFn: () => post<MessageResponse>("/auth/logout"),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: ForgotPasswordRequest) =>
      post<MessageResponse>("/auth/forgot-password", body),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: ResetPasswordRequest) =>
      post<MessageResponse>("/auth/reset-password", body),
  });
}

export function useOtpRequest() {
  return useMutation({
    mutationFn: (body: OtpRequestBody) => post<MessageResponse>("/auth/otp/request", body),
  });
}

export function useOtpVerify() {
  return useMutation({
    mutationFn: (body: OtpVerifyBody) => post<OtpVerifyResponse>("/auth/otp/verify", body),
  });
}
