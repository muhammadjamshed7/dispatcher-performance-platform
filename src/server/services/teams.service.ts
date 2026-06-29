import "server-only";

import { z } from "zod";
import { T, db } from "@/lib/db/client";
import type { JsonValue, Team, TeamStatus } from "@/lib/db/types";
import { assertDb, createId, nowIso } from "@/lib/db/utils";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { ADMIN, TEAM_LEAD } from "@/lib/constants/roles";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
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

import { TEAM_WITH_LEAD } from "@/lib/db/embeds";

type TeamRow = Team & { teamLead?: { fullName: string } | null };

function requireAdmin(scope: AccessScope): void {
  if (!scope.isCompanyWide) {
    throw new ForbiddenError("Admin access is required.");
  }
}

function applyTeamScopeQuery<
  T extends {
    eq: (col: string, val: string) => T;
    is: (col: string, val: null) => T;
  },
>(query: T, scope: AccessScope): T {
  const filter = teamScopeFilter(scope);
  let scopedQuery = query
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null);

  if ("id" in filter && filter.id) {
    scopedQuery = scopedQuery.eq("id", filter.id);
  }

  return scopedQuery;
}

async function fetchTeamCounts(
  organizationId: string,
  teamIds: string[],
): Promise<Map<string, { dispatchers: number; carriers: number }>> {
  const counts = new Map<string, { dispatchers: number; carriers: number }>();

  for (const teamId of teamIds) {
    counts.set(teamId, { dispatchers: 0, carriers: 0 });
  }

  if (teamIds.length === 0) {
    return counts;
  }

  const [dispatchersResult, carriersResult] = await Promise.all([
    db()
      .from(T.Dispatcher)
      .select("teamId")
      .eq("organizationId", organizationId)
      .is("deletedAt", null)
      .in("teamId", teamIds),
    db()
      .from(T.Carrier)
      .select("teamId")
      .eq("organizationId", organizationId)
      .is("deletedAt", null)
      .in("teamId", teamIds),
  ]);

  for (const row of assertDb(dispatchersResult) ?? []) {
    if (!row.teamId) {
      continue;
    }

    const entry = counts.get(row.teamId);
    if (entry) {
      entry.dispatchers += 1;
    }
  }

  for (const row of assertDb(carriersResult) ?? []) {
    if (!row.teamId) {
      continue;
    }

    const entry = counts.get(row.teamId);
    if (entry) {
      entry.carriers += 1;
    }
  }

  return counts;
}

async function enrichTeamsWithCounts(
  organizationId: string,
  teams: TeamRow[],
): Promise<
  Array<TeamRow & { _count: { dispatchers: number; carriers: number } }>
> {
  const counts = await fetchTeamCounts(
    organizationId,
    teams.map((team) => team.id),
  );

  return teams.map((team) => ({
    ...team,
    _count: counts.get(team.id) ?? { dispatchers: 0, carriers: 0 },
  }));
}

export async function listTeams(scope: AccessScope): Promise<TeamDto[]> {
  const result = await applyTeamScopeQuery(
    db().from(T.Team).select(TEAM_WITH_LEAD).order("name", { ascending: true }),
    scope,
  );

  const teams = assertDb(result) as TeamRow[];
  const enriched = await enrichTeamsWithCounts(scope.organizationId, teams);

  return enriched.map(mapTeam);
}

export async function getTeam(
  scope: AccessScope,
  id: string,
): Promise<TeamDto> {
  const result = await applyTeamScopeQuery(
    db().from(T.Team).select(TEAM_WITH_LEAD).eq("id", id),
    scope,
  ).maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new NotFoundError("Team not found.");
  }

  const [enriched] = await enrichTeamsWithCounts(scope.organizationId, [
    result.data as TeamRow,
  ]);

  return mapTeam(enriched);
}

