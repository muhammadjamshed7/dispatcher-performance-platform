import "server-only";

import { z } from "zod";
import { T, db } from "@/lib/db/client";
import type {
  Carrier,
  CarrierStatus,
  Team,
  TruckType,
  User,
} from "@/lib/db/types";
import { assertDb, assertDbVoid, createId, nowIso } from "@/lib/db/utils";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { TEAM_LEAD } from "@/lib/constants/roles";
import { TEAM_STATUSES } from "@/lib/constants/team-statuses";
import { isFilterAll, sanitizeFilterId } from "@/lib/constants/filters";
import { normalizeMcNumber } from "@/lib/utils/normalize-mc-number";
import type { Carrier as CarrierDto } from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapCarrier } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  assertAllowedTruckType,
  getDispatchFeeRules,
} from "@/server/services/settings.service";
import { assertFilterAccess } from "@/server/utils/activity-filters";
import { carrierScopeFilter } from "@/server/utils/scope-filters";
import { buildIlikeOr } from "@/server/utils/text-search";
import { CARRIER_WITH_RELATIONS } from "@/lib/db/embeds";
import { asFilterable, type FilterableQuery } from "@/lib/db/query";

const TRUCK_TYPES = [
  "DRY_VAN",
  "REEFER",
  "FLATBED",
  "BOX_TRUCK",
  "HOTSHOT",
  "POWER_ONLY",
  "CARGO_VAN",
] as const satisfies readonly TruckType[];

const createCarrierInputSchema = z.object({
  carrierName: z.string().trim().min(1, "Carrier name is required"),
  driverName: z.string().trim().min(1, "Driver name is required"),
  mcNumber: z.string().trim().min(1, "MC number is required"),
  dispatchFeePercentage: z
    .number({ message: "Dispatch fee percentage is required" })
    .min(0)
    .max(100)
    .optional(),
  truckType: z.enum(TRUCK_TYPES),
  teamId: z.string().trim().min(1, "Assigned team is required"),
  dispatcherId: z.string().trim().min(1, "Assigned dispatcher is required"),
  status: z.enum(TEAM_STATUSES).default("ACTIVE"),
  notes: z.string().trim().optional(),
});

const updateCarrierInputSchema = createCarrierInputSchema
  .omit({ teamId: true, dispatcherId: true })
  .partial();

const reassignCarrierInputSchema = z.object({
  teamId: z.string().trim().min(1, "Assigned team is required"),
  dispatcherId: z.string().trim().min(1, "Assigned dispatcher is required"),
  notes: z.string().trim().optional(),
});

type CreateCarrierInput = z.infer<typeof createCarrierInputSchema>;
type UpdateCarrierInput = z.infer<typeof updateCarrierInputSchema>;
type ReassignCarrierInput = z.infer<typeof reassignCarrierInputSchema>;

type CarrierRow = Carrier & {
  team: Pick<Team, "name">;
  dispatcher?: { user: Pick<User, "fullName"> } | null;
};

function applyCarrierScopeQuery<T extends FilterableQuery>(
  query: T,
  scope: AccessScope,
): T {
  const filter = carrierScopeFilter(scope);
  let scopedQuery = query
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null);

  for (const [column, value] of Object.entries(filter)) {
    if (column === "deletedAt") {
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

async function ignoreDbError(promise: PromiseLike<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // best-effort rollback
  }
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeCarrierRow(row: CarrierRow): CarrierRow {
  const team = unwrapRelation(row.team);
  const dispatcher = unwrapRelation(row.dispatcher);
  const dispatcherUser = dispatcher ? unwrapRelation(dispatcher.user) : null;

  return {
    ...row,
    team: team ?? { name: "" },
    dispatcher: dispatcher
      ? { user: dispatcherUser ?? { fullName: "" } }
      : null,
  };
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
    throw new ForbiddenError("You can only manage carriers on your team.");
  }
}

const carrierListFiltersSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  teamId: z.string().optional(),
  teamIds: z.string().optional(),
  dispatcherId: z.string().optional(),
  dispatcherIds: z.string().optional(),
  carrierId: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
  truckTypes: z.string().optional(),
  status: z.enum(TEAM_STATUSES).optional(),
  statuses: z.string().optional(),
});

type CarrierListFilters = z.infer<typeof carrierListFiltersSchema>;

function parseCsvParam(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].filter((part) => !isFilterAll(part));
}

