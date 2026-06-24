import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Role } from "@/lib/constants/roles";
import { ACTIVE } from "@/lib/auth/user-statuses";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { createServerClient } from "@/lib/supabase/server";
import { T, db } from "@/lib/db/client";
import { assertDbVoid, createId, nowIso } from "@/lib/db/utils";
import type { SessionUser } from "@/lib/api/resources";
import {
  getCurrentUser,
  getCurrentUserByEmail,
  touchLastLogin,
} from "@/server/auth/session";

function toSessionUser(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
): SessionUser {
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as Role,
    status: user.status,
    teamId: user.teamId,
    dispatcherId: user.dispatcherId,
    teamName: user.teamName,
    lastLoginAt: user.lastLoginAt ?? null,
    timezone: user.timezone,
    currency: user.currency,
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

export async function signInWithRole(
  input: {
    email: string;
    password: string;
    expectedRole: Role;
  },
  supabaseClient?: SupabaseClient,
): Promise<SessionUser> {
  const parsed = loginSchema.parse(input);
  const supabase = supabaseClient ?? (await createServerClient());

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.email.toLowerCase(),
    password: parsed.password,
  });

  if (error || !data.user) {
    throw new ValidationError("Invalid email or password for this portal.");
  }

  const sessionUser = await getCurrentUserByEmail(parsed.email.toLowerCase());

  if (
    !sessionUser ||
    sessionUser.supabaseUserId !== data.user.id ||
    sessionUser.email !== parsed.email.toLowerCase()
  ) {
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

    throw new ForbiddenError(
      "Your account is not active. Contact an administrator.",
    );
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

export async function submitRegistrationRequest(
  input: z.infer<typeof registerSchema>,
) {
  const parsed = registerSchema.parse(input);

  const organizationResult = await db()
    .from(T.Organization)
    .select("id")
    .is("deletedAt", null)
    .order("createdAt", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (organizationResult.error) {
    throw organizationResult.error;
  }

  if (!organizationResult.data) {
    throw new ValidationError("Organization is not configured yet.");
  }

  const organization = organizationResult.data;

  const existingUser = await db()
    .from(T.User)
    .select("id")
    .eq("organizationId", organization.id)
    .eq("email", parsed.email.toLowerCase())
    .is("deletedAt", null)
    .maybeSingle();

  if (existingUser.error) {
    throw existingUser.error;
  }

  if (existingUser.data) {
    throw new ValidationError("An account with this email already exists.");
  }

  const existingPending = await db()
    .from(T.RegistrationRequest)
    .select("id")
    .eq("organizationId", organization.id)
    .eq("email", parsed.email.toLowerCase())
    .eq("status", "PENDING")
    .maybeSingle();

  if (existingPending.error) {
    throw existingPending.error;
  }

  if (existingPending.data) {
    throw new ValidationError(
      "A pending registration request already exists for this email.",
    );
  }

  const requestId = createId();

  assertDbVoid(
    await db()
      .from(T.RegistrationRequest)
      .insert({
        id: requestId,
        organizationId: organization.id,
        fullName: parsed.fullName,
        email: parsed.email.toLowerCase(),
        phoneNumber: parsed.phoneNumber,
        requestedRole: "DISPATCHER",
        preferredTeamId: parsed.preferredTeamId ?? null,
        preferredTeamName: parsed.preferredTeamName ?? null,
        notes: parsed.notes ?? null,
        status: "PENDING",
        submittedAt: nowIso(),
      }),
  );

  return {
    id: requestId,
    message:
      "Registration request submitted. Admin approval is required before login.",
  };
}

export async function requestPasswordReset(
  email: string,
): Promise<{ message: string }> {
  const parsed = z.email().parse(email.toLowerCase());
  const supabase = await createServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    throw new ValidationError("Unable to send password reset email.");
  }

  return {
    message:
      "If an account exists for that email, a password reset link has been sent.",
  };
}

export async function updatePassword(
  password: string,
): Promise<{ message: string }> {
  const parsed = z.string().min(8).parse(password);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed });

  if (error) {
    throw new ValidationError(error.message);
  }

  return { message: "Password updated successfully." };
}
