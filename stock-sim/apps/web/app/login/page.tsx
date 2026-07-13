"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

function LoginNotices() {
  const params = useSearchParams();
  const registered = params.get("registered");
  const expired = params.get("expired");

  if (!registered && !expired) return null;

  return (
    <div className="mb-5 flex flex-col gap-1">
      {registered && <p className="text-small text-positive">Account created — sign in below.</p>}
      {expired && <p className="text-small text-warning">Session expired — sign in again.</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Enter your credentials to access the terminal."
      footer={
        <>
          No account?{" "}
          <Link href="/register" className="text-text-link">
            Register
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginNotices />
      </Suspense>
      <LoginForm />
    </AuthShell>
  );
}
