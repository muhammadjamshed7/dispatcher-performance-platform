import "server-only";

import { z } from "zod";
import { T, db } from "@/lib/db/client";
import type {
  Dispatcher,
  JsonValue,
  TeamStatus,
  User,
  UserRole,
} from "@/lib/db/types";
import {
  assertDb,
  assertDbVoid,
  createId,
  ignoreDbError,
  nowIso,
  unwrapRelation,
} from "@/lib/db/utils";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Dispatcher as DispatcherDto } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapDispatcher, mapTeamLeadUser } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import { sanitizeFilterId } from "@/lib/constants/filters";
import { assertFilterAccess } from "@/server/utils/activity-filters";
import { dispatcherScopeFilter } from "@/server/utils/scope-filters";
import { buildIlikeOr } from "@/server/utils/text-search";

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

import { DISPATCHER_WITH_USER_AND_TEAM } from "@/lib/db/embeds";
import { asFilterable, type FilterableQuery } from "@/lib/db/query";

type DispatcherRow = Dispatcher & {
  user: Pick<
    User,
    "fullName" | "email" | "phoneNumber" | "role" | "supabaseUserId"
  >;
  team: Pick<{ name: string }, "name">;
  _count?: { carriers: number };
};

function applyDispatcherScopeQuery<T extends FilterableQuery>(
  query: T,
  scope: AccessScope,
  options: { includeDeleted?: boolean } = {},
): T {
  const filter = dispatcherScopeFilter(scope);
  let scopedQuery = query.eq("organizationId", scope.organizationId);

  for (const [column, value] of Object.entries(filter)) {
    if (column === "deletedAt" && options.includeDeleted) {
      continue;
    }

    if (value === null) {
      scopedQuery = scopedQuery.is(column, null);
    } else {
      scopedQuery = scopedQuery.eq(column, value);
    }
  }

  return scopedQuery as T;
}

function normalizeDispatcherRow(row: DispatcherRow): DispatcherRow {
  const user = unwrapRelation(row.user);
  const team = unwrapRelation(row.team);

  return {
    ...row,
    user: user ?? {
      fullName: "",
      email: "",
      phoneNumber: null,
      role: "DISPATCHER" as UserRole,
      supabaseUserId: null,
    },
    team: team ?? { name: "" },
  };
}

async function fetchCarrierCounts(
  organizationId: string,
  dispatcherIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const dispatcherId of dispatcherIds) {
    counts.set(dispatcherId, 0);
  }

  if (dispatcherIds.length === 0) {
    return counts;
  }

  const result = await db()
    .from(T.Carrier)
    .select("dispatcherId")
    .eq("organizationId", organizationId)
    .is("deletedAt", null)
    .in("dispatcherId", dispatcherIds);

  for (const row of assertDb(result) ?? []) {
    if (!row.dispatcherId) {
      continue;
    }

    counts.set(row.dispatcherId, (counts.get(row.dispatcherId) ?? 0) + 1);
  }

  return counts;
}

async function enrichDispatchersWithCounts(
  organizationId: string,
  dispatchers: DispatcherRow[],
): Promise<DispatcherRow[]> {
  const counts = await fetchCarrierCounts(
    organizationId,
    dispatchers.map((dispatcher) => dispatcher.id),
  );

  return dispatchers.map((dispatcher) => ({
    ...dispatcher,
    _count: { carriers: counts.get(dispatcher.id) ?? 0 },
  }));
}

function generateTemporaryPassword(): string {
  return `${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}Aa1!`;
}

function assertRoleAssignment(
  scope: AccessScope,
  role: typeof DISPATCHER | typeof TEAM_LEAD,
): void {
  if (role === TEAM_LEAD && !scope.isCompanyWide) {
    throw new ForbiddenError(
      "Only administrators can assign the team lead role.",
    );
  }
}

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

