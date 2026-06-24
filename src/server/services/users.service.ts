import "server-only";

import { z } from "zod";
import { T, db } from "@/lib/db/client";
import type { RegistrationRequest, User, UserRole } from "@/lib/db/types";
import { assertDb, assertDbVoid, createId, nowIso } from "@/lib/db/utils";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { ACTIVE } from "@/lib/auth/user-statuses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PendingUserRequest, User as UserDto } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapRegistrationRequest, mapUser } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";

const approveRegistrationInputSchema = z.object({
  role: z.enum([DISPATCHER, TEAM_LEAD]),
  teamId: z.string().trim().min(1, "Team is required"),
  temporaryPassword: z
    .string()
    .min(8, "Temporary password must be at least 8 characters"),
});

const rejectRegistrationInputSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required"),
});

const assignRoleAndTeamInputSchema = z.object({
  role: z.enum([DISPATCHER, TEAM_LEAD, "ADMIN"]),
  teamId: z.string().nullable(),
});

type ApproveRegistrationInput = z.infer<typeof approveRegistrationInputSchema>;
type RejectRegistrationInput = z.infer<typeof rejectRegistrationInputSchema>;
type AssignRoleAndTeamInput = z.infer<typeof assignRoleAndTeamInputSchema>;

import { USER_WITH_TEAM } from "@/lib/db/embeds";

type UserWithTeam = User & { team?: { name: string } | null };

async function ignoreDbError(promise: PromiseLike<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // best-effort rollback
  }
}

function requireAdmin(scope: AccessScope): void {
  if (!scope.isCompanyWide) {
    throw new ForbiddenError("Admin access is required.");
  }
}

async function validateTeam(
  organizationId: string,
  teamId: string,
): Promise<void> {
  const result = await db()
    .from(T.Team)
    .select("id")
    .eq("id", teamId)
    .eq("organizationId", organizationId)
    .is("deletedAt", null)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new ValidationError("Team not found or inactive.");
  }
}

export async function listRegistrationRequests(
  scope: AccessScope,
): Promise<PendingUserRequest[]> {
  requireAdmin(scope);

  const result = await db()
    .from(T.RegistrationRequest)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .order("submittedAt", { ascending: false });

  const requests = assertDb(result) as RegistrationRequest[];

  return requests.map(mapRegistrationRequest);
}

