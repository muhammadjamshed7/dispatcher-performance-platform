import "server-only";

import { z } from "zod";
import type { TeamStatus } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { db } from "@/lib/db/prisma";
import type { Team as TeamDto } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapTeam } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import { teamScopeFilter } from "@/server/utils/scope-filters";

const createTeamInputSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
  teamLeadUserId: z.string().trim().optional(),
  status: z.enum(TEAM_STATUSES),
});

const updateTeamInputSchema = createTeamInputSchema.partial();

type CreateTeamInput = z.infer<typeof createTeamInputSchema>;
type UpdateTeamInput = z.infer<typeof updateTeamInputSchema>;

function requireAdmin(scope: AccessScope): void {
  if (!scope.isCompanyWide) {
    throw new ForbiddenError("Admin access is required.");
  }
}

const teamInclude = {
  teamLead: { select: { fullName: true } },
  _count: { select: { dispatchers: true, carriers: true } },
} as const;

export async function listTeams(scope: AccessScope): Promise<TeamDto[]> {
  const teams = await db.team.findMany({
    where: {
      organizationId: scope.organizationId,
      ...teamScopeFilter(scope),
    },
    include: teamInclude,
    orderBy: { name: "asc" },
  });

  return teams.map(mapTeam);
}

export async function getTeam(scope: AccessScope, id: string): Promise<TeamDto> {
  const team = await db.team.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      ...teamScopeFilter(scope),
    },
    include: teamInclude,
  });

  if (!team) {
    throw new NotFoundError("Team not found.");
  }

  return mapTeam(team);
}

async function validateTeamLead(
  organizationId: string,
  teamLeadUserId: string | undefined,
): Promise<void> {
  if (!teamLeadUserId) {
    return;
  }

  const lead = await db.user.findFirst({
    where: {
      id: teamLeadUserId,
      organizationId,
      deletedAt: null,
      status: "ACTIVE",
    },
  });

  if (!lead) {
    throw new ValidationError("Team lead user not found or inactive.");
  }
}

export async function createTeam(
  scope: AccessScope,
  actor: AuthContextUser,
  input: CreateTeamInput,
): Promise<TeamDto> {
  requireAdmin(scope);
  const parsed = createTeamInputSchema.parse(input);

  await validateTeamLead(scope.organizationId, parsed.teamLeadUserId);

  const existing = await db.team.findFirst({
    where: {
      organizationId: scope.organizationId,
      name: parsed.name,
      deletedAt: null,
    },
  });

  if (existing) {
    throw new ValidationError("A team with this name already exists.");
  }

  const team = await db.team.create({
    data: {
      organizationId: scope.organizationId,
      name: parsed.name,
      teamLeadUserId: parsed.teamLeadUserId ?? null,
      status: parsed.status as TeamStatus,
    },
    include: teamInclude,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "TEAM_CREATED",
    entityType: "Team",
    entityId: team.id,
    metadata: { name: team.name },
  });

  return mapTeam(team);
}

export async function updateTeam(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: UpdateTeamInput,
): Promise<TeamDto> {
  requireAdmin(scope);
  const parsed = updateTeamInputSchema.parse(input);

  const existing = await db.team.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError("Team not found.");
  }

  if (parsed.teamLeadUserId !== undefined) {
    await validateTeamLead(scope.organizationId, parsed.teamLeadUserId);
  }

  if (parsed.name && parsed.name !== existing.name) {
    const duplicate = await db.team.findFirst({
      where: {
        organizationId: scope.organizationId,
        name: parsed.name,
        deletedAt: null,
        NOT: { id },
      },
    });

    if (duplicate) {
      throw new ValidationError("A team with this name already exists.");
    }
  }

  const team = await db.team.update({
    where: { id },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.teamLeadUserId !== undefined
        ? { teamLeadUserId: parsed.teamLeadUserId || null }
        : {}),
      ...(parsed.status !== undefined ? { status: parsed.status as TeamStatus } : {}),
    },
    include: teamInclude,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "TEAM_UPDATED",
    entityType: "Team",
    entityId: team.id,
    metadata: parsed,
  });

  return mapTeam(team);
}

export async function deactivateTeam(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<TeamDto> {
  requireAdmin(scope);

  const existing = await db.team.findFirst({
    where: {
      id,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError("Team not found.");
  }

  const team = await db.team.update({
    where: { id },
    data: {
      status: "INACTIVE",
      deletedAt: new Date(),
    },
    include: teamInclude,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "TEAM_DEACTIVATED",
    entityType: "Team",
    entityId: team.id,
  });

  return mapTeam(team);
}