export async function listDispatchers(
  scope: AccessScope,
  filters: { q?: string; teamId?: string; dispatcherId?: string } = {},
): Promise<DispatcherDto[]> {
  await assertFilterAccess(scope, {
    teamId: filters.teamId,
    dispatcherId: filters.dispatcherId,
  });

  const teamId = sanitizeFilterId(filters.teamId);
  const dispatcherId = sanitizeFilterId(filters.dispatcherId);

  let query = applyDispatcherScopeQuery(
    asFilterable(db().from(T.Dispatcher).select(DISPATCHER_WITH_USER_AND_TEAM)),
    scope,
    { includeDeleted: true },
  );

  if (teamId) {
    query = query.eq("teamId", teamId) as typeof query;
  }

  if (dispatcherId) {
    query = query.eq("id", dispatcherId) as typeof query;
  }

  if (filters.q) {
    query = query.or(buildIlikeOr(["fullName", "email"], filters.q), {
      referencedTable: "user",
    }) as typeof query;
  }

  const rows = (assertDb(await query) ?? []) as DispatcherRow[];
  const normalized = rows.map(normalizeDispatcherRow);
  normalized.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName));

  const enriched = await enrichDispatchersWithCounts(
    scope.organizationId,
    normalized,
  );

  return enriched.map(mapDispatcher);
}

async function getDispatcherRecord(
  scope: AccessScope,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<DispatcherRow> {
  const result = await applyDispatcherScopeQuery(
    db().from(T.Dispatcher).select(DISPATCHER_WITH_USER_AND_TEAM).eq("id", id),
    scope,
    options,
  ).maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new NotFoundError("Dispatcher not found.");
  }

  const [enriched] = await enrichDispatchersWithCounts(scope.organizationId, [
    normalizeDispatcherRow(result.data as DispatcherRow),
  ]);

  return enriched;
}

