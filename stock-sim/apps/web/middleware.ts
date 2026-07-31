import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/portfolio", "/market", "/companies", "/trading", "/simulation", "/future-lab", "/ai", "/settings", "/admin"];
const AUTH_ONLY = ["/login", "/register", "/forgot-password"];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const authenticated = Boolean(request.cookies.get("mv_session")?.value);
  if (PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) && !authenticated) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect", path);
    return NextResponse.redirect(login);
  }
  if (authenticated && AUTH_ONLY.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.redirect(new URL("/market", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)).*)"] };
