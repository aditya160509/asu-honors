"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { useRegister } from "@/lib/api/hooks/useAuth";
import { ApiError } from "@/lib/api/client";

const registerSchema = z
  .object({
    displayName: z.string().trim().min(1, "Display name is required"),
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
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password");
  const passwordSatisfied = passwordValue.length >= 8;

  function submit(values: RegisterValues) {
    setServerError(null);
    return new Promise<void>((resolve) => {
      registerMutation.mutate(
        { email: values.email, password: values.password, display_name: values.displayName },
        {
          onSuccess: () => {
            // Email verification is mandatory: the API already sent the first code.
            router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
            resolve();
          },
          onError: (error) => {
            if (error instanceof ApiError && error.status === 409) {
              setServerError("An account with this email already exists. Try signing in instead.");
            } else {
              setServerError("Something went wrong on our end. Please try again.");
            }
            resolve();
          },
        }
      );
    });
  }

  const isWorking = isSubmitting || registerMutation.isPending;

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4 w-full max-w-sm">
      <AuthInput
        label="Display name"
        placeholder="Display Name"
        autoComplete="name"
        autoFocus
        error={errors.displayName?.message}
        {...register("displayName")}
      />
      <AuthInput
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="username"
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
