// Thin fetch wrapper: injects Bearer token, silent-refreshes expired sessions, typed JSON.
import { toast } from "sonner";

const BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/** Auth endpoints that must never trigger a silent refresh (avoids recursion/loops). */
const NO_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

export class ApiError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.append(k, String(v));
  return `?${usp.toString()}`;
}

// Single-flight refresh: parallel 401s share one /auth/refresh call instead of
// racing the token-rotation logic against itself.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, { method: "POST" });
        if (!res.ok) return false;
        const body = (await res.json()) as { access_token?: string };
        if (!body.access_token) return false;
        setToken(body.access_token);
        return true;
      } catch {
        return false;
      } finally {
        // Allow the next expiry (15 min later) to trigger a fresh single-flight.
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

function redirectToExpiredLogin(): void {
  if (typeof window === "undefined") return;
  setToken(null);
  // Clear the session flag cookie so Next.js middleware stops letting
  // unauthenticated requests through to protected pages.
  document.cookie = "mv_session=; path=/; max-age=0";
  const path = window.location.pathname;
  const isAuthPage = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"].some(
    (p) => path.startsWith(p)
  );
  if (!isAuthPage) {
    window.location.href = "/login?expired=1";
  }
}

async function rawRequest(path: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && !NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    // Access token likely expired — try one silent refresh, then retry once.
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest(path, options);
    } else {
      redirectToExpiredLogin();
      throw new ApiError("Session expired", 401);
    }
  }

  if (res.status === 401) {
    if (!NO_REFRESH_PATHS.some((p) => path.startsWith(p))) {
      redirectToExpiredLogin();
    }
    const body = await res.json().catch(() => ({}));
    const detail = typeof body?.detail === "string" ? body.detail : "Unauthorized";
    throw new ApiError(detail, 401);
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
    const isAuthPath = path.startsWith("/auth/");
    if (typeof window !== "undefined" && !isAuthPath) {
      toast.error("Too many requests. Slow down.");
    }
    throw new ApiError(
      "Too many requests. Slow down.",
      429,
      Number.isFinite(retryAfter as number) ? retryAfter : null
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((d: { msg?: string }) => d.msg).join(", ")
          : `HTTP ${res.status}`;
    throw new ApiError(detail, res.status);
  }

  return res.json();
}

export function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  return request<T>(`${path}${buildQuery(params)}`, { method: "GET" });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