function normalizeCarrierListFilters(filters: CarrierListFilters) {
  const teamId = sanitizeFilterId(filters.teamId);
  const dispatcherId = sanitizeFilterId(filters.dispatcherId);
  const carrierId = sanitizeFilterId(filters.carrierId);
  const truckType = filters.truckType;

  const teamIds = [
    ...parseCsvParam(filters.teamIds),
    ...(teamId ? [teamId] : []),
  ];
  const dispatcherIds = [
    ...parseCsvParam(filters.dispatcherIds),
    ...(dispatcherId ? [dispatcherId] : []),
  ];
  const truckTypes = [
    ...parseCsvParam(filters.truckTypes),
    ...(truckType ? [truckType] : []),
  ] as TruckType[];
  const statuses = [
    ...parseCsvParam(filters.statuses),
    ...(filters.status ? [filters.status] : []),
  ] as CarrierStatus[];

  return {
    ...filters,
    teamId,
    dispatcherId,
    carrierId,
    truckType,
    teamIds: [...new Set(teamIds)],
    dispatcherIds: [...new Set(dispatcherIds)],
    truckTypes: [...new Set(truckTypes)],
    statuses: [...new Set(statuses)],
  };
}

async function assertCarrierListFilterAccess(
  scope: AccessScope,
  filters: ReturnType<typeof normalizeCarrierListFilters>,
): Promise<void> {
  for (const teamId of filters.teamIds) {
    await assertFilterAccess(scope, { teamId });
  }

  for (const dispatcherId of filters.dispatcherIds) {
    await assertFilterAccess(scope, { dispatcherId });
  }

  if (filters.carrierId) {
    await assertFilterAccess(scope, { carrierId: filters.carrierId });
  }
}

export async function listCarriers(
  scope: AccessScope,
  filters: CarrierListFilters = {},
): Promise<CarrierDto[]> {
  const parsed = normalizeCarrierListFilters(carrierListFiltersSchema.parse(filters));
  await assertCarrierListFilterAccess(scope, parsed);
  const carrierId = parsed.carrierId;

  let query = applyCarrierScopeQuery(
    asFilterable(
      db()
        .from(T.Carrier)
        .select(CARRIER_WITH_RELATIONS)
        .order("carrierName", { ascending: true }),
    ),
    scope,
  );

  if (parsed.teamIds.length === 1) {
    query = query.eq("teamId", parsed.teamIds[0]!) as typeof query;
  } else if (parsed.teamIds.length > 1) {
    query = query.in("teamId", parsed.teamIds) as typeof query;
  }

  if (parsed.dispatcherIds.length === 1) {
    query = query.eq("dispatcherId", parsed.dispatcherIds[0]!) as typeof query;
  } else if (parsed.dispatcherIds.length > 1) {
    query = query.in("dispatcherId", parsed.dispatcherIds) as typeof query;
  }

  if (carrierId) {
    query = query.eq("id", carrierId) as typeof query;
  }

  if (parsed.truckTypes.length === 1) {
    query = query.eq("truckType", parsed.truckTypes[0]!) as typeof query;
  } else if (parsed.truckTypes.length > 1) {
    query = query.in("truckType", parsed.truckTypes) as typeof query;
  }

  if (parsed.statuses.length === 1) {
    query = query.eq("status", parsed.statuses[0]!) as typeof query;
  } else if (parsed.statuses.length > 1) {
    query = query.in("status", parsed.statuses) as typeof query;
  }

  if (parsed.q) {
    query = query.or(
      buildIlikeOr(["carrierName", "driverName", "mcNumber"], parsed.q),
    ) as typeof query;
  }

  const rows = (assertDb(await query) ?? []) as CarrierRow[];

  return rows.map((row) => mapCarrier(normalizeCarrierRow(row)));
}

async function getCarrierRecord(
  scope: AccessScope,
  id: string,
): Promise<CarrierRow> {
  const result = await applyCarrierScopeQuery(
    db().from(T.Carrier).select(CARRIER_WITH_RELATIONS).eq("id", id),
    scope,
  ).maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new NotFoundError("Carrier not found.");
  }

  return normalizeCarrierRow(result.data as CarrierRow);
}

