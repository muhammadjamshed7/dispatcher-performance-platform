import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";

import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { applySessionRoleCookie } from "@/lib/auth/session-role-cookie";
import { getPublicEnv } from "@/lib/env";
import { parseJsonBody } from "@/server/api/request";
import { jsonError, jsonOk } from "@/server/api/response";
import { signInWithRole } from "@/server/auth/auth.service";
import { assertRateLimit } from "@/server/utils/rate-limit";
import { assertSameOrigin } from "@/server/utils/request-security";

const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  expectedRole: z.enum([ADMIN, TEAM_LEAD, DISPATCHER]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertRateLimit(request, "auth:login");
    const body = await parseJsonBody(request, loginBodySchema);

    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
      getPublicEnv();

    if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error("Supabase is not configured.");
    }

    const cookieStore = await cookies();
    const authCookies: {
      name: string;
      value: string;
      options: CookieOptions;
    }[] = [];

    const supabase = createServerClient(
      NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              authCookies.push({ name, value, options });
            });
          },
        },
      },
    );

    const session = await signInWithRole(body, supabase);
    const response = jsonOk(session);
    applySessionRoleCookie(response, session.role);

    for (const cookie of authCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
  } catch (error) {
    return jsonError(error);
  }
}
