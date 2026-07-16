"use client";

import * as React from "react";
import { useMe } from "@/lib/api/hooks/useAuth";
import { ApiError, post } from "@/lib/api/client";
import { logActivity } from "@/lib/activity/useActivityLog";
import type { UserResponse } from "@/lib/api/types";

interface AuthContextValue {
  user: UserResponse | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True only once we're sure there's no session — empty token store, or a
   * genuine 401 from /auth/me. A transient error (429, network blip) must
   * never flip this, or ProtectedRoute bounces a real session to /login. */
  isDefinitivelyUnauthenticated: boolean;
  logout: () => void;
  setHasToken: (hasToken: boolean) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasToken, setHasToken] = React.useState(false);
  // Distinguishes "haven't checked localStorage yet" from "checked, no token" —
  // without it, ProtectedRoute's redirect effect fires on the render tick before
  // this check runs (hasToken still false), sending a genuinely logged-in user
  // to /login, which middleware.ts then bounces to /dashboard.
  const [tokenChecked, setTokenChecked] = React.useState(false);

  React.useEffect(() => {
    setHasToken(Boolean(localStorage.getItem("token")));
    setTokenChecked(true);
  }, []);

  const { data: user, isLoading: isMeLoading, error: meError } = useMe(hasToken);
  const isLoading = !tokenChecked || (hasToken && isMeLoading);

  const isDefinitivelyUnauthenticated =
    tokenChecked && (!hasToken || (meError instanceof ApiError && meError.status === 401));

  const prevUserRef = React.useRef<UserResponse | undefined>(undefined);
  React.useEffect(() => {
    if (!prevUserRef.current && user) {
      logActivity({ kind: "auth", label: `Signed in as ${user.display_name}` });
    }
    prevUserRef.current = user;
  }, [user]);

  const logout = React.useCallback(() => {
    logActivity({ kind: "auth", label: "Signed out" });
    // Revoke the server-side session and clear the refresh/indicator cookies,
    // then drop local state regardless of the API call's outcome.
    void post("/auth/logout")
      .catch(() => undefined)
      .finally(() => {
        localStorage.removeItem("token");
        setHasToken(false);
        window.location.href = "/login";
      });
  }, []);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isDefinitivelyUnauthenticated,
      logout,
      setHasToken,
    }),
    [user, isLoading, isDefinitivelyUnauthenticated, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