async function validateAssignment(
  organizationId: string,
  teamId: string,
  dispatcherId: string,
): Promise<{ teamName: string; dispatcherName: string }> {
  const teamResult = await db()
    .from(T.Team)
    .select("name")
    .eq("id", teamId)
    .eq("organizationId", organizationId)
    .is("deletedAt", null)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!teamResult.data) {
    throw new ValidationError("Team not found or inactive.");
  }

  const dispatcherResult = await db()
    .from(T.Dispatcher)
    .select("id, user:User!Dispatcher_userId_fkey(fullName)")
    .eq("id", dispatcherId)
    .eq("organizationId", organizationId)
    .eq("teamId", teamId)
    .is("deletedAt", null)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!dispatcherResult.data) {
    throw new ValidationError("Dispatcher not found on the selected team.");
  }

  const dispatcherUser = unwrapRelation(
    (
      dispatcherResult.data as {
        user: { fullName: string } | Array<{ fullName: string }>;
      }
    ).user,
  );

  return {
    teamName: teamResult.data.name,
    dispatcherName: dispatcherUser?.fullName ?? "",
  };
}

export async function createCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  input: CreateCarrierInput,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  const parsed = createCarrierInputSchema.parse(input);
  const mcNumber = normalizeMcNumber(parsed.mcNumber);

  assertTeamAssignment(scope, parsed.teamId);
  await assertAllowedTruckType(scope.organizationId, parsed.truckType);
  const feeRules = await getDispatchFeeRules(scope.organizationId);
  const dispatchFeePercentage =
    parsed.dispatchFeePercentage ?? feeRules.defaultPercentage;

  const duplicateResult = await db()
    .from(T.Carrier)
    .select("id")
    .eq("organizationId", scope.organizationId)
    .eq("mcNumber", mcNumber)
    .is("deletedAt", null)
    .maybeSingle();

  if (duplicateResult.data) {
    throw new ValidationError("A carrier with this MC number already exists.");
  }

  const { teamName, dispatcherName } = await validateAssignment(
    scope.organizationId,
    parsed.teamId,
    parsed.dispatcherId,
  );

  let carrierId: string | null = null;
  let historyId: string | null = null;

  try {
    const id = createId();
    carrierId = id;
    const timestamp = nowIso();

    const carrierResult = await db()
      .from(T.Carrier)
      .insert({
        id,
        organizationId: scope.organizationId,
        carrierName: parsed.carrierName,
        driverName: parsed.driverName,
        mcNumber,
        truckType: parsed.truckType,
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
        dispatchFeePercentage: String(dispatchFeePercentage),
        status: (parsed.status === "ACTIVE"
          ? "ACTIVE"
          : "INACTIVE") as CarrierStatus,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .select("id")
      .single();

    assertDb(carrierResult);

    const assignmentHistoryId = createId();
    historyId = assignmentHistoryId;

    const historyResult = await db()
      .from(T.CarrierAssignmentHistory)
      .insert({
        id: assignmentHistoryId,
        organizationId: scope.organizationId,
        carrierId: id,
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
        teamNameSnapshot: teamName,
        dispatcherNameSnapshot: dispatcherName,
        assignedByUserId: actor.id,
        notes: parsed.notes ?? null,
        assignedAt: timestamp,
      });

    assertDbVoid(historyResult);
  } catch (error) {
    if (historyId) {
      await ignoreDbError(
        db().from(T.CarrierAssignmentHistory).delete().eq("id", historyId),
      );
    }

    if (carrierId) {
      await ignoreDbError(db().from(T.Carrier).delete().eq("id", carrierId));
    }

    throw error;
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_CREATED",
    entityType: "Carrier",
    entityId: carrierId!,
    metadata: { mcNumber },
  });

  return mapCarrier(await getCarrierRecord(scope, carrierId!));
}

export async function updateCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: UpdateCarrierInput,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  const parsed = updateCarrierInputSchema.parse(input);

  const existing = await getCarrierRecord(scope, id);
  assertTeamAssignment(scope, existing.teamId);

  const mcNumber =
    parsed.mcNumber !== undefined
      ? normalizeMcNumber(parsed.mcNumber)
      : undefined;

  if (parsed.truckType !== undefined) {
    await assertAllowedTruckType(scope.organizationId, parsed.truckType);
  }

  if (mcNumber && mcNumber !== existing.mcNumber) {
    const duplicateResult = await db()
      .from(T.Carrier)
      .select("id")
      .eq("organizationId", scope.organizationId)
      .eq("mcNumber", mcNumber)
      .is("deletedAt", null)
      .neq("id", id)
      .maybeSingle();

    if (duplicateResult.data) {
      throw new ValidationError(
        "A carrier with this MC number already exists.",
      );
    }
  }

  const updateResult = await db()
    .from(T.Carrier)
    .update({
      ...(parsed.carrierName !== undefined
        ? { carrierName: parsed.carrierName }
        : {}),
      ...(parsed.driverName !== undefined
        ? { driverName: parsed.driverName }
        : {}),
      ...(mcNumber !== undefined ? { mcNumber } : {}),
      ...(parsed.truckType !== undefined
        ? { truckType: parsed.truckType }
        : {}),
      ...(parsed.dispatchFeePercentage !== undefined
        ? { dispatchFeePercentage: String(parsed.dispatchFeePercentage) }
        : {}),
      ...(parsed.status !== undefined
        ? {
            status: (parsed.status === "ACTIVE"
              ? "ACTIVE"
              : "INACTIVE") as CarrierStatus,
          }
        : {}),
      updatedAt: nowIso(),
    })
    .eq("id", id)
    .eq("organizationId", scope.organizationId);

  assertDbVoid(updateResult);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_UPDATED",
    entityType: "Carrier",
    entityId: id,
    metadata: parsed,
  });

  return mapCarrier(await getCarrierRecord(scope, id));
}

