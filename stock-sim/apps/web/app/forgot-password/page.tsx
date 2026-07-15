"use client";

import * as React from "react";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { useForgotPassword } from "@/lib/api/hooks/useAuth";
import { useResendCooldown } from "@/lib/auth/useResendCooldown";

const RESEND_COOLDOWN_SECONDS = 30;

const forgotSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

type ForgotValues = z.infer<typeof forgotSchema>;

function ForgotPasswordContent() {
  const forgot = useForgotPassword();
  const cooldown = useResendCooldown(RESEND_COOLDOWN_SECONDS);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  function send(email: string, onDone?: () => void) {
    setServerError(false);
    forgot.mutate(
      { email },
      {
        onSuccess: () => {
          setSentTo(email);
          cooldown.start();
          onDone?.();
        },
        onError: () => {
          // Rate-limited or server error — same neutral treatment either way,
          // never revealing whether the account exists.
          setServerError(true);
          onDone?.();
        },
      }
    );
  }

  function submit(values: ForgotValues) {
    return new Promise<void>((resolve) => send(values.email, resolve));
  }

  // Step 2 — confirmation state replaces the form in place.
  if (sentTo) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <CheckCircle2 size={24} className="text-mkt-signature" aria-hidden />
        <h1 className="text-mkt-text-hero text-h1 font-semibold">Check your email</h1>
        <p className="text-small text-mkt-text-muted">
          If an account exists for <strong className="text-mkt-text-hero">{sentTo}</strong>, we&apos;ve
          sent a link to reset your password. The link expires in 15 minutes.
        </p>
        {serverError && (
          <AuthBanner tone="warn">Something went wrong on our end. Please try again.</AuthBanner>
        )}
        <button
          type="button"
          onClick={() => send(sentTo)}
          disabled={cooldown.isCoolingDown || forgot.isPending}
          className="h-12 w-full rounded-full border border-white/10 bg-white/5 text-body font-semibold text-mkt-text-hero hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {cooldown.isCoolingDown ? (
            <>
              Resend in <span className="font-mono">{cooldown.label}</span>
            </>
          ) : (
            "Resend email"
          )}
        </button>
        <Link href="/login" className="self-center text-small text-mkt-text-muted hover:text-mkt-text-hero">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-mkt-text-hero text-h1 font-semibold">Reset your password</h1>
        <p className="text-small text-mkt-text-muted">
          Enter the email associated with your account and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      <AuthInput
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="username"
        autoFocus
        error={errors.email?.message}
        {...register("email")}
      />

      {serverError && (
        <AuthBanner tone="warn">Something went wrong on our end. Please try again.</AuthBanner>
      )}

      <button
        type="submit"
        disabled={forgot.isPending}
        className="mt-2 h-12 w-full rounded-full bg-mkt-signature text-[#0a0a0b] text-body font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {forgot.isPending ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a0a0b] border-t-transparent align-middle"
            aria-label="Sending"
          />
        ) : (
          "Send reset link"
        )}
      </button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordContent />
    </AuthShell>
  );
}
