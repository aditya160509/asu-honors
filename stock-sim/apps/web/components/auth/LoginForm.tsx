"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/lib/api/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/components/layout/AuthContext";

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const { setHasToken } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          setHasToken(true);
          router.push("/market");
        },
      }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label className="text-small text-mkt-text-muted" htmlFor="email">Email</label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-small text-mkt-text-muted" htmlFor="password">Password</label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {login.isError && (
        <p className="text-small text-negative">
          {login.error instanceof ApiError && login.error.status === 401
            ? "Invalid credentials"
            : login.error instanceof Error
              ? login.error.message
              : "Login failed"}
        </p>
      )}
      <Button type="submit" disabled={login.isPending} className="mt-1">
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
