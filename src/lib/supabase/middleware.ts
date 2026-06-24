import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getRoleFromPathname, isPublicAuthPath } from "@/lib/auth/roles";
import { enforceProtectedRouteAccess } from "@/lib/auth/session-role-cookie";
import { getPublicEnv } from "@/lib/env";
import { hasSupabaseAuthCookiesFromList } from "@/lib/supabase/auth-cookies";

const SESSION_REFRESH_TIMEOUT_MS = 3_000;

function shouldRefreshSession(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/health")
  ) {
    return false;
  }

  if (
    isPublicAuthPath(pathname) ||
    pathname === "/" ||
    pathname === "/auth/callback" ||
    pathname === "/session-expired"
  ) {
    return false;
  }

  if (pathname.startsWith("/api/")) {
    return hasSupabaseAuthCookiesFromList(request.cookies.getAll());
  }

  if (!getRoleFromPathname(pathname)) {
    return false;
  }

  return hasSupabaseAuthCookiesFromList(request.cookies.getAll());
}

async function refreshSupabaseSession(supabase: SupabaseClient): Promise<void> {
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Session refresh timeout"));
        }, SESSION_REFRESH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Middleware must not block navigation when Supabase is slow or offline.
  }
}

export async function updateSession(request: NextRequest) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getPublicEnv();

  let supabaseResponse = NextResponse.next({ request });

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return enforceProtectedRouteAccess(request, supabaseResponse);
  }

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  if (shouldRefreshSession(request)) {
    await refreshSupabaseSession(supabase);
  }

  return enforceProtectedRouteAccess(request, supabaseResponse);
}