export async function createDispatcher(
  scope: AccessScope,
  actor: AuthContextUser,
  input: CreateDispatcherInput,
): Promise<{ dispatcher: DispatcherDto; temporaryPassword: string }> {
  requireAdminOrTeamLead(scope);
  const parsed = createDispatcherInputSchema.parse(input);

  assertRoleAssignment(scope, parsed.role);
  assertTeamAssignment(scope, parsed.teamId);

  const teamResult = await db()
    .from(T.Team)
    .select("id, name")
    .eq("id", parsed.teamId)
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!teamResult.data) {
    throw new ValidationError("Team not found or inactive.");
  }

  const existingUserResult = await db()
    .from(T.User)
    .select("id")
    .eq("organizationId", scope.organizationId)
    .eq("email", parsed.email.toLowerCase())
    .is("deletedAt", null)
    .maybeSingle();

  if (existingUserResult.data) {
    throw new ValidationError("A user with this email already exists.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const supabase = createSupabaseAdminClient();
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: parsed.email.toLowerCase(),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        fullName: parsed.fullName,
      },
    });

  if (authError || !authData.user) {
    throw new ValidationError(
      authError?.message ?? "Failed to create auth user.",
    );
  }

  let dispatcher: DispatcherRow | null = null;
  let teamLeadDto: DispatcherDto | null = null;
  let createdUserId: string | null = null;
  let createdDispatcherId: string | null = null;
  const isTeamLead = parsed.role === TEAM_LEAD;

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
        email: parsed.email.toLowerCase(),
        fullName: parsed.fullName,
        phoneNumber: parsed.phoneNumber ?? null,
        role: parsed.role as UserRole,
        status: "ACTIVE",
        teamId: parsed.teamId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    assertDbVoid(userResult);

    if (isTeamLead) {
      teamLeadDto = mapTeamLeadUser({
        id: userId,
        fullName: parsed.fullName,
        email: parsed.email.toLowerCase(),
        phoneNumber: parsed.phoneNumber ?? null,
        createdAt: timestamp,
        team: { name: teamResult.data.name },
        status: parsed.status as TeamStatus,
      });
    } else {
      const dispatcherId = createId();
      createdDispatcherId = dispatcherId;

      const dispatcherResult = await db()
        .from(T.Dispatcher)
        .insert({
          id: dispatcherId,
          organizationId: scope.organizationId,
          userId,
          teamId: parsed.teamId,
          status: parsed.status as TeamStatus,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .select(DISPATCHER_WITH_USER_AND_TEAM)
        .single();

      dispatcher = normalizeDispatcherRow(
        assertDb(dispatcherResult) as DispatcherRow,
      );
      const [enriched] = await enrichDispatchersWithCounts(
        scope.organizationId,
        [dispatcher],
      );
      dispatcher = enriched;
    }
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
    action: isTeamLead ? "TEAM_LEAD_CREATED" : "DISPATCHER_CREATED",
    entityType: isTeamLead ? "User" : "Dispatcher",
    entityId: isTeamLead ? createdUserId! : dispatcher!.id,
    metadata: {
      entityName: parsed.fullName,
      fullName: parsed.fullName,
      email: parsed.email,
      teamId: parsed.teamId,
      teamName: teamResult.data.name,
      role: parsed.role,
      status: parsed.status,
    },
  });

  return {
    dispatcher: isTeamLead ? teamLeadDto! : mapDispatcher(dispatcher!),
    temporaryPassword,
  };
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

  if (parsed.role !== undefined) {
    assertRoleAssignment(scope, parsed.role);
  }

  if (parsed.teamId) {
    assertTeamAssignment(scope, parsed.teamId);

    const teamResult = await db()
      .from(T.Team)
      .select("id")
      .eq("id", parsed.teamId)
      .eq("organizationId", scope.organizationId)
      .is("deletedAt", null)
      .maybeSingle();

    if (!teamResult.data) {
      throw new ValidationError("Team not found.");
    }

    if (parsed.teamId !== existing.teamId) {
      const assignedCarrierResult = await db()
        .from(T.Carrier)
        .select("id")
        .eq("organizationId", scope.organizationId)
        .eq("dispatcherId", id)
        .is("deletedAt", null)
        .limit(1);

      if (assignedCarrierResult.error) {
        throw new Error(assignedCarrierResult.error.message);
      }

      if ((assignedCarrierResult.data ?? []).length > 0) {
        throw new ValidationError(
          "Reassign this dispatcher's carriers before moving them to another team.",
        );
      }
    }
  }

  const nextEmail = parsed.email?.toLowerCase();
  const emailChanged = Boolean(nextEmail && nextEmail !== existing.user.email);

  if (emailChanged && nextEmail) {
    const duplicateResult = await db()
      .from(T.User)
      .select("id")
      .eq("organizationId", scope.organizationId)
      .eq("email", nextEmail)
      .is("deletedAt", null)
      .neq("id", existing.userId)
      .maybeSingle();

    if (duplicateResult.data) {
      throw new ValidationError("A user with this email already exists.");
    }
  }

  const previousUser = {
    fullName: existing.user.fullName,
    email: existing.user.email,
    phoneNumber: existing.user.phoneNumber,
    role: existing.user.role,
    teamId: existing.teamId,
  };
  const previousDispatcher = {
    teamId: existing.teamId,
    status: existing.status,
  };

  let dispatcher: DispatcherRow;
  const supabase = emailChanged ? createSupabaseAdminClient() : null;
  let authEmailUpdated = false;

  try {
    const timestamp = nowIso();

    if (emailChanged && nextEmail) {
      if (!existing.user.supabaseUserId) {
        throw new ValidationError(
          "This dispatcher is not linked to a Supabase account, so the email cannot be changed.",
        );
      }

      const { error: authUpdateError } =
        await supabase!.auth.admin.updateUserById(
          existing.user.supabaseUserId,
          { email: nextEmail },
        );

      if (authUpdateError) {
        throw new ValidationError(authUpdateError.message);
      }

      authEmailUpdated = true;
    }

    const userUpdateResult = await db()
      .from(T.User)
      .update({
        ...(parsed.fullName !== undefined ? { fullName: parsed.fullName } : {}),
        ...(nextEmail !== undefined ? { email: nextEmail } : {}),
        ...(parsed.phoneNumber !== undefined
          ? { phoneNumber: parsed.phoneNumber || null }
          : {}),
        ...(parsed.role !== undefined ? { role: parsed.role as UserRole } : {}),
        ...(parsed.teamId !== undefined ? { teamId: parsed.teamId } : {}),
        updatedAt: timestamp,
      })
      .eq("id", existing.userId)
      .eq("organizationId", scope.organizationId);

    assertDbVoid(userUpdateResult);

    const dispatcherUpdateResult = await db()
      .from(T.Dispatcher)
      .update({
        ...(parsed.teamId !== undefined ? { teamId: parsed.teamId } : {}),
        ...(parsed.status !== undefined
          ? { status: parsed.status as TeamStatus }
          : {}),
        updatedAt: timestamp,
      })
      .eq("id", id)
      .eq("organizationId", scope.organizationId)
      .select(DISPATCHER_WITH_USER_AND_TEAM)
      .single();

    dispatcher = normalizeDispatcherRow(
      assertDb(dispatcherUpdateResult) as DispatcherRow,
    );
    const [enriched] = await enrichDispatchersWithCounts(scope.organizationId, [
      dispatcher,
    ]);
    dispatcher = enriched;
  } catch (error) {
    if (authEmailUpdated && supabase && existing.user.supabaseUserId) {
      await supabase.auth.admin
        .updateUserById(existing.user.supabaseUserId, {
          email: previousUser.email,
        })
        .catch(() => undefined);
    }

    await ignoreDbError(
      db()
        .from(T.User)
        .update({
          fullName: previousUser.fullName,
          email: previousUser.email,
          phoneNumber: previousUser.phoneNumber,
          role: previousUser.role,
          teamId: previousUser.teamId,
          updatedAt: nowIso(),
        })
        .eq("id", existing.userId),
    );

    await ignoreDbError(
      db()
        .from(T.Dispatcher)
        .update({
          teamId: previousDispatcher.teamId,
          status: previousDispatcher.status,
          updatedAt: nowIso(),
        })
        .eq("id", id),
    );

    throw error;
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "DISPATCHER_UPDATED",
    entityType: "Dispatcher",
    entityId: dispatcher.id,
    metadata: {
      entityName: dispatcher.user.fullName,
      oldData: previousUser,
      newData: {
        fullName: dispatcher.user.fullName,
        email: dispatcher.user.email,
        phoneNumber: dispatcher.user.phoneNumber,
        role: dispatcher.user.role,
        teamId: dispatcher.teamId,
        status: dispatcher.status,
      },
      changedFields: Object.keys(parsed),
    } as JsonValue,
  });

  if (parsed.role !== undefined && parsed.role !== previousUser.role) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "USER_ROLE_ASSIGNED",
      entityType: "User",
      entityId: existing.userId,
      metadata: {
        entityName: dispatcher.user.fullName,
        oldData: { role: previousUser.role },
        newData: { role: parsed.role },
      } as JsonValue,
    });
  }

  if (parsed.teamId !== undefined && parsed.teamId !== previousUser.teamId) {
    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "USER_TEAM_ASSIGNED",
      entityType: "User",
      entityId: existing.userId,
      metadata: {
        entityName: dispatcher.user.fullName,
        oldData: { teamId: previousUser.teamId },
        newData: { teamId: parsed.teamId },
      } as JsonValue,
    });
  }

  return mapDispatcher(dispatcher);
}