export async function approveRegistrationRequest(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: ApproveRegistrationInput,
): Promise<UserDto> {
  requireAdmin(scope);
  const parsed = approveRegistrationInputSchema.parse(input);

  const requestResult = await db()
    .from(T.RegistrationRequest)
    .select("*")
    .eq("id", id)
    .eq("organizationId", scope.organizationId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (requestResult.error) {
    throw new Error(requestResult.error.message);
  }

  const request = requestResult.data as RegistrationRequest | null;

  if (!request) {
    throw new NotFoundError("Registration request not found.");
  }

  await validateTeam(scope.organizationId, parsed.teamId);

  const existingUserResult = await db()
    .from(T.User)
    .select("id")
    .eq("organizationId", scope.organizationId)
    .eq("email", request.email.toLowerCase())
    .is("deletedAt", null)
    .maybeSingle();

  if (existingUserResult.data) {
    throw new ValidationError("A user with this email already exists.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: request.email.toLowerCase(),
      password: parsed.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        fullName: request.fullName,
      },
    });

  if (authError || !authData.user) {
    throw new ValidationError(
      authError?.message ?? "Failed to create auth user.",
    );
  }

  let user: UserWithTeam;
  let createdUserId: string | null = null;
  let createdDispatcherId: string | null = null;

  try {
    const userId = createId();
    createdUserId = userId;
    const timestamp = nowIso();

    const userResult = await db()
      .from(T.User)
      .insert({
        id: userId,
        organizationId: scope.organizationId,
        supabaseUserId: authData.user.id,
        email: request.email.toLowerCase(),
        fullName: request.fullName,
        phoneNumber: request.phoneNumber,
        role: parsed.role as UserRole,
        status: ACTIVE,
        teamId: parsed.teamId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .select(USER_WITH_TEAM)
      .single();

    user = assertDb(userResult) as UserWithTeam;

    if (parsed.role === DISPATCHER) {
      const dispatcherId = createId();
      createdDispatcherId = dispatcherId;

      const dispatcherResult = await db().from(T.Dispatcher).insert({
        id: dispatcherId,
        organizationId: scope.organizationId,
        userId,
        teamId: parsed.teamId,
        status: "ACTIVE",
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      assertDbVoid(dispatcherResult);
    }

    const requestUpdateResult = await db()
      .from(T.RegistrationRequest)
      .update({
        status: "APPROVED",
        reviewedAt: timestamp,
        reviewedByUserId: actor.id,
        assignedTeamId: parsed.teamId,
        assignedRole: parsed.role as UserRole,
      })
      .eq("id", id);

    assertDbVoid(requestUpdateResult);
  } catch (error) {
    if (createdDispatcherId) {
      await ignoreDbError(
        db().from(T.Dispatcher).delete().eq("id", createdDispatcherId),
      );
    }

    if (createdUserId) {
      await ignoreDbError(db().from(T.User).delete().eq("id", createdUserId));
    }

    await supabase.auth.admin
      .deleteUser(authData.user.id)
      .catch(() => undefined);
    throw error;
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "USER_APPROVED",
    entityType: "RegistrationRequest",
    entityId: id,
    metadata: { userId: user.id, role: parsed.role, teamId: parsed.teamId },
  });

  return mapUser(user);
}

export async function rejectRegistrationRequest(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: RejectRegistrationInput,
): Promise<PendingUserRequest> {
  requireAdmin(scope);
  const parsed = rejectRegistrationInputSchema.parse(input);

  const requestResult = await db()
    .from(T.RegistrationRequest)
    .select("*")
    .eq("id", id)
    .eq("organizationId", scope.organizationId)
    .eq("status", "PENDING")
    .maybeSingle();

  if (requestResult.error) {
    throw new Error(requestResult.error.message);
  }

  if (!requestResult.data) {
    throw new NotFoundError("Registration request not found.");
  }

  const updateResult = await db()
    .from(T.RegistrationRequest)
    .update({
      status: "REJECTED",
      reviewedAt: nowIso(),
      reviewedByUserId: actor.id,
      rejectionReason: parsed.reason,
    })
    .eq("id", id)
    .select("*")
    .single();

  const updated = assertDb(updateResult) as RegistrationRequest;

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "USER_REJECTED",
    entityType: "RegistrationRequest",
    entityId: id,
    metadata: { reason: parsed.reason },
  });

  return mapRegistrationRequest(updated);
}

export async function assignRoleAndTeam(
  scope: AccessScope,
  actor: AuthContextUser,
  userId: string,
  role: AssignRoleAndTeamInput["role"],
  teamId: string | null,
): Promise<UserDto> {
  requireAdmin(scope);
  const parsed = assignRoleAndTeamInputSchema.parse({ role, teamId });

  const existingResult = await db()
    .from(T.User)
    .select(
      "*, team:Team!User_teamId_fkey(name), dispatcher:Dispatcher!Dispatcher_userId_fkey(id, teamId, status, deletedAt)",
    )
    .eq("id", userId)
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  const existing = existingResult.data as
    | (User & {
        team?: { name: string } | null;
        dispatcher?: {
          id: string;
          teamId: string;
          status: string;
          deletedAt: string | null;
        } | null;
      })
    | null;

  if (!existing) {
    throw new NotFoundError("User not found.");
  }

  if (parsed.role !== "ADMIN" && !parsed.teamId) {
    throw new ValidationError(
      "Team is required for team lead and dispatcher roles.",
    );
  }

  if (parsed.teamId) {
    await validateTeam(scope.organizationId, parsed.teamId);
  }

  const previousUser = {
    role: existing.role,
    teamId: existing.teamId,
  };
  const previousDispatcher = existing.dispatcher
    ? {
        id: existing.dispatcher.id,
        teamId: existing.dispatcher.teamId,
        status: existing.dispatcher.status,
        deletedAt: existing.dispatcher.deletedAt,
      }
    : null;
  let createdDispatcherId: string | null = null;

  let user: UserWithTeam;

  try {
    const timestamp = nowIso();

    const userUpdateResult = await db()
      .from(T.User)
      .update({
        role: parsed.role as UserRole,
        teamId: parsed.role === "ADMIN" ? null : parsed.teamId,
        updatedAt: timestamp,
      })
      .eq("id", userId)
      .eq("organizationId", scope.organizationId)
      .select(USER_WITH_TEAM)
      .single();

    user = assertDb(userUpdateResult) as UserWithTeam;

    if (parsed.role === DISPATCHER) {
      if (existing.dispatcher) {
        const dispatcherUpdateResult = await db()
          .from(T.Dispatcher)
          .update({
            teamId: parsed.teamId!,
            status: "ACTIVE",
            deletedAt: null,
            updatedAt: timestamp,
          })
          .eq("id", existing.dispatcher.id);

        assertDbVoid(dispatcherUpdateResult);
      } else {
        const dispatcherId = createId();
        createdDispatcherId = dispatcherId;

        const dispatcherInsertResult = await db().from(T.Dispatcher).insert({
          id: dispatcherId,
          organizationId: scope.organizationId,
          userId,
          teamId: parsed.teamId!,
          status: "ACTIVE",
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        assertDbVoid(dispatcherInsertResult);
      }
    }

    if (parsed.role !== DISPATCHER && existing.dispatcher) {
      const dispatcherDeactivateResult = await db()
        .from(T.Dispatcher)
        .update({
          status: "INACTIVE",
          deletedAt: timestamp,
          updatedAt: timestamp,
        })
        .eq("id", existing.dispatcher.id);

      assertDbVoid(dispatcherDeactivateResult);
    }
  } catch (error) {
    await ignoreDbError(
      db()
        .from(T.User)
        .update({
          role: previousUser.role,
          teamId: previousUser.teamId,
          updatedAt: nowIso(),
        })
        .eq("id", userId),
    );

    if (createdDispatcherId) {
      await ignoreDbError(
        db().from(T.Dispatcher).delete().eq("id", createdDispatcherId),
      );
    } else if (previousDispatcher) {
      await ignoreDbError(
        db()
          .from(T.Dispatcher)
          .update({
            teamId: previousDispatcher.teamId,
            status: previousDispatcher.status,
            deletedAt: previousDispatcher.deletedAt,
            updatedAt: nowIso(),
          })
          .eq("id", previousDispatcher.id),
      );
    }

    throw error;
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "USER_ROLE_ASSIGNED",
    entityType: "User",
    entityId: userId,
    metadata: {
      previousRole: existing.role,
      role: parsed.role,
      teamId: parsed.teamId,
    },
  });

  if (parsed.teamId && parsed.teamId !== existing.teamId) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "USER_TEAM_ASSIGNED",
      entityType: "User",
      entityId: userId,
      metadata: { teamId: parsed.teamId },
    });
  }

  return mapUser(user);
}
