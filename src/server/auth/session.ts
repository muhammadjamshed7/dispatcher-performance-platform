import "server-only";

import { USER_WITH_TEAM_AND_DISPATCHER } from "@/lib/db/embeds";
import type { User } from "@/lib/db/types";
import { isInfrastructureError } from "@/lib/errors/infrastructure-error";
import { T, db } from "@/lib/db/client";
import { assertDbVoid, nowIso, unwrapRelation } from "@/lib/db/utils";
import { createServerClient } from "@/lib/supabase/server";
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

export async function getCurrentUser(): Promise<AuthContextUser | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return null;
    }

    return await loadDbUser(authUser.id);
  } catch (error) {
    if (isInfrastructureError(error)) {
      throw error;
    }

    throw error;
  }
}

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
