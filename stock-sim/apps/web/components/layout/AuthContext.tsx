"use client";

import * as React from "react";
import { useMe } from "@/lib/api/hooks/useAuth";
import type { UserResponse } from "@/lib/api/types";

interface AuthContextValue {
  user: UserResponse | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  setHasToken: (hasToken: boolean) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = React.useState(false);

  React.useEffect(() => {
    setHasToken(Boolean(localStorage.getItem("token")));
  }, []);

  const { data: user, isLoading } = useMe(hasToken);

  const logout = React.useCallback(() => {
    localStorage.removeItem("token");
    setHasToken(false);
    window.location.href = "/login";
  }, []);

  const value = React.useMemo(
    () => ({ user, isLoading: hasToken && isLoading, isAuthenticated: Boolean(user), logout, setHasToken }),
    [user, isLoading, hasToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
