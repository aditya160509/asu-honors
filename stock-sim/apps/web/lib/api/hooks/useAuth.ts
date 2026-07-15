"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api/client";
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
