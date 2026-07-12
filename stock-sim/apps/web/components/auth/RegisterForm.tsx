"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/lib/api/hooks/useAuth";

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password, setPassword] = React.useState("");

  const passwordTooShort = password.length > 0 && password.length < 8;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordTooShort) return;
    register.mutate(
      { email, password, display_name: displayName },
      { onSuccess: () => router.push("/login?registered=1") }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label className="text-small text-mkt-text-muted" htmlFor="displayName">Display name</label>
        <Input id="displayName" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-small text-mkt-text-muted" htmlFor="email">Email</label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-small text-mkt-text-muted" htmlFor="password">Password</label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        {passwordTooShort && <p className="text-micro text-negative">Password must be at least 8 characters</p>}
      </div>
      {register.isError && (
        <p className="text-small text-negative">
          {register.error instanceof Error ? register.error.message : "Registration failed"}
        </p>
      )}
      <Button type="submit" disabled={register.isPending || passwordTooShort} className="mt-1">
        {register.isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
