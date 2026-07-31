"use client";

import * as React from "react";
import { useMe } from "@/lib/api/hooks/useAuth";
import { post } from "@/lib/api/client";
import type { UserResponse } from "@/lib/api/types";

interface AuthContextValue {
  user: UserResponse | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDefinitivelyUnauthenticated: boolean;
  logout: () => void;
  setHasToken: (hasToken: boolean) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = React.useState(false);
  const [tokenChecked, setTokenChecked] = React.useState(false);
  React.useEffect(() => {
    setHasToken(Boolean(localStorage.getItem("token")));
    setTokenChecked(true);
  }, []);
  const { data: user, isLoading: meLoading } = useMe(hasToken);
  const logout = React.useCallback(() => {
    void post("/auth/logout").catch(() => undefined).finally(() => {
      localStorage.removeItem("token");
      document.cookie = "mv_session=; path=/; max-age=0";
      setHasToken(false);
      window.location.href = "/login";
    });
  }, []);
  const value = React.useMemo(() => ({
    user,
    isLoading: !tokenChecked || (hasToken && meLoading),
    isAuthenticated: Boolean(user),
    isDefinitivelyUnauthenticated: tokenChecked && (!hasToken || (!meLoading && !user)),
    logout,
    setHasToken,
  }), [user, tokenChecked, hasToken, meLoading, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
