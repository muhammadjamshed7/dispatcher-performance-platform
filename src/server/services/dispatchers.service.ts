import "server-only";

import { z } from "zod";
import type { TeamStatus } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { db } from "@/lib/db/prisma";
import type { Dispatcher as DispatcherDto } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapDispatcher } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import { dispatcherScopeFilter } from "@/server/utils/scope-filters";

const DISPATCHER_ROLES = [DISPATCHER, TEAM_LEAD] as const;

const createDispatcherInputSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("Enter a valid email"),
  phoneNumber: z.string().trim().optional(),
  teamId: z.string().trim().min(1, "Team is required"),
  role: z.enum(DISPATCHER_ROLES),
  status: z.enum(TEAM_STATUSES),
});

const updateDispatcherInputSchema = createDispatcherInputSchema.partial();

type CreateDispatcherInput = z.infer<typeof createDispatcherInputSchema>;
type UpdateDispatcherInput = z.infer<typeof updateDispatcherInputSchema>;

function requireAdminOrTeamLead(scope: AccessScope): void {
  if (!scope.isCompanyWide && scope.role !== TEAM_LEAD) {
    throw new ForbiddenError("Admin or team lead access is required.");
  }
}

function assertTeamAssignment(scope: AccessScope, teamId: string): void {
  if (scope.isCompanyWide) {
    return;
  }

  if (scope.teamId !== teamId) {
    throw new ForbiddenError("You can only manage dispatchers on your team.");
  }
}

const dispatcherInclude = {
  user: { select: { fullName: true, email: true, phoneNumber: true, role: true } },
  team: { select: { name: true } },
  _count: { select: { carriers: true } },
} as const;

export async function listDispatchers(scope: AccessScope): Promise<DispatcherDto[]> {
  const dispatchers = await db.dispatcher.findMany({
    where: {
      organizationId: scope.organizationId,
      ...dispatcherScopeFilter(scope),
    },
    include: dispatcherInclude,
    orderBy: { user: { fullName: "asc" } },
  });

  return dispatchers.map(mapDispatcher);
}

async function getDispatcherRecord(scope: AccessScope, id: string) {
  const dispatcher = await db.dispatcher.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      ...dispatcherScopeFilter(scope),
    },
    include: dispatcherInclude,
  });

  if (!dispatcher) {
    throw new NotFoundError("Dispatcher not found.");
  }

  return dispatcher;
}

export async function createDispatcher(
  scope: AccessScope,
  actor: AuthContextUser,
  input: CreateDispatcherInput,
): Promise<DispatcherDto> {
  requireAdminOrTeamLead(scope);
  const parsed = createDispatcherInputSchema.parse(input);

  assertTeamAssignment(scope, parsed.teamId);

  const team = await db.team.findFirst({
    where: {
      id: parsed.teamId,
      organizationId: scope.organizationId,
      deletedAt: null,
      status: "ACTIVE",
    },
  });

  if (!team) {
    throw new ValidationError("Team not found or inactive.");
  }

  const existingUser = await db.user.findFirst({
    where: {
      organizationId: scope.organizationId,
      email: parsed.email.toLowerCase(),
      deletedAt: null,
    },
  });

  if (existingUser) {
    throw new ValidationError("A user with this email already exists.");
  }

  const dispatcher = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: scope.organizationId,
        email: parsed.email.toLowerCase(),
        fullName: parsed.fullName,
        phoneNumber: parsed.phoneNumber ?? null,
        role: parsed.role,
        status: "ACTIVE",
        teamId: parsed.teamId,
      },
    });

    return tx.dispatcher.create({
      data: {
        organizationId: scope.organizationId,
        userId: user.id,
        teamId: parsed.teamId,
        status: parsed.status as TeamStatus,
      },
      include: dispatcherInclude,
    });
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "DISPATCHER_CREATED",
    entityType: "Dispatcher",
    entityId: dispatcher.id,
    metadata: { email: parsed.email, teamId: parsed.teamId },
  });

  return mapDispatcher(dispatcher);
}

export async function updateDispatcher(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: UpdateDispatcherInput,
): Promise<DispatcherDto> {
  requireAdminOrTeamLead(scope);
  const parsed = updateDispatcherInputSchema.parse(input);

  const existing = await getDispatcherRecord(scope, id);

  if (parsed.teamId) {
    assertTeamAssignment(scope, parsed.teamId);

    const team = await db.team.findFirst({
      where: {
        id: parsed.teamId,
        organizationId: scope.organizationId,
        deletedAt: null,
      },
    });

    if (!team) {
      throw new ValidationError("Team not found.");
    }
  }

  if (parsed.email && parsed.email.toLowerCase() !== existing.user.email) {
    const duplicate = await db.user.findFirst({
      where: {
        organizationId: scope.organizationId,
        email: parsed.email.toLowerCase(),
        deletedAt: null,
        NOT: { id: existing.userId },
      },
    });

    if (duplicate) {
      throw new ValidationError("A user with this email already exists.");
    }
  }

  const dispatcher = await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: {
        ...(parsed.fullName !== undefined ? { fullName: parsed.fullName } : {}),
        ...(parsed.email !== undefined ? { email: parsed.email.toLowerCase() } : {}),
        ...(parsed.phoneNumber !== undefined
          ? { phoneNumber: parsed.phoneNumber || null }
          : {}),
        ...(parsed.role !== undefined ? { role: parsed.role } : {}),
        ...(parsed.teamId !== undefined ? { teamId: parsed.teamId } : {}),
      },
    });

    return tx.dispatcher.update({
      where: { id },
      data: {
        ...(parsed.teamId !== undefined ? { teamId: parsed.teamId } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status as TeamStatus } : {}),
      },
      include: dispatcherInclude,
    });
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "DISPATCHER_UPDATED",
    entityType: "Dispatcher",
    entityId: dispatcher.id,
    metadata: parsed,
  });

  return mapDispatcher(dispatcher);
}

export async function activateDispatcher(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<DispatcherDto> {
  requireAdminOrTeamLead(scope);
  await getDispatcherRecord(scope, id);

  const dispatcher = await db.$transaction(async (tx) => {
    const record = await tx.dispatcher.update({
      where: { id },
      data: { status: "ACTIVE", deletedAt: null },
      include: dispatcherInclude,
    });

    await tx.user.update({
      where: { id: record.userId },
      data: { status: "ACTIVE", deletedAt: null },
    });

    return record;
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "DISPATCHER_UPDATED",
    entityType: "Dispatcher",
    entityId: id,
    metadata: { status: "ACTIVE" },
  });

  return mapDispatcher(dispatcher);
}

export async function deactivateDispatcher(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<DispatcherDto> {
  requireAdminOrTeamLead(scope);
  await getDispatcherRecord(scope, id);

  const dispatcher = await db.$transaction(async (tx) => {
    const record = await tx.dispatcher.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
      include: dispatcherInclude,
    });

    await tx.user.update({
      where: { id: record.userId },
      data: { status: "INACTIVE" },
    });

    return record;
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "DISPATCHER_DEACTIVATED",
    entityType: "Dispatcher",
    entityId: id,
  });

  return mapDispatcher(dispatcher);
}
