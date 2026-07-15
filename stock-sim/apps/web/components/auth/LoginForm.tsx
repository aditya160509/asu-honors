"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { useLogin } from "@/lib/api/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/components/layout/AuthContext";
import { safeRedirectPath } from "@/lib/auth/redirect";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

type ServerError =
  | { kind: "credentials" }
  | { kind: "rate-limited"; retryAfter: number }
  | { kind: "server" }
  | null;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const { setHasToken } = useAuth();
  const [serverError, setServerError] = React.useState<ServerError>(null);
  const [retryRemaining, setRetryRemaining] = React.useState(0);

  const {
    register,
    handleSubmit,
    clearErrors,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "", remember: false },
  });

  // Live mono countdown for 429 responses; unlocks the submit button at zero.
  React.useEffect(() => {
    if (retryRemaining <= 0) return;
    const id = setInterval(() => setRetryRemaining((r) => (r > 1 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [retryRemaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- interval only needs to exist while counting

  function submit(values: LoginValues) {
    setServerError(null);
    return new Promise<void>((resolve) => {
      login.mutate(
        { email: values.email, password: values.password, remember: values.remember },
        {
          onSuccess: () => {
            setHasToken(true);
            const target = safeRedirectPath(searchParams.get("redirect"), "/market");
            router.push(target);
            resolve();
          },
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401) {
              setServerError({ kind: "credentials" });
            } else if (error instanceof ApiError && error.status === 403 && error.message === "email_unverified") {
              router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
            } else if (error instanceof ApiError && error.status === 429) {
              const after = error.retryAfterSeconds ?? 60;
              setServerError({ kind: "rate-limited", retryAfter: after });
              setRetryRemaining(after);
            } else {
              setServerError({ kind: "server" });
            }
            resolve();
          },
        }
      );
    });
  }

  const isWorking = isSubmitting || login.isPending;
  const isLocked = retryRemaining > 0;

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
        autoComplete="current-password"
        revealable
        error={errors.password?.message}
        labelAccessory={
          <Link
            href="/forgot-password"
            className="text-small text-mkt-signature hover:underline"
          >
            Forgot password?
          </Link>
        }
        {...register("password", {
          onChange: () => {
            // Clear the most common failure the instant the user starts retyping.
            if (errors.password) clearErrors("password");
          },
        })}
      />

      <label className="flex items-center gap-2.5 px-1 text-small text-mkt-text-muted cursor-pointer select-none">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[var(--mkt-signature)]"
          {...register("remember")}
        />
        Stay signed in for 30 days
      </label>

      {serverError?.kind === "credentials" && (
        <AuthBanner tone="warn">
          That email and password combination doesn&apos;t match our records.
        </AuthBanner>
      )}
      {serverError?.kind === "rate-limited" && (
        <AuthBanner tone="warn">
          Too many attempts.{" "}
          {retryRemaining > 0 ? (
            <>
              Try again in <span className="font-mono">{retryRemaining}</span> seconds.
            </>
          ) : (
            "You can try again now."
          )}
        </AuthBanner>
      )}
      {serverError?.kind === "server" && (
        <AuthBanner tone="warn">
          Something went wrong on our end. Please try again.{" "}
          <button
            type="button"
            onClick={() => submit(getValues())}
            className="underline hover:text-mkt-signature"
          >
            Retry
          </button>
        </AuthBanner>
      )}

      <button
        type="submit"
        disabled={isWorking || isLocked}
        className="mt-2 h-12 w-full rounded-full bg-mkt-signature text-[#0a0a0b] text-body font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {isWorking ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a0a0b] border-t-transparent align-middle"
            aria-label="Signing in"
          />
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