export async function activateDispatcher(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<DispatcherDto> {
  requireAdminOrTeamLead(scope);
  const existing = await getDispatcherRecord(scope, id, {
    includeDeleted: true,
  });

  const teamResult = await db()
    .from(T.Team)
    .select("id")
    .eq("id", existing.teamId)
    .eq("organizationId", scope.organizationId)
    .eq("status", "ACTIVE")
    .is("deletedAt", null)
    .maybeSingle();

  if (!teamResult.data) {
    throw new ValidationError(
      "Activate the dispatcher's assigned team before activating the dispatcher.",
    );
  }

  let dispatcher: DispatcherRow;
  const previousUserStatus = existing.userId
    ? await db()
        .from(T.User)
        .select("status, deletedAt")
        .eq("id", existing.userId)
        .eq("organizationId", scope.organizationId)
        .maybeSingle()
    : null;

  try {
    const timestamp = nowIso();

    const dispatcherUpdateResult = await db()
      .from(T.Dispatcher)
      .update({ status: "ACTIVE", deletedAt: null, updatedAt: timestamp })
      .eq("id", id)
      .eq("organizationId", scope.organizationId)
      .select(DISPATCHER_WITH_USER_AND_TEAM)
      .single();

    dispatcher = normalizeDispatcherRow(
      assertDb(dispatcherUpdateResult) as DispatcherRow,
    );

    const userUpdateResult = await db()
      .from(T.User)
      .update({ status: "ACTIVE", deletedAt: null, updatedAt: timestamp })
      .eq("id", dispatcher.userId)
      .eq("organizationId", scope.organizationId);

    assertDbVoid(userUpdateResult);

    const [enriched] = await enrichDispatchersWithCounts(scope.organizationId, [
      dispatcher,
    ]);
    dispatcher = enriched;
  } catch (error) {
    await ignoreDbError(
      db()
        .from(T.Dispatcher)
        .update({
          status: existing.status,
          deletedAt: existing.deletedAt,
          updatedAt: nowIso(),
        })
        .eq("id", id),
    );

    if (previousUserStatus?.data) {
      await ignoreDbError(
        db()
          .from(T.User)
          .update({
            status: previousUserStatus.data.status,
            deletedAt: previousUserStatus.data.deletedAt,
            updatedAt: nowIso(),
          })
          .eq("id", existing.userId),
      );
    }

    throw error;
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "DISPATCHER_REACTIVATED",
    entityType: "Dispatcher",
    entityId: id,
    metadata: {
      entityName: dispatcher.user.fullName,
      oldData: { status: existing.status },
      newData: { status: "ACTIVE" },
    } as JsonValue,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "USER_ACTIVATED",
    entityType: "User",
    entityId: dispatcher.userId,
    metadata: {
      entityName: dispatcher.user.fullName,
      oldData: { status: previousUserStatus?.data?.status ?? null },
      newData: { status: "ACTIVE" },
    } as JsonValue,
  });

  return mapDispatcher(dispatcher);
}

