"use client";

import * as React from "react";
import { useMe } from "@/lib/api/hooks/useAuth";
import { logActivity } from "@/lib/activity/useActivityLog";
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

  const prevUserRef = React.useRef<UserResponse | undefined>(undefined);
  React.useEffect(() => {
    if (!prevUserRef.current && user) {
      logActivity({ kind: "auth", label: `Signed in as ${user.display_name}` });
    }
    prevUserRef.current = user;
  }, [user]);

  const logout = React.useCallback(() => {
    logActivity({ kind: "auth", label: "Signed out" });
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
