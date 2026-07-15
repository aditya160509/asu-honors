"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { useResetPassword } from "@/lib/api/hooks/useAuth";
import { ApiError } from "@/lib/api/client";

// Matches registration's rule (8-char minimum) — deliberately consistent.
const resetSchema = z
  .object({
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetValues = z.infer<typeof resetSchema>;

function InvalidLinkCard({ title, body }: { title: string; body: string }) {
  const router = useRouter();
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <TriangleAlert size={24} className="text-warning" aria-hidden />
      <h1 className="text-mkt-text-hero text-h1 font-semibold">{title}</h1>
      <p className="text-small text-mkt-text-muted">{body}</p>
      <button
        type="button"
        onClick={() => router.push("/forgot-password")}
        className="h-12 w-full rounded-full border border-white/10 bg-white/5 text-body font-semibold text-mkt-text-hero hover:bg-white/10 transition-colors"
      >
        Request a new link
      </button>
    </div>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const reset = useResetPassword();
  const [tokenRejected, setTokenRejected] = React.useState(false);
  const [serverError, setServerError] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    mode: "onTouched",
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const newPasswordValue = watch("newPassword");
  const passwordSatisfied = newPasswordValue.length >= 8;

  if (!token) {
    return (
      <InvalidLinkCard
        title="Invalid reset link"
        body="This password reset link is missing required information."
      />
    );
  }

  if (tokenRejected) {
    return (
      <InvalidLinkCard
        title="Invalid reset link"
        body="This reset link has expired or already been used."
      />
    );
  }

  function submit(values: ResetValues) {
    setServerError(false);
    return new Promise<void>((resolve) => {
      reset.mutate(
        { token: token as string, new_password: values.newPassword },
        {
          onSuccess: () => {
            router.push("/login?reset=1");
            resolve();
          },
          onError: (error) => {
            if (error instanceof ApiError && error.status === 400) {
              setTokenRejected(true);
            } else {
              setServerError(true);
            }
            resolve();
          },
        }
      );
    });
  }

  const isWorking = isSubmitting || reset.isPending;

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-mkt-text-hero text-h1 font-semibold">Choose a new password</h1>
        <p className="text-small text-mkt-text-muted">
          You&apos;ll be signed out everywhere once your password is updated.
        </p>
      </div>

      <AuthInput
        type="password"
        label="New password"
        placeholder="New password"
        autoComplete="new-password"
        autoFocus
        revealable
        error={errors.newPassword?.message}
        hint={
          <span
            className={passwordSatisfied ? "flex items-center gap-1 text-mkt-signature" : undefined}
          >
            {passwordSatisfied && <CheckCircle2 size={12} aria-hidden />}
            At least 8 characters
          </span>
        }
        {...register("newPassword")}
      />
      <AuthInput
        type="password"
        label="Confirm password"
        placeholder="Confirm new password"
        autoComplete="new-password"
        revealable
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      {serverError && (
        <AuthBanner tone="warn">Something went wrong on our end. Please try again.</AuthBanner>
      )}

      <button
        type="submit"
        disabled={isWorking}
        className="mt-2 h-12 w-full rounded-full bg-mkt-signature text-[#0a0a0b] text-body font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {isWorking ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a0a0b] border-t-transparent align-middle"
            aria-label="Resetting password"
          />
        ) : (
          "Reset password"
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
