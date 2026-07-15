"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { OTPInput } from "@/components/auth/OTPInput";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { useOtpRequest, useOtpVerify } from "@/lib/api/hooks/useAuth";
import { useResendCooldown } from "@/lib/auth/useResendCooldown";

const FLASH_MS = 240;
const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "expired" }
  | { kind: "locked" };

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const verify = useOtpVerify();
  const resend = useOtpRequest();
  const cooldown = useResendCooldown(RESEND_COOLDOWN_SECONDS);

  const [code, setCode] = React.useState("");
  const [state, setState] = React.useState<VerifyState>({ kind: "idle" });
  const [flashError, setFlashError] = React.useState(false);

  // Registration just sent a code — start the resend cooldown immediately.
  const startCooldown = cooldown.start;
  React.useEffect(() => {
    startCooldown();
  }, [startCooldown]);

  function handleComplete(fullCode: string) {
    if (verify.isPending || state.kind === "locked") return;
    verify.mutate(
      { purpose: "register", code: fullCode, email },
      {
        onSuccess: (result) => {
          if (result.verified) {
            router.push("/login?verified=1");
            return;
          }
          if (result.reason === "expired") {
            setState({ kind: "expired" });
            cooldown.reset(); // no valid code to fall back on — resend immediately
          } else if (result.reason === "locked") {
            setState({ kind: "locked" });
            cooldown.reset();
          } else {
            const n = result.attempts_remaining ?? 0;
            setState({
              kind: "error",
              message: `That code isn't right. ${n} attempt${n === 1 ? "" : "s"} remaining.`,
            });
            setFlashError(true);
            setTimeout(() => {
              setFlashError(false);
              setCode("");
            }, FLASH_MS);
          }
        },
        onError: () => {
          setState({ kind: "error", message: "Something went wrong. Please try again." });
        },
      }
    );
  }

  function handleResend() {
    if (cooldown.isCoolingDown || resend.isPending) return;
    resend.mutate(
      { purpose: "register", email },
      {
        onSuccess: () => {
          setState({ kind: "idle" });
          setCode("");
          cooldown.start();
        },
      }
    );
  }

  if (!email) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-mkt-text-hero text-h1 font-semibold">Invalid verification link</h1>
        <p className="text-small text-mkt-text-muted">
          This verification link is missing required information.
        </p>
        <button
          type="button"
          onClick={() => router.push("/register")}
          className="self-start text-small text-mkt-signature hover:underline"
        >
          Back to sign up
        </button>
      </div>
    );
  }

  const isLocked = state.kind === "locked";

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-mkt-text-hero text-h1 font-semibold">Enter verification code</h1>
        <p className="text-small text-mkt-text-muted">
          We sent a 6-digit code to <strong className="text-mkt-text-hero">{maskEmail(email)}</strong>.
        </p>
      </div>

      <OTPInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (state.kind === "error") setState({ kind: "idle" });
        }}
        onComplete={handleComplete}
        disabled={verify.isPending || isLocked}
        hasError={flashError}
        autoFocusFirst
      />

      {state.kind === "error" && (
        <p className="text-center text-micro text-warning" role="alert">
          {state.message}
        </p>
      )}
      {state.kind === "expired" && (
        <p className="text-center text-micro text-warning" role="alert">
          This code has expired.
        </p>
      )}
      {isLocked && (
        <AuthBanner tone="warn">
          Too many incorrect attempts. Request a new code to try again.
        </AuthBanner>
      )}

      <button
        type="button"
        onClick={() => code.length === 6 && handleComplete(code)}
        disabled={code.length !== 6 || verify.isPending || isLocked}
        className="h-12 w-full rounded-full bg-mkt-signature text-[#0a0a0b] text-body font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {verify.isPending ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a0a0b] border-t-transparent align-middle"
            aria-label="Verifying"
          />
        ) : (
          "Verify"
        )}
      </button>

      <p className="text-center text-small text-mkt-text-muted">
        Didn&apos;t get a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown.isCoolingDown || resend.isPending}
          className="text-mkt-signature hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {cooldown.isCoolingDown ? (
            <>
              Resend in <span className="font-mono">{cooldown.label}</span>
            </>
          ) : (
            "Resend"
          )}
        </button>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
