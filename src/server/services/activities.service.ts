import "server-only";

import { z } from "zod";
import type { LoadActivityStatus } from "@/lib/db/types";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";
import { TEAM_LEAD } from "@/lib/constants/roles";
import { T, db } from "@/lib/db/client";
import {
  assertDb,
  assertDbVoid,
  createId,
  decimalToNumber,
  nowIso,
  toDateOnly,
} from "@/lib/db/utils";
import type { DailyActivity as DailyActivityDto } from "@/lib/types";
import { calculateDispatchFee } from "@/lib/utils/calculate-dispatch-fee";
import { calculateRatePerMile } from "@/lib/utils/calculate-rate-per-mile";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapDailyActivity } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  assertAllowedStatusReason,
  getDispatchFeeRules,
} from "@/server/services/settings.service";
import {
  activityFiltersSchema,
  applyActivityFilters,
  assertFilterAccess,
  parseActivityDate,
  type ActivityFilters,
} from "@/server/utils/activity-filters";
import { activityScopeFilter } from "@/server/utils/scope-filters";

const activityPayloadSchema = z.object({
  status: z.enum(STATUSES, { message: "Status is required" }),
  notes: z.string().trim().optional(),
  origin: z.string().trim().optional(),
  destination: z.string().trim().optional(),
  totalMiles: z.number().optional(),
  loadAmount: z.number().optional(),
  reason: z.string().trim().optional(),
});

function refineActivityPayload(
  data: z.infer<typeof activityPayloadSchema>,
  context: z.RefinementCtx,
): void {
  if (data.status === DELIVERED) {
    if (!data.origin?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Origin is required for delivered loads",
        path: ["origin"],
      });
    }

    if (!data.destination?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Destination is required for delivered loads",
        path: ["destination"],
      });
    }

    if (data.totalMiles === undefined || data.totalMiles <= 0) {
      context.addIssue({
        code: "custom",
        message: "Total miles must be greater than 0",
        path: ["totalMiles"],
      });
    }

    if (data.loadAmount === undefined || data.loadAmount <= 0) {
      context.addIssue({
        code: "custom",
        message: "Load amount must be greater than 0",
        path: ["loadAmount"],
      });
    }

    return;
  }

  if (
    data.status === CANCELLED ||
    data.status === NOT_BOOKED ||
    data.status === NOT_WORKING
  ) {
    if (!data.reason?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Reason is required for this status",
        path: ["reason"],
      });
    }
  }
}

const createActivityInputSchema = z
  .object({
    carrierId: z.string().trim().min(1, "Carrier is required"),
    activityDate: z.string().min(1, "Date is required"),
  })
  .merge(activityPayloadSchema)
  .superRefine(refineActivityPayload);

const updateActivityInputSchema = activityPayloadSchema.partial().extend({
  activityDate: z.string().min(1).optional(),
});

const validatedActivityPayloadSchema = activityPayloadSchema.superRefine(
  refineActivityPayload,
);

type CreateActivityInput = z.infer<typeof createActivityInputSchema>;
type UpdateActivityInput = z.infer<typeof updateActivityInputSchema>;

