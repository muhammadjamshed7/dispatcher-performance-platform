import "server-only";

import { z } from "zod";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { ACTIVE } from "@/lib/auth/user-statuses";
import { db } from "@/lib/db/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PendingUserRequest, User as UserDto } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapRegistrationRequest, mapUser } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";

const approveRegistrationInputSchema = z.object({
  role: z.enum([DISPATCHER, TEAM_LEAD]),
  teamId: z.string().trim().min(1, "Team is required"),
  temporaryPassword: z.string().min(8, "Temporary password must be at least 8 characters"),
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

function requireAdmin(scope: AccessScope): void {
  if (!scope.isCompanyWide) {
    throw new ForbiddenError("Admin access is required.");
  }
}

async function validateTeam(organizationId: string, teamId: string): Promise<void> {
  const team = await db.team.findFirst({
    where: {
      id: teamId,
      organizationId,
      deletedAt: null,
      status: "ACTIVE",
    },
  });

  if (!team) {
    throw new ValidationError("Team not found or inactive.");
  }
}

export async function listRegistrationRequests(
  scope: AccessScope,
): Promise<PendingUserRequest[]> {
  requireAdmin(scope);

  const requests = await db.registrationRequest.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: { submittedAt: "desc" },
  });

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

  const request = await db.registrationRequest.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      status: "PENDING",
    },
  });

  if (!request) {
    throw new NotFoundError("Registration request not found.");
  }

  await validateTeam(scope.organizationId, parsed.teamId);

  if (request.requestedRole === DISPATCHER && parsed.role !== DISPATCHER) {
    throw new ValidationError(
      "Self-registered users can only be approved as dispatchers.",
    );
  }

  const existingUser = await db.user.findFirst({
    where: {
      organizationId: scope.organizationId,
      email: request.email.toLowerCase(),
      deletedAt: null,
    },
  });

  if (existingUser) {
    throw new ValidationError("A user with this email already exists.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: request.email.toLowerCase(),
    password: parsed.temporaryPassword,
    email_confirm: true,
    user_metadata: {
      fullName: request.fullName,
    },
  });

  if (authError || !authData.user) {
    throw new ValidationError(authError?.message ?? "Failed to create auth user.");
  }

  const user = await db.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        organizationId: scope.organizationId,
        supabaseUserId: authData.user.id,
        email: request.email.toLowerCase(),
        fullName: request.fullName,
        phoneNumber: request.phoneNumber,
        role: parsed.role,
        status: ACTIVE,
        teamId: parsed.teamId,
      },
      include: { team: { select: { name: true } } },
    });

    if (parsed.role === DISPATCHER) {
      await tx.dispatcher.create({
        data: {
          organizationId: scope.organizationId,
          userId: createdUser.id,
          teamId: parsed.teamId,
          status: "ACTIVE",
        },
      });
    }

    await tx.registrationRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedByUserId: actor.id,
        assignedTeamId: parsed.teamId,
        assignedRole: parsed.role,
      },
    });

    return createdUser;
  });

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

  const request = await db.registrationRequest.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      status: "PENDING",
    },
  });

  if (!request) {
    throw new NotFoundError("Registration request not found.");
  }

  const updated = await db.registrationRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
      rejectionReason: parsed.reason,
    },
  });

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

  const existing = await db.user.findFirst({
    where: {
      id: userId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    include: {
      team: { select: { name: true } },
      dispatcher: { select: { id: true } },
    },
  });

  if (!existing) {
    throw new NotFoundError("User not found.");
  }

  if (parsed.role !== "ADMIN" && !parsed.teamId) {
    throw new ValidationError("Team is required for team lead and dispatcher roles.");
  }

  if (parsed.teamId) {
    await validateTeam(scope.organizationId, parsed.teamId);
  }

  const user = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        role: parsed.role,
        teamId: parsed.role === "ADMIN" ? null : parsed.teamId,
      },
      include: { team: { select: { name: true } } },
    });

    if (parsed.role === DISPATCHER) {
      if (existing.dispatcher) {
        await tx.dispatcher.update({
          where: { id: existing.dispatcher.id },
          data: {
            teamId: parsed.teamId!,
            status: "ACTIVE",
            deletedAt: null,
          },
        });
      } else {
        await tx.dispatcher.create({
          data: {
            organizationId: scope.organizationId,
            userId,
            teamId: parsed.teamId!,
            status: "ACTIVE",
          },
        });
      }
    }

    if (parsed.role !== DISPATCHER && existing.dispatcher) {
      await tx.dispatcher.update({
        where: { id: existing.dispatcher.id },
        data: { status: "INACTIVE", deletedAt: new Date() },
      });
    }

    return updatedUser;
  });

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
