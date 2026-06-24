import type { Role } from "@/lib/constants/roles";
import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  getDashboardPathForRole,
  getLoginPathForRole,
  getRoleFromPathname,
  isPublicAuthPath,
} from "@/lib/auth/roles";
import { hasSupabaseAuthCookiesFromList } from "@/lib/supabase/auth-cookies";

export const SESSION_ROLE_COOKIE = "dpp_user_role";

const VALID_ROLES: Role[] = [ADMIN, TEAM_LEAD, DISPATCHER];

export function parseSessionRoleCookie(value: string | undefined): Role | null {
  if (!value) {
    return null;
  }

  return VALID_ROLES.includes(value as Role) ? (value as Role) : null;
}

export function applySessionRoleCookie(
  response: NextResponse,
  role: Role,
): void {
  response.cookies.set(SESSION_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionRoleCookie(response: NextResponse): void {
  response.cookies.set(SESSION_ROLE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function enforceProtectedRouteAccess(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const { pathname } = request.nextUrl;
  const requiredRole = getRoleFromPathname(pathname);

  if (!requiredRole || isPublicAuthPath(pathname)) {
    return response;
  }

  const hasAuthCookies = hasSupabaseAuthCookiesFromList(
    request.cookies.getAll(),
  );

  if (!hasAuthCookies) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = getLoginPathForRole(requiredRole);
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  const sessionRole = parseSessionRoleCookie(
    request.cookies.get(SESSION_ROLE_COOKIE)?.value,
  );

  if (sessionRole && sessionRole !== requiredRole) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = getDashboardPathForRole(sessionRole);
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
