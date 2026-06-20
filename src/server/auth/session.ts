import "server-only";

import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db/prisma";
import { createServerClient } from "@/lib/supabase/server";
import type { AuthContextUser } from "@/server/auth/types";

async function mapUser(user: User & { team?: { name: string } | null; dispatcher?: { id: string } | null }): Promise<AuthContextUser> {
  return {
    ...user,
    teamName: user.team?.name ?? null,
    dispatcherId: user.dispatcher?.id ?? null,
  };
}

export async function getCurrentUser(): Promise<AuthContextUser | null> {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const dbUser = await db.user.findFirst({
    where: {
      supabaseUserId: authUser.id,
      deletedAt: null,
    },
    include: {
      team: { select: { name: true } },
      dispatcher: { select: { id: true } },
    },
  });

  if (!dbUser) {
    return null;
  }

  return mapUser(dbUser);
}

export async function getCurrentUserByEmail(email: string): Promise<AuthContextUser | null> {
  const dbUser = await db.user.findFirst({
    where: {
      email: email.toLowerCase(),
      deletedAt: null,
    },
    include: {
      team: { select: { name: true } },
      dispatcher: { select: { id: true } },
    },
  });

  if (!dbUser) {
    return null;
  }

  return mapUser(dbUser);
}

export async function touchLastLogin(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}