async function validateTeamLead(
  organizationId: string,
  teamLeadUserId: string | undefined,
): Promise<void> {
  if (!teamLeadUserId) {
    return;
  }

  const result = await db()
    .from(T.User)
    .select("id, role")
    .eq("id", teamLeadUserId)
    .eq("organizationId", organizationId)
    .is("deletedAt", null)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const lead = result.data;

  if (!lead || (lead.role !== TEAM_LEAD && lead.role !== ADMIN)) {
    throw new ValidationError(
      "Team lead must be an active team lead or admin user.",
    );
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

  const existingResult = await db()
    .from(T.Team)
    .select("id")
    .eq("organizationId", scope.organizationId)
    .eq("name", parsed.name)
    .is("deletedAt", null)
    .maybeSingle();

  if (existingResult.data) {
    throw new ValidationError("A team with this name already exists.");
  }

  const insertResult = await db()
    .from(T.Team)
    .insert({
      id: createId(),
      organizationId: scope.organizationId,
      name: parsed.name,
      teamLeadUserId: parsed.teamLeadUserId ?? null,
      status: parsed.status as TeamStatus,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    .select(TEAM_WITH_LEAD)
    .single();

  const team = assertDb(insertResult) as TeamRow;
  const [enriched] = await enrichTeamsWithCounts(scope.organizationId, [team]);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "TEAM_CREATED",
    entityType: "Team",
    entityId: team.id,
    metadata: {
      entityName: team.name,
      name: team.name,
      status: team.status,
      teamLeadUserId: team.teamLeadUserId,
    },
  });

  return mapTeam(enriched);
}

export async function updateTeam(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: UpdateTeamInput,
): Promise<TeamDto> {
  requireAdmin(scope);
  const parsed = updateTeamInputSchema.parse(input);

  const existingResult = await db()
    .from(T.Team)
    .select("id, name, status, teamLeadUserId")
    .eq("id", id)
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .maybeSingle();

  const existing = existingResult.data;

  if (!existing) {
    throw new NotFoundError("Team not found.");
  }

  if (parsed.status === "INACTIVE") {
    const [dispatcherResult, carrierResult] = await Promise.all([
      db()
        .from(T.Dispatcher)
        .select("id")
        .eq("organizationId", scope.organizationId)
        .eq("teamId", id)
        .eq("status", "ACTIVE")
        .is("deletedAt", null)
        .limit(1),
      db()
        .from(T.Carrier)
        .select("id")
        .eq("organizationId", scope.organizationId)
        .eq("teamId", id)
        .eq("status", "ACTIVE")
        .is("deletedAt", null)
        .limit(1),
    ]);

    if (dispatcherResult.error) {
      throw new Error(dispatcherResult.error.message);
    }

    if (carrierResult.error) {
      throw new Error(carrierResult.error.message);
    }

    if (
      (dispatcherResult.data ?? []).length > 0 ||
      (carrierResult.data ?? []).length > 0
    ) {
      throw new ValidationError(
        "Deactivate or reassign this team's active dispatchers and carriers first.",
      );
    }
  }

  if (parsed.teamLeadUserId !== undefined) {
    await validateTeamLead(scope.organizationId, parsed.teamLeadUserId);
  }

  if (parsed.name && parsed.name !== existing.name) {
    const duplicateResult = await db()
      .from(T.Team)
      .select("id")
      .eq("organizationId", scope.organizationId)
      .eq("name", parsed.name)
      .is("deletedAt", null)
      .neq("id", id)
      .maybeSingle();

    if (duplicateResult.data) {
      throw new ValidationError("A team with this name already exists.");
    }
  }

  const updateResult = await db()
    .from(T.Team)
    .update({
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.teamLeadUserId !== undefined
        ? { teamLeadUserId: parsed.teamLeadUserId || null }
        : {}),
      ...(parsed.status !== undefined
        ? { status: parsed.status as TeamStatus }
        : {}),
      updatedAt: nowIso(),
    })
    .eq("id", id)
    .select(TEAM_WITH_LEAD)
    .single();

  const team = assertDb(updateResult) as TeamRow;
  const [enriched] = await enrichTeamsWithCounts(scope.organizationId, [team]);
  const auditAction =
    parsed.status === "ACTIVE" && existing.status !== "ACTIVE"
      ? "TEAM_ACTIVATED"
      : parsed.status === "INACTIVE" && existing.status !== "INACTIVE"
        ? "TEAM_DEACTIVATED"
        : "TEAM_UPDATED";
  const auditMetadata = {
    entityName: team.name,
    oldData: {
      name: existing.name,
      status: existing.status,
      teamLeadUserId: existing.teamLeadUserId,
    },
    newData: {
      name: team.name,
      status: team.status,
      teamLeadUserId: team.teamLeadUserId,
    },
    changedFields: Object.keys(parsed),
  } as JsonValue;

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: auditAction,
    entityType: "Team",
    entityId: team.id,
    metadata: auditMetadata,
  });

  if (
    parsed.teamLeadUserId !== undefined &&
    parsed.teamLeadUserId !== existing.teamLeadUserId
  ) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "TEAM_LEAD_ASSIGNED",
      entityType: "Team",
      entityId: team.id,
      metadata: auditMetadata,
    });
  }

  return mapTeam(enriched);
}

export async function deactivateTeam(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<TeamDto> {
  requireAdmin(scope);

  const existingResult = await db()
    .from(T.Team)
    .select("id, name, status, teamLeadUserId")
    .eq("id", id)
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .maybeSingle();

  if (!existingResult.data) {
    throw new NotFoundError("Team not found.");
  }

  const updateResult = await db()
    .from(T.Team)
    .update({
      status: "INACTIVE",
      deletedAt: null,
      updatedAt: nowIso(),
    })
    .eq("id", id)
    .select(TEAM_WITH_LEAD)
    .single();

  const team = assertDb(updateResult) as TeamRow;
  const [enriched] = await enrichTeamsWithCounts(scope.organizationId, [team]);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "TEAM_DEACTIVATED",
    entityType: "Team",
    entityId: team.id,
    metadata: {
      entityName: team.name,
      oldData: existingResult.data,
      newData: {
        name: team.name,
        status: team.status,
        teamLeadUserId: team.teamLeadUserId,
      },
    } as JsonValue,
  });

  return mapTeam(enriched);
}
