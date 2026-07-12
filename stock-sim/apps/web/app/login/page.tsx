"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";

function LoginNotices() {
  const params = useSearchParams();
  const registered = params.get("registered");
  const expired = params.get("expired");

  return (
    <>
      {registered && <p className="text-small text-positive">Account created — sign in below.</p>}
      {expired && <p className="text-small text-warning">Session expired — sign in again.</p>}
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-mkt-bg-void flex flex-col items-center justify-center gap-6 px-6">
      <Link href="/" className="text-mkt-text-hero text-h2 font-semibold tracking-tight">
        Stock Sim
      </Link>
      <Suspense fallback={null}>
        <LoginNotices />
      </Suspense>
      <LoginForm />
      <p className="text-small text-mkt-text-muted">
        No account?{" "}
        <Link href="/register" className="text-text-link">
          Register
        </Link>
      </p>
    </main>
  );
}
