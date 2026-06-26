import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { USER_WITH_TEAM_AND_DISPATCHER } from "@/lib/db/embeds";
import type { User } from "@/lib/db/types";
import { isInfrastructureError } from "@/lib/errors/infrastructure-error";
import { T, db } from "@/lib/db/client";
import { assertDbVoid, nowIso, unwrapRelation } from "@/lib/db/utils";
import { createServerClient } from "@/lib/supabase/server";
import { getCachedJwks } from "@/server/auth/jwks-cache";
import type { AuthContextUser } from "@/server/auth/types";

type UserWithRelations = User & {
  team?: { name: string } | Array<{ name: string }> | null;
  dispatcher?: { id: string } | Array<{ id: string }> | null;
  organization?:
    | { timezone: string; currency: string }
    | Array<{ timezone: string; currency: string }>
    | null;
};

function mapUser(user: UserWithRelations): AuthContextUser {
  const team = unwrapRelation(user.team);
  const dispatcher = unwrapRelation(user.dispatcher);
  const organization = unwrapRelation(user.organization);

  return {
    ...user,
    teamName: team?.name ?? null,
    dispatcherId: dispatcher?.id ?? null,
    timezone: organization?.timezone ?? "America/Chicago",
    currency: organization?.currency ?? "USD",
  };
}

async function loadDbUser(
  supabaseUserId: string,
): Promise<AuthContextUser | null> {
  const result = await db()
    .from(T.User)
    .select(USER_WITH_TEAM_AND_DISPATCHER)
    .eq("supabaseUserId", supabaseUserId)
    .is("deletedAt", null)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  return mapUser(result.data as UserWithRelations);
}

type GetClaimsOptions = NonNullable<
  Parameters<SupabaseClient["auth"]["getClaims"]>[1]
>;

/**
 * Resolves the authenticated Supabase user id from the current session.
 *
 * Uses `getClaims()` which verifies the access token LOCALLY (no auth-server
 * round trip) when the project uses asymmetric JWT signing keys, passing the
 * module-cached JWKS so the keys are not re-fetched per request. For legacy
 * symmetric (HS256) projects, getClaims transparently falls back to a network
 * `getUser()` call, so behavior is unchanged until signing keys are enabled.
 *
 * Token refresh is still handled: getClaims reads the session via getSession(),
 * which refreshes the access token when it is expired or about to expire.
 */
async function resolveSupabaseUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const jwks = await getCachedJwks();

  const options: GetClaimsOptions | undefined =
    jwks && jwks.length > 0
      ? ({ jwks: { keys: jwks } } as GetClaimsOptions)
      : undefined;

  const { data, error } = await supabase.auth.getClaims(undefined, options);

  if (error || !data || typeof data.claims?.sub !== "string") {
    return null;
  }

  return data.claims.sub;
}

// Memoized per request so multiple guards/services that resolve the current
// user within a single request share one token verification + DB load.
export const getCurrentUser = cache(
  async (): Promise<AuthContextUser | null> => {
    try {
      const supabase = await createServerClient();
      const supabaseUserId = await resolveSupabaseUserId(supabase);

      if (!supabaseUserId) {
        return null;
      }

      return await loadDbUser(supabaseUserId);
    } catch (error) {
      if (isInfrastructureError(error)) {
        throw error;
      }

      throw error;
    }
  },
);

export async function getCurrentUserByEmail(
  email: string,
): Promise<AuthContextUser | null> {
  try {
    const result = await db()
      .from(T.User)
      .select(USER_WITH_TEAM_AND_DISPATCHER)
      .eq("email", email.toLowerCase())
      .is("deletedAt", null)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      return null;
    }

    return mapUser(result.data as UserWithRelations);
  } catch (error) {
    if (isInfrastructureError(error)) {
      throw error;
    }

    throw error;
  }
}

export async function getCurrentUserBySupabaseId(
  supabaseUserId: string,
): Promise<AuthContextUser | null> {
  return loadDbUser(supabaseUserId);
}

export async function touchLastLogin(userId: string): Promise<void> {
  const result = await db()
    .from(T.User)
    .update({ lastLoginAt: nowIso(), updatedAt: nowIso() })
    .eq("id", userId);

  assertDbVoid(result);
}
