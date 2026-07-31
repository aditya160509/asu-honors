"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthBanner } from "@/components/auth/AuthBanner";
import { LoginForm } from "@/components/auth/LoginForm";

function LoginNotices() {
  const params = useSearchParams();
  const registered = params.get("registered");
  const expired = params.get("expired");
  const reset = params.get("reset");
  const verified = params.get("verified");

  if (!registered && !expired && !reset && !verified) return null;

  return (
    <div className="mb-5 flex w-full max-w-sm flex-col gap-2">
      {registered && <AuthBanner tone="accent">Account created. Sign in to get started.</AuthBanner>}
      {verified && <AuthBanner tone="accent">Email verified. Sign in to get started.</AuthBanner>}
      {reset && <AuthBanner tone="accent">Password updated. Sign in with your new password.</AuthBanner>}
      {expired && <AuthBanner tone="warn">Your session expired. Sign in again to continue.</AuthBanner>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="mb-7 flex flex-col gap-1">
        <h1 className="text-mkt-text-hero text-h1 font-semibold">Welcome Back</h1>
        <p className="text-small text-mkt-text-muted">Enter your credentials to access the terminal.</p>
      </div>
      <Suspense fallback={null}>
        <LoginNotices />
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
