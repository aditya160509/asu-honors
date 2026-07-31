"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { useLogin, useRegister } from "@/lib/api/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/components/layout/AuthContext";

const registerSchema = z
  .object({
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const registerMutation = useRegister();
  const loginMutation = useLogin();
  const { setHasToken } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password");
  const passwordSatisfied = passwordValue.length >= 8;

  async function submit(values: RegisterValues) {
    setServerError(null);
    let accountCreated = false;
    try {
      await registerMutation.mutateAsync({ email: values.email, password: values.password });
      accountCreated = true;
      await loginMutation.mutateAsync({
        email: values.email,
        password: values.password,
        remember: true,
      });
      setHasToken(true);
      router.replace("/market");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setServerError("An account with this email already exists. Try signing in instead.");
      } else if (error instanceof ApiError && error.status === 403 && error.message === "email_unverified") {
        router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
      } else {
        setServerError(
          accountCreated
            ? "Your account was created, but automatic sign-in failed. Please try again."
            : "Something went wrong on our end. Please try again."
        );
      }
    }
  }

  const isWorking = isSubmitting || registerMutation.isPending || loginMutation.isPending;

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4 w-full max-w-sm">
      <AuthInput
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="username"
        autoFocus
        error={errors.email?.message}
        {...register("email")}
      />
      <AuthInput
        type="password"
        label="Password"
        placeholder="Password"
        autoComplete="new-password"
        revealable
        error={errors.password?.message}
        hint={
          <span
            className={
              passwordSatisfied ? "flex items-center gap-1 text-mkt-signature" : undefined
            }
          >
            {passwordSatisfied && <CheckCircle2 size={12} aria-hidden />}
            At least 8 characters
          </span>
        }
        {...register("password")}
      />
      <AuthInput
        type="password"
        label="Confirm password"
        placeholder="Confirm Password"
        autoComplete="new-password"
        revealable
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      {serverError && <AuthBanner tone="warn">{serverError}</AuthBanner>}

      <button
        type="submit"
        disabled={isWorking}
        className="mt-2 h-12 w-full rounded-full bg-mkt-signature text-[#0a0a0b] text-body font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {isWorking ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a0a0b] border-t-transparent align-middle"
            aria-label="Creating account"
          />
        ) : (
          "Create an Account"
        )}
      </button>
    </form>
  );
}
