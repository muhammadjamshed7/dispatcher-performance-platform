import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isPublicAuthPath } from "@/lib/auth/roles";
import { getPublicEnv } from "@/lib/env";
import { hasSupabaseAuthCookiesFromList } from "@/lib/supabase/auth-cookies";

function shouldRefreshSession(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return false;
  }

  if (
    isPublicAuthPath(pathname) ||
    pathname === "/auth/callback" ||
    pathname === "/session-expired"
  ) {
    return false;
  }

  return hasSupabaseAuthCookiesFromList(request.cookies.getAll());
}

export async function updateSession(request: NextRequest) {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getPublicEnv();

  let supabaseResponse = NextResponse.next({ request });

  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
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
    await supabase.auth.getUser();
  }

  return supabaseResponse;
}
