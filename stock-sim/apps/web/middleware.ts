import { NextRequest, NextResponse } from "next/server";

/**
 * Edge route protection. Uses the lightweight `mv_session` indicator cookie set by
 * the API at login (NOT a credential — real authorization stays with the Bearer
 * access token on every API call). Closes the "flash of protected content" gap.
 */

const SESSION_FLAG_COOKIE = "mv_session";

// Explicit list — future phases add their routes here deliberately.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/portfolio",
  "/market",
  "/companies",
  "/trading",
  "/simulation",
  "/ai",
  "/settings",
  "/admin",
];

// Redirect away to /dashboard when already signed in. /reset-password and
// /verify-email stay reachable regardless of session state (the token/code in
// hand is its own authorization).
const AUTH_ONLY_PREFIXES = ["/login", "/register", "/forgot-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_FLAG_COOKIE)?.value);

  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!hasSession && process.env.NODE_ENV !== "development") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (AUTH_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets, Next internals, and the API proxy — the FastAPI backend
  // enforces its own auth per request.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)).*)"],
};
