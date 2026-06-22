import "server-only";

import { z } from "zod";
import type { Role } from "@/lib/constants/roles";
import { ACTIVE } from "@/lib/auth/user-statuses";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/api/resources";
import { getCurrentUser, getCurrentUserBySupabaseId, touchLastLogin } from "@/server/auth/session";

function toSessionUser(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): SessionUser {
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as Role,
    status: user.status,
    teamId: user.teamId,
    dispatcherId: user.dispatcherId,
    teamName: user.teamName,
  };
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  expectedRole: z.enum(["ADMIN", "TEAM_LEAD", "DISPATCHER"]),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(1),
  email: z.email(),
  phoneNumber: z.string().trim().min(1),
  preferredTeamId: z.string().optional(),
  preferredTeamName: z.string().optional(),
  notes: z.string().optional(),
});

export async function signInWithRole(input: {
  email: string;
  password: string;
  expectedRole: Role;
}): Promise<SessionUser> {
  const parsed = loginSchema.parse(input);
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.email.toLowerCase(),
    password: parsed.password,
  });

  if (error || !data.user) {
    throw new ValidationError("Invalid email or password for this portal.");
  }

  const sessionUser = await getCurrentUserBySupabaseId(data.user.id);

  if (!sessionUser || sessionUser.email !== parsed.email.toLowerCase()) {
    await supabase.auth.signOut();
    throw new ValidationError("Invalid email or password for this portal.");
  }

  if (sessionUser.role !== parsed.expectedRole) {
    await supabase.auth.signOut();
    throw new ValidationError("Invalid email or password for this portal.");
  }

  if (sessionUser.status !== ACTIVE) {
    await supabase.auth.signOut();

    if (sessionUser.status === "PENDING_APPROVAL") {
      throw new ForbiddenError("Your account is pending admin approval.");
    }

    throw new ForbiddenError("Your account is not active. Contact an administrator.");
  }

  void touchLastLogin(sessionUser.id);

  return toSessionUser(sessionUser);
}

export async function signOutUser(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user ? toSessionUser(user) : null;
}

export async function submitRegistrationRequest(input: z.infer<typeof registerSchema>) {
  const parsed = registerSchema.parse(input);
  const organization = await db.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (!organization) {
    throw new ValidationError("Organization is not configured yet.");
  }

  const existingUser = await db.user.findFirst({
    where: {
      organizationId: organization.id,
      email: parsed.email.toLowerCase(),
      deletedAt: null,
    },
  });

  if (existingUser) {
    throw new ValidationError("An account with this email already exists.");
  }

  const existingPending = await db.registrationRequest.findFirst({
    where: {
      organizationId: organization.id,
      email: parsed.email.toLowerCase(),
      status: "PENDING",
    },
  });

  if (existingPending) {
    throw new ValidationError("A pending registration request already exists for this email.");
  }

  const request = await db.registrationRequest.create({
    data: {
      organizationId: organization.id,
      fullName: parsed.fullName,
      email: parsed.email.toLowerCase(),
      phoneNumber: parsed.phoneNumber,
      requestedRole: "DISPATCHER",
      preferredTeamId: parsed.preferredTeamId,
      preferredTeamName: parsed.preferredTeamName,
      notes: parsed.notes,
    },
  });

  return {
    id: request.id,
    message:
      "Registration request submitted. Admin approval is required before login.",
  };
}