export async function activateCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  await getCarrierRecord(scope, id);

  const updateResult = await db()
    .from(T.Carrier)
    .update({ status: "ACTIVE", deletedAt: null, updatedAt: nowIso() })
    .eq("id", id)
    .eq("organizationId", scope.organizationId);

  assertDbVoid(updateResult);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_UPDATED",
    entityType: "Carrier",
    entityId: id,
    metadata: { status: "ACTIVE" },
  });

  return mapCarrier(await getCarrierRecord(scope, id));
}

export async function deactivateCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  await getCarrierRecord(scope, id);

  const updateResult = await db()
    .from(T.Carrier)
    .update({ status: "INACTIVE", deletedAt: nowIso(), updatedAt: nowIso() })
    .eq("id", id)
    .eq("organizationId", scope.organizationId);

  assertDbVoid(updateResult);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_DEACTIVATED",
    entityType: "Carrier",
    entityId: id,
  });

  return mapCarrier(await getCarrierRecord(scope, id));
}

export async function reassignCarrier(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: ReassignCarrierInput,
): Promise<CarrierDto> {
  requireAdminOrTeamLead(scope);
  const parsed = reassignCarrierInputSchema.parse(input);

  await getCarrierRecord(scope, id);
  assertTeamAssignment(scope, parsed.teamId);

  const { teamName, dispatcherName } = await validateAssignment(
    scope.organizationId,
    parsed.teamId,
    parsed.dispatcherId,
  );

  const openHistoriesResult = await db()
    .from(T.CarrierAssignmentHistory)
    .select("id")
    .eq("carrierId", id)
    .is("unassignedAt", null);

  const openHistories = (assertDb(openHistoriesResult) ?? []) as Array<{
    id: string;
  }>;
  const timestamp = nowIso();
  let newHistoryId: string | null = null;

  try {
    const closeResult = await db()
      .from(T.CarrierAssignmentHistory)
      .update({ unassignedAt: timestamp })
      .eq("carrierId", id)
      .is("unassignedAt", null);

    assertDbVoid(closeResult);

    newHistoryId = createId();

    const historyInsertResult = await db()
      .from(T.CarrierAssignmentHistory)
      .insert({
        id: newHistoryId,
        organizationId: scope.organizationId,
        carrierId: id,
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
        teamNameSnapshot: teamName,
        dispatcherNameSnapshot: dispatcherName,
        assignedByUserId: actor.id,
        notes: parsed.notes ?? null,
        assignedAt: timestamp,
      });

    assertDbVoid(historyInsertResult);

    const carrierUpdateResult = await db()
      .from(T.Carrier)
      .update({
        teamId: parsed.teamId,
        dispatcherId: parsed.dispatcherId,
        updatedAt: timestamp,
      })
      .eq("id", id)
      .eq("organizationId", scope.organizationId);

    assertDbVoid(carrierUpdateResult);
  } catch (error) {
    if (newHistoryId) {
      await ignoreDbError(
        db().from(T.CarrierAssignmentHistory).delete().eq("id", newHistoryId),
      );
    }

    for (const history of openHistories) {
      await ignoreDbError(
        db()
          .from(T.CarrierAssignmentHistory)
          .update({ unassignedAt: null })
          .eq("id", history.id),
      );
    }

    throw error;
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "CARRIER_REASSIGNED",
    entityType: "Carrier",
    entityId: id,
    metadata: {
      teamId: parsed.teamId,
      dispatcherId: parsed.dispatcherId,
    },
  });

  return mapCarrier(await getCarrierRecord(scope, id));
}