type CarrierWithRelations = {
  id: string;
  teamId: string;
  dispatcherId: string | null;
  status: string;
  deletedAt: string | null;
  carrierName: string;
  driverName: string;
  truckType: string;
  dispatchFeePercentage: string;
  team: { id: string; name: string } | { id: string; name: string }[] | null;
  dispatcher:
    | {
        id: string;
        user: { fullName: string } | { fullName: string }[];
      }
    | {
        id: string;
        user: { fullName: string } | { fullName: string }[];
      }[]
    | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toDecimalString(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function applyActivityScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  scope: AccessScope,
): T {
  const scopeFilter = activityScopeFilter(scope);

  if ("dispatcherId" in scopeFilter && scopeFilter.dispatcherId) {
    return query.eq("dispatcherId", scopeFilter.dispatcherId);
  }

  if ("teamId" in scopeFilter && scopeFilter.teamId) {
    return query.eq("teamId", scopeFilter.teamId);
  }

  if ("id" in scopeFilter && scopeFilter.id) {
    return query.eq("id", scopeFilter.id);
  }

  return query;
}

async function assertCarrierAccess(
  scope: AccessScope,
  carrier: {
    id: string;
    teamId: string;
    dispatcherId: string | null;
    status: string;
    deletedAt: string | null;
  },
): Promise<void> {
  if (carrier.deletedAt || carrier.status !== "ACTIVE") {
    throw new ValidationError("Carrier is not active.");
  }

  if (scope.isCompanyWide) {
    return;
  }

  if (scope.role === TEAM_LEAD && scope.teamId !== carrier.teamId) {
    throw new ForbiddenError(
      "You can only log activity for carriers on your team.",
    );
  }

  if (
    scope.role === "DISPATCHER" &&
    scope.dispatcherId !== carrier.dispatcherId
  ) {
    throw new ForbiddenError(
      "You can only log activity for your assigned carriers.",
    );
  }
}

function computeFinancials(
  status: LoadActivityStatus,
  totalMiles: number | undefined,
  loadAmount: number | undefined,
  dispatchFeePercentage: number,
  feeRules: {
    minimumFee: number;
    roundToNearestDollar: boolean;
  },
): { ratePerMile: number | null; dispatchFee: number | null } {
  if (status !== DELIVERED || !totalMiles || !loadAmount) {
    return { ratePerMile: null, dispatchFee: null };
  }

  return {
    ratePerMile: calculateRatePerMile(loadAmount, totalMiles),
    dispatchFee: calculateDispatchFee(loadAmount, dispatchFeePercentage, {
      minimumFee: feeRules.minimumFee,
      roundToNearestDollar: feeRules.roundToNearestDollar,
    }),
  };
}

export async function upsertDailySubmission(
  organizationId: string,
  dispatcherId: string,
  teamId: string,
  submissionDate: Date,
): Promise<void> {
  const dateKey = toDateOnly(submissionDate);

  const activitiesResult = await db()
    .from(T.DailyActivity)
    .select("carrierId")
    .eq("dispatcherId", dispatcherId)
    .eq("activityDate", dateKey);

  const activities = assertDb(activitiesResult) ?? [];
  const carrierIds = new Set(activities.map((activity) => activity.carrierId));

  const upsertPayload = {
    organizationId,
    dispatcherId,
    teamId,
    submissionDate: dateKey,
    carrierCount: carrierIds.size,
    activityCount: activities.length,
    submittedAt: nowIso(),
  };

  const existingSubmissionResult = await db()
    .from(T.DailySubmission)
    .select("id")
    .eq("dispatcherId", dispatcherId)
    .eq("submissionDate", dateKey)
    .maybeSingle();

  if (existingSubmissionResult.error) {
    throw new Error(existingSubmissionResult.error.message);
  }

  if (existingSubmissionResult.data) {
    const updateResult = await db()
      .from(T.DailySubmission)
      .update(upsertPayload)
      .eq("id", existingSubmissionResult.data.id);

    assertDbVoid(updateResult);
    return;
  }

  const insertResult = await db()
    .from(T.DailySubmission)
    .insert({
      id: createId(),
      ...upsertPayload,
    });

  assertDbVoid(insertResult);
}

export async function listActivities(
  scope: AccessScope,
  filters: ActivityFilters = {},
): Promise<DailyActivityDto[]> {
  const parsedFilters = activityFiltersSchema.parse(filters);
  await assertFilterAccess(scope, parsedFilters);

  let query = db().from(T.DailyActivity).select("*");
  query = applyActivityFilters(query, scope, parsedFilters);

  const activitiesResult = await query
    .order("activityDate", { ascending: false })
    .order("createdAt", { ascending: false });

  const activities = assertDb(activitiesResult) ?? [];

  return activities.map(mapDailyActivity);
}

export async function createActivity(
  scope: AccessScope,
  actor: AuthContextUser,
  input: CreateActivityInput,
): Promise<DailyActivityDto> {
  const parsed = createActivityInputSchema.parse(input);
  const activityDate = parseActivityDate(parsed.activityDate);
  const activityDateKey = toDateOnly(activityDate);

  const carrierResult = await db()
    .from(T.Carrier)
    .select(
      "id, teamId, dispatcherId, status, deletedAt, carrierName, driverName, truckType, dispatchFeePercentage, team:Team!Carrier_teamId_fkey(id, name), dispatcher:Dispatcher!Carrier_dispatcherId_fkey(id, user:User!Dispatcher_userId_fkey(fullName))",
    )
    .eq("id", parsed.carrierId)
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .maybeSingle();

  if (carrierResult.error) {
    throw new Error(carrierResult.error.message);
  }

  const carrierRow = carrierResult.data as CarrierWithRelations | null;

  if (!carrierRow) {
    throw new NotFoundError("Carrier not found.");
  }

  const team = unwrapRelation(carrierRow.team);
  const dispatcher = unwrapRelation(carrierRow.dispatcher);
  const dispatcherUser = dispatcher ? unwrapRelation(dispatcher.user) : null;

  if (!carrierRow.dispatcherId || !dispatcher || !dispatcherUser || !team) {
    throw new NotFoundError("Carrier not found.");
  }

  await assertCarrierAccess(scope, carrierRow);

  if (parsed.reason?.trim()) {
    await assertAllowedStatusReason(scope.organizationId, parsed.reason);
  }

  const duplicateResult = await db()
    .from(T.DailyActivity)
    .select("id")
    .eq("carrierId", parsed.carrierId)
    .eq("activityDate", activityDateKey)
    .maybeSingle();

  if (duplicateResult.error) {
    throw new Error(duplicateResult.error.message);
  }

  if (duplicateResult.data) {
    throw new ValidationError(
      "An activity for this carrier on this date already exists.",
    );
  }

  const feeRules = await getDispatchFeeRules(scope.organizationId);
  const dispatchFeePercentage =
    decimalToNumber(carrierRow.dispatchFeePercentage) ??
    feeRules.defaultPercentage;
  const { ratePerMile, dispatchFee } = computeFinancials(
    parsed.status,
    parsed.totalMiles,
    parsed.loadAmount,
    dispatchFeePercentage,
    feeRules,
  );

  const activityResult = await db()
    .from(T.DailyActivity)
    .insert({
      id: createId(),
      organizationId: scope.organizationId,
      activityDate: activityDateKey,
      carrierId: carrierRow.id,
      dispatcherId: carrierRow.dispatcherId,
      teamId: carrierRow.teamId,
      status: parsed.status,
      carrierNameSnapshot: carrierRow.carrierName,
      driverNameSnapshot: carrierRow.driverName,
      dispatcherNameSnapshot: dispatcherUser.fullName,
      teamNameSnapshot: team.name,
      truckTypeSnapshot: carrierRow.truckType,
      dispatchFeePercentageSnapshot: String(dispatchFeePercentage),
      origin: parsed.origin?.trim() || null,
      destination: parsed.destination?.trim() || null,
      totalMiles: toDecimalString(parsed.totalMiles),
      loadAmount: toDecimalString(parsed.loadAmount),
      ratePerMile: toDecimalString(ratePerMile),
      dispatchFee: toDecimalString(dispatchFee),
      reason: parsed.reason?.trim() || null,
      notes: parsed.notes?.trim() || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    .select("*")
    .single();

  const activity = assertDb(activityResult);

  await upsertDailySubmission(
    scope.organizationId,
    carrierRow.dispatcherId,
    carrierRow.teamId,
    activityDate,
  );

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "ACTIVITY_CREATED",
    entityType: "DailyActivity",
    entityId: activity.id,
    metadata: {
      carrierId: carrierRow.id,
      activityDate: parsed.activityDate,
      status: parsed.status,
    },
  });

  return mapDailyActivity(activity);
}

export async function updateActivity(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: UpdateActivityInput,
): Promise<DailyActivityDto> {
  const parsed = updateActivityInputSchema.parse(input);

  let existingQuery = db()
    .from(T.DailyActivity)
    .select("*")
    .eq("id", id)
    .eq("organizationId", scope.organizationId);

  existingQuery = applyActivityScope(existingQuery, scope);

  const existingResult = await existingQuery.maybeSingle();

  if (existingResult.error) {
    throw new Error(existingResult.error.message);
  }

  const existing = existingResult.data;

  if (!existing) {
    throw new NotFoundError("Activity not found.");
  }

  const merged = {
    status: parsed.status ?? existing.status,
    origin: parsed.origin ?? existing.origin ?? undefined,
    destination: parsed.destination ?? existing.destination ?? undefined,
    totalMiles:
      parsed.totalMiles ?? decimalToNumber(existing.totalMiles) ?? undefined,
    loadAmount:
      parsed.loadAmount ?? decimalToNumber(existing.loadAmount) ?? undefined,
    reason: parsed.reason ?? existing.reason ?? undefined,
    notes: parsed.notes ?? existing.notes ?? undefined,
  };

  const normalized =
    merged.status === DELIVERED
      ? {
          ...merged,
          reason: undefined,
        }
      : {
          ...merged,
          origin: undefined,
          destination: undefined,
          totalMiles: undefined,
          loadAmount: undefined,
        };

  validatedActivityPayloadSchema.parse(normalized);

  if (normalized.reason?.trim()) {
    await assertAllowedStatusReason(scope.organizationId, normalized.reason);
  }

  const activityDate = parsed.activityDate
    ? parseActivityDate(parsed.activityDate)
    : parseActivityDate(existing.activityDate);
  const activityDateKey = toDateOnly(activityDate);

  if (parsed.activityDate) {
    const duplicateResult = await db()
      .from(T.DailyActivity)
      .select("id")
      .eq("carrierId", existing.carrierId)
      .eq("activityDate", activityDateKey)
      .neq("id", id)
      .maybeSingle();

    if (duplicateResult.error) {
      throw new Error(duplicateResult.error.message);
    }

    if (duplicateResult.data) {
      throw new ValidationError(
        "An activity for this carrier on this date already exists.",
      );
    }
  }

  const dispatchFeePercentage =
    decimalToNumber(existing.dispatchFeePercentageSnapshot) ?? 0;
  const feeRules = await getDispatchFeeRules(scope.organizationId);
  const { ratePerMile, dispatchFee } = computeFinancials(
    normalized.status,
    normalized.totalMiles,
    normalized.loadAmount,
    dispatchFeePercentage,
    feeRules,
  );

  const updatePayload: Record<string, unknown> = {
    status: normalized.status,
    origin:
      normalized.status === DELIVERED
        ? normalized.origin?.trim() || null
        : null,
    destination:
      normalized.status === DELIVERED
        ? normalized.destination?.trim() || null
        : null,
    totalMiles:
      normalized.status === DELIVERED
        ? toDecimalString(normalized.totalMiles)
        : null,
    loadAmount:
      normalized.status === DELIVERED
        ? toDecimalString(normalized.loadAmount)
        : null,
    ratePerMile: toDecimalString(ratePerMile),
    dispatchFee: toDecimalString(dispatchFee),
    reason:
      normalized.status === DELIVERED
        ? null
        : normalized.reason?.trim() || null,
    updatedAt: nowIso(),
  };

  if (parsed.activityDate !== undefined) {
    updatePayload.activityDate = activityDateKey;
  }

  if (parsed.notes !== undefined) {
    updatePayload.notes = parsed.notes?.trim() || null;
  }

  const activityResult = await db()
    .from(T.DailyActivity)
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  const activity = assertDb(activityResult);

  await upsertDailySubmission(
    scope.organizationId,
    existing.dispatcherId,
    existing.teamId,
    activityDate,
  );

  if (
    parsed.activityDate &&
    activityDateKey !== toDateOnly(existing.activityDate)
  ) {
    await upsertDailySubmission(
      scope.organizationId,
      existing.dispatcherId,
      existing.teamId,
      parseActivityDate(existing.activityDate),
    );
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "ACTIVITY_UPDATED",
    entityType: "DailyActivity",
    entityId: activity.id,
    metadata: parsed,
  });

  return mapDailyActivity(activity);
}