export async function deactivateDispatcher(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<DispatcherDto> {
  requireAdminOrTeamLead(scope);
  const existing = await getDispatcherRecord(scope, id);

  let dispatcher: DispatcherRow;

  try {
    const timestamp = nowIso();

    const dispatcherUpdateResult = await db()
      .from(T.Dispatcher)
      .update({ status: "INACTIVE", deletedAt: null, updatedAt: timestamp })
      .eq("id", id)
      .eq("organizationId", scope.organizationId)
      .select(DISPATCHER_WITH_USER_AND_TEAM)
      .single();

    dispatcher = normalizeDispatcherRow(
      assertDb(dispatcherUpdateResult) as DispatcherRow,
    );

    const userUpdateResult = await db()
      .from(T.User)
      .update({ status: "INACTIVE", updatedAt: timestamp })
      .eq("id", dispatcher.userId)
      .eq("organizationId", scope.organizationId);

    assertDbVoid(userUpdateResult);

    const [enriched] = await enrichDispatchersWithCounts(scope.organizationId, [
      dispatcher,
    ]);
    dispatcher = enriched;
  } catch (error) {
    await ignoreDbError(
      db()
        .from(T.Dispatcher)
        .update({
          status: existing.status,
          deletedAt: existing.deletedAt,
          updatedAt: nowIso(),
        })
        .eq("id", id),
    );

    throw error;
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "DISPATCHER_DEACTIVATED",
    entityType: "Dispatcher",
    entityId: id,
    metadata: {
      entityName: dispatcher.user.fullName,
      oldData: { status: existing.status },
      newData: { status: "INACTIVE" },
    } as JsonValue,
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "USER_DEACTIVATED",
    entityType: "User",
    entityId: dispatcher.userId,
    metadata: {
      entityName: dispatcher.user.fullName,
      oldData: { status: existing.user ? "ACTIVE" : null },
      newData: { status: "INACTIVE" },
    } as JsonValue,
  });

  return mapDispatcher(dispatcher);
}
