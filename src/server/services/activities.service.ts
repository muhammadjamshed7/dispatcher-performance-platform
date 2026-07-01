import "server-only";

import { z } from "zod";
import type { JsonValue, LoadActivityStatus } from "@/lib/db/types";
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
import { TEAM_LEAD, ADMIN, DISPATCHER } from "@/lib/constants/roles";
import {
  NOTIFICATION_CHANGES_REQUESTED,
  NOTIFICATION_COMPLETED,
  NOTIFICATION_REJECTED,
} from "@/lib/constants/notifications";
import {
  NEW_ACTIVITY,
  APPROVED,
  PENDING_ADMIN_APPROVAL,
  PENDING_TEAM_LEAD_APPROVAL,
  PENDING_APPROVAL_STATUSES,
  REJECTED,
  type ActivityApprovalStatus,
} from "@/lib/constants/activity-approval";
import { T, db } from "@/lib/db/client";
import {
  assertDb,
  createId,
  decimalToNumber,
  nowIso,
  toDateOnly,
  unwrapRelation,
} from "@/lib/db/utils";
import type { DailyActivity as DailyActivityDto } from "@/lib/types";
import { calculateDispatchFee } from "@/lib/utils/calculate-dispatch-fee";
import { calculateRatePerMile } from "@/lib/utils/calculate-rate-per-mile";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapDailyActivity } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import { upsertDailySubmission } from "@/server/services/daily-submissions.service";
import {
  notifyDispatcherOutcome,
  notifyFinalApprovalCompleted,
  notifyNewActivitySubmitted,
  updateEntityNotificationStatuses,
} from "@/server/services/notifications.service";
import { createEditRequest } from "@/server/services/activity-edit-requests.service";
import {
  assertAllowedStatusReason,
  getDispatchFeeRules,
  getDirectAdminApprovalMode,
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

const STALE_APPROVAL_MESSAGE =
  "This record was already updated. Please refresh and try again.";

const rejectActivityInputSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required"),
  requestChanges: z.boolean().optional(),
  approvalNotes: z.string().trim().optional(),
});

type RejectActivityInput = z.infer<typeof rejectActivityInputSchema>;

function buildApprovedFields(actorUserId: string) {
  const timestamp = nowIso();
  return {
    approvalStatus: APPROVED as ActivityApprovalStatus,
    submittedById: actorUserId,
    submittedAt: timestamp,
    adminApprovedById: actorUserId,
    adminApprovedAt: timestamp,
    teamLeadApprovedById: null,
    teamLeadApprovedAt: null,
    rejectedById: null,
    rejectionReason: null,
    rejectedAt: null,
  };
}

function buildPendingSubmissionFields(
  actorUserId: string,
  approvalStatus: ActivityApprovalStatus,
) {
  return {
    approvalStatus,
    submittedById: actorUserId,
    submittedAt: nowIso(),
    teamLeadApprovedById: null,
    teamLeadApprovedAt: null,
    adminApprovedById: null,
    adminApprovedAt: null,
    rejectedById: null,
    rejectionReason: null,
    rejectedAt: null,
  };
}

async function resolveDispatcherSubmissionStatus(
  organizationId: string,
): Promise<ActivityApprovalStatus> {
  const directAdminApproval = await getDirectAdminApprovalMode(organizationId);
  return directAdminApproval
    ? PENDING_ADMIN_APPROVAL
    : PENDING_TEAM_LEAD_APPROVAL;
}

async function resolveCreateApprovalFields(
  scope: AccessScope,
  actorUserId: string,
) {
  if (scope.role === ADMIN) {
    return buildApprovedFields(actorUserId);
  }

  if (scope.role === TEAM_LEAD) {
    return buildPendingSubmissionFields(actorUserId, PENDING_ADMIN_APPROVAL);
  }

  const approvalStatus = await resolveDispatcherSubmissionStatus(
    scope.organizationId,
  );
  return buildPendingSubmissionFields(actorUserId, approvalStatus);
}

function buildResubmitApprovalFields(
  scope: AccessScope,
  actorUserId: string,
  directAdminApproval: boolean,
) {
  if (scope.role === ADMIN) {
    return buildApprovedFields(actorUserId);
  }

  if (scope.role === TEAM_LEAD) {
    return buildPendingSubmissionFields(actorUserId, PENDING_ADMIN_APPROVAL);
  }

  const approvalStatus = directAdminApproval
    ? PENDING_ADMIN_APPROVAL
    : PENDING_TEAM_LEAD_APPROVAL;
  return buildPendingSubmissionFields(actorUserId, approvalStatus);
}

async function getActivityInScope(
  scope: AccessScope,
  id: string,
): Promise<Record<string, unknown>> {
  let query = db()
    .from(T.DailyActivity)
    .select("*")
    .eq("id", id)
    .eq("organizationId", scope.organizationId);

  query = applyActivityScope(query, scope);

  const result = await query.maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    throw new NotFoundError("Activity not found.");
  }

  return result.data as Record<string, unknown>;
}

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
  const mapped = activities.map(mapDailyActivity);

  // Resolve the approver's display name (team lead or admin) for approved
  // activities so the UI can show "Approved by <name> (<role>)".
  const approverIdByActivity = new Map<string, string>();
  const approverIds = new Set<string>();
  for (const row of activities) {
    if (row.approvalStatus === APPROVED) {
      const approverId = (row.adminApprovedById ?? row.teamLeadApprovedById) as
        | string
        | null;
      if (approverId) {
        approverIdByActivity.set(row.id as string, approverId);
        approverIds.add(approverId);
      }
    }
  }

  if (approverIds.size > 0) {
    const usersResult = await db()
      .from(T.User)
      .select("id, fullName")
      .in("id", [...approverIds]);
    const users = assertDb(usersResult) ?? [];
    const nameById = new Map(
      users.map((user) => [user.id as string, user.fullName as string]),
    );
    for (const activity of mapped) {
      const approverId = approverIdByActivity.get(activity.id);
      if (approverId) {
        activity.approvedByName = nameById.get(approverId) ?? null;
      }
    }
  }

  // Surface in-flight edit requests so an approved activity with a pending edit
  // shows as pending (team lead / admin review) until the edit is approved.
  const approvedActivityIds = mapped
    .filter((activity) => activity.approvalStatus === APPROVED)
    .map((activity) => activity.id);

  if (approvedActivityIds.length > 0) {
    const pendingEditsResult = await db()
      .from(T.ActivityEditRequest)
      .select("originalActivityId, approvalStatus")
      .eq("organizationId", scope.organizationId)
      .in("originalActivityId", approvedActivityIds)
      .in("approvalStatus", [
        PENDING_TEAM_LEAD_APPROVAL,
        PENDING_ADMIN_APPROVAL,
      ]);

    const pendingEdits = (assertDb(pendingEditsResult) ?? []) as Array<{
      originalActivityId: string;
      approvalStatus: ActivityApprovalStatus;
    }>;

    if (pendingEdits.length > 0) {
      const pendingByActivity = new Map<string, ActivityApprovalStatus>();
      for (const edit of pendingEdits) {
        pendingByActivity.set(edit.originalActivityId, edit.approvalStatus);
      }

      for (const activity of mapped) {
        const pendingStatus = pendingByActivity.get(activity.id);
        if (pendingStatus) {
          activity.hasPendingEdit = true;
          activity.pendingEditApprovalStatus = pendingStatus;
        }
      }
    }
  }

  return mapped;
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

  const approvalFields = await resolveCreateApprovalFields(scope, actor.id);

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
      approvalType: NEW_ACTIVITY,
      ...approvalFields,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    .select("*")
    .single();

  const activity = assertDb(activityResult);

  if (approvalFields.approvalStatus === APPROVED) {
    await upsertDailySubmission(
      scope.organizationId,
      carrierRow.dispatcherId,
      carrierRow.teamId,
      activityDate,
    );
  }

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action:
      approvalFields.approvalStatus === APPROVED
        ? "ACTIVITY_CREATED"
        : "ACTIVITY_SUBMITTED",
    entityType: "DailyActivity",
    entityId: activity.id,
    metadata: {
      entityName: `${carrierRow.carrierName} - ${parsed.activityDate}`,
      carrierName: carrierRow.carrierName,
      carrierId: carrierRow.id,
      activityDate: parsed.activityDate,
      status: parsed.status,
      approvalStatus: approvalFields.approvalStatus,
      teamName: team.name,
      dispatcherName: dispatcherUser.fullName,
    },
  });

  if (approvalFields.approvalStatus !== APPROVED) {
    await notifyNewActivitySubmitted({
      organizationId: scope.organizationId,
      teamId: carrierRow.teamId,
      activityId: activity.id,
      carrierName: carrierRow.carrierName,
      activityDate: parsed.activityDate,
      dispatcherName: dispatcherUser.fullName,
      approvalStatus: approvalFields.approvalStatus,
    });
  }

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

  const previousApprovalStatus =
    (existing.approvalStatus as ActivityApprovalStatus | undefined) ?? APPROVED;
  const wasApproved = previousApprovalStatus === APPROVED;
  const directAdminApproval = await getDirectAdminApprovalMode(
    scope.organizationId,
  );

  if (wasApproved && scope.role !== ADMIN) {
    const proposed = {
      activityDate: parsed.activityDate,
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
          ? (normalized.totalMiles ?? null)
          : null,
      loadAmount:
        normalized.status === DELIVERED
          ? (normalized.loadAmount ?? null)
          : null,
      reason:
        normalized.status === DELIVERED
          ? null
          : normalized.reason?.trim() || null,
      notes:
        parsed.notes !== undefined ? parsed.notes?.trim() || null : undefined,
    };

    await createEditRequest(scope, actor, existing, proposed);
    return mapDailyActivity(existing);
  }

  if (scope.role === DISPATCHER) {
    Object.assign(
      updatePayload,
      buildResubmitApprovalFields(scope, actor.id, directAdminApproval),
    );
  } else if (scope.role === TEAM_LEAD && !wasApproved) {
    Object.assign(
      updatePayload,
      buildPendingSubmissionFields(actor.id, PENDING_ADMIN_APPROVAL),
    );
  } else if (scope.role === ADMIN && !wasApproved) {
    Object.assign(updatePayload, buildApprovedFields(actor.id));
  }

  const activityResult = await db()
    .from(T.DailyActivity)
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  const activity = assertDb(activityResult);
  const nextApprovalStatus = activity.approvalStatus as ActivityApprovalStatus;

  if (nextApprovalStatus === APPROVED) {
    await upsertDailySubmission(
      scope.organizationId,
      existing.dispatcherId as string,
      existing.teamId as string,
      activityDate,
    );
  } else if (wasApproved) {
    await upsertDailySubmission(
      scope.organizationId,
      existing.dispatcherId as string,
      existing.teamId as string,
      parseActivityDate(existing.activityDate as string),
    );
  }

  if (
    parsed.activityDate &&
    activityDateKey !== toDateOnly(existing.activityDate as string) &&
    wasApproved
  ) {
    await upsertDailySubmission(
      scope.organizationId,
      existing.dispatcherId as string,
      existing.teamId as string,
      parseActivityDate(existing.activityDate as string),
    );
  }

  const auditAction =
    scope.role === DISPATCHER ||
    (scope.role === TEAM_LEAD && !wasApproved) ||
    (previousApprovalStatus &&
      PENDING_APPROVAL_STATUSES.includes(
        previousApprovalStatus as (typeof PENDING_APPROVAL_STATUSES)[number],
      ))
      ? "ACTIVITY_PENDING_UPDATED"
      : "ACTIVITY_UPDATED";

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: auditAction,
    entityType: "DailyActivity",
    entityId: activity.id,
    metadata: {
      entityName: `${existing.carrierNameSnapshot as string} - ${String(
        existing.activityDate,
      ).slice(0, 10)}`,
      previousData: wasApproved ? snapshotActivityFields(existing) : null,
      proposedChanges: parsed,
      approvalStatus: nextApprovalStatus,
      teamName: existing.teamNameSnapshot as string,
      dispatcherName: existing.dispatcherNameSnapshot as string,
    } as JsonValue,
  });

  // Re-submitting a pending/rejected activity for review notifies both the team
  // lead and admins so either authorized role can approve first.
  if (
    PENDING_APPROVAL_STATUSES.includes(
      nextApprovalStatus as (typeof PENDING_APPROVAL_STATUSES)[number],
    )
  ) {
    await notifyNewActivitySubmitted({
      organizationId: scope.organizationId,
      teamId: existing.teamId as string,
      activityId: activity.id,
      carrierName: existing.carrierNameSnapshot as string,
      activityDate: String(activity.activityDate).slice(0, 10),
      dispatcherName: existing.dispatcherNameSnapshot as string,
      approvalStatus: nextApprovalStatus,
    });
  }

  return mapDailyActivity(activity);
}

function snapshotActivityFields(activity: Record<string, unknown>) {
  return {
    activityDate: activity.activityDate,
    status: activity.status,
    origin: activity.origin,
    destination: activity.destination,
    totalMiles: activity.totalMiles,
    loadAmount: activity.loadAmount,
    ratePerMile: activity.ratePerMile,
    dispatchFee: activity.dispatchFee,
    reason: activity.reason,
    notes: activity.notes,
  };
}

export async function listPendingActivities(
  scope: AccessScope,
): Promise<DailyActivityDto[]> {
  const approvalStatuses: ActivityApprovalStatus[] =
    scope.role === ADMIN
      ? [PENDING_TEAM_LEAD_APPROVAL, PENDING_ADMIN_APPROVAL]
      : scope.role === TEAM_LEAD
        ? [PENDING_TEAM_LEAD_APPROVAL]
        : [];

  if (approvalStatuses.length === 0) {
    throw new ForbiddenError("You do not have access to pending approvals.");
  }

  let query = db().from(T.DailyActivity).select("*");
  query = applyActivityScope(query, scope);
  query = query.in("approvalStatus", approvalStatuses);

  const activitiesResult = await query
    .order("submittedAt", { ascending: false })
    .order("activityDate", { ascending: false });

  const activities = assertDb(activitiesResult) ?? [];
  return activities.map(mapDailyActivity);
}

export async function approveActivity(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input?: { approvalNotes?: string },
): Promise<DailyActivityDto> {
  const existing = await getActivityInScope(scope, id);
  const currentStatus = existing.approvalStatus as ActivityApprovalStatus;
  const teamId = existing.teamId as string;
  const timestamp = nowIso();

  // Parallel approval: the first authorized approver (team lead OR admin)
  // finalizes the activity. Team leads may finalize submissions awaiting team
  // lead review on their own team; admins may finalize any pending submission.
  if (scope.role === TEAM_LEAD) {
    if (currentStatus !== PENDING_TEAM_LEAD_APPROVAL) {
      throw new ValidationError(
        "This submission is no longer awaiting team lead approval.",
      );
    }

    if (!scope.teamId || scope.teamId !== teamId) {
      throw new ForbiddenError("You can only approve activities on your team.");
    }

    const activityResult = await db()
      .from(T.DailyActivity)
      .update({
        approvalStatus: APPROVED,
        teamLeadApprovedById: actor.id,
        teamLeadApprovedAt: timestamp,
        adminApprovedById: null,
        adminApprovedAt: null,
        approvalNotes: input?.approvalNotes ?? null,
        rejectedById: null,
        rejectionReason: null,
        rejectedAt: null,
        updatedAt: timestamp,
      })
      .eq("id", id)
      .eq("approvalStatus", PENDING_TEAM_LEAD_APPROVAL)
      .select("*")
      .maybeSingle();

    const activity = assertDb(activityResult, STALE_APPROVAL_MESSAGE);

    await upsertDailySubmission(
      scope.organizationId,
      existing.dispatcherId as string,
      teamId,
      parseActivityDate(existing.activityDate as string),
    );

    await writeAuditLog({
      organizationId: scope.organizationId,
      actorUserId: actor.id,
      action: "ACTIVITY_APPROVED_BY_TEAM_LEAD",
      entityType: "DailyActivity",
      entityId: id,
      metadata: {
        entityName: `${existing.carrierNameSnapshot as string} - ${String(
          existing.activityDate,
        ).slice(0, 10)}`,
        teamName: existing.teamNameSnapshot as string,
        dispatcherName: existing.dispatcherNameSnapshot as string,
        approvalStatus: APPROVED,
        previousStatus: currentStatus,
      } as JsonValue,
    });

    // Mark every pending approval notification for this activity (team lead AND
    // admin copies) as completed so the other authorized role cannot approve it
    // again.
    await updateEntityNotificationStatuses({
      activityId: id,
      notificationStatus: NOTIFICATION_COMPLETED,
    });

    await notifyFinalApprovalCompleted({
      organizationId: scope.organizationId,
      dispatcherId: existing.dispatcherId as string,
      activityId: id,
      carrierName: existing.carrierNameSnapshot as string,
      activityDate: String(existing.activityDate).slice(0, 10),
      approverRole: TEAM_LEAD,
      approverName: actor.fullName,
    });

    return mapDailyActivity(activity);
  }

  if (scope.role !== ADMIN) {
    throw new ForbiddenError("Admin or team lead access is required.");
  }

  if (
    currentStatus !== PENDING_ADMIN_APPROVAL &&
    currentStatus !== PENDING_TEAM_LEAD_APPROVAL
  ) {
    throw new ValidationError("This activity is not awaiting approval.");
  }

  const activityResult = await db()
    .from(T.DailyActivity)
    .update({
      approvalStatus: APPROVED,
      adminApprovedById: actor.id,
      adminApprovedAt: timestamp,
      teamLeadApprovedById: null,
      teamLeadApprovedAt: null,
      approvalNotes: input?.approvalNotes ?? null,
      rejectedById: null,
      rejectionReason: null,
      rejectedAt: null,
      updatedAt: timestamp,
    })
    .eq("id", id)
    .eq("approvalStatus", currentStatus)
    .select("*")
    .maybeSingle();

  const activity = assertDb(activityResult, STALE_APPROVAL_MESSAGE);

  await upsertDailySubmission(
    scope.organizationId,
    existing.dispatcherId as string,
    teamId,
    parseActivityDate(existing.activityDate as string),
  );

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "ACTIVITY_APPROVED_BY_ADMIN",
    entityType: "DailyActivity",
    entityId: id,
    metadata: {
      entityName: `${existing.carrierNameSnapshot as string} - ${String(
        existing.activityDate,
      ).slice(0, 10)}`,
      previousStatus: currentStatus,
      teamName: existing.teamNameSnapshot as string,
      dispatcherName: existing.dispatcherNameSnapshot as string,
      approvalStatus: APPROVED,
    } as JsonValue,
  });

  await updateEntityNotificationStatuses({
    activityId: id,
    notificationStatus: NOTIFICATION_COMPLETED,
  });

  await notifyFinalApprovalCompleted({
    organizationId: scope.organizationId,
    dispatcherId: existing.dispatcherId as string,
    activityId: id,
    carrierName: existing.carrierNameSnapshot as string,
    activityDate: String(existing.activityDate).slice(0, 10),
    approverRole: ADMIN,
    approverName: actor.fullName,
  });

  return mapDailyActivity(activity);
}

export async function rejectActivity(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: RejectActivityInput,
): Promise<DailyActivityDto> {
  const parsed = rejectActivityInputSchema.parse(input);
  const existing = await getActivityInScope(scope, id);
  const currentStatus = existing.approvalStatus as ActivityApprovalStatus;
  const teamId = existing.teamId as string;
  const timestamp = nowIso();

  if (
    currentStatus !== PENDING_TEAM_LEAD_APPROVAL &&
    currentStatus !== PENDING_ADMIN_APPROVAL
  ) {
    throw new ValidationError("Only pending activities can be rejected.");
  }

  if (scope.role === TEAM_LEAD) {
    if (currentStatus !== PENDING_TEAM_LEAD_APPROVAL) {
      throw new ValidationError(
        "Team leads can only reject activities pending team lead review.",
      );
    }

    if (!scope.teamId || scope.teamId !== teamId) {
      throw new ForbiddenError("You can only reject activities on your team.");
    }
  } else if (scope.role !== ADMIN) {
    throw new ForbiddenError("Admin or team lead access is required.");
  }

  const rejectionReason = parsed.requestChanges
    ? `Changes requested: ${parsed.reason}`
    : parsed.reason;

  const activityResult = await db()
    .from(T.DailyActivity)
    .update({
      approvalStatus: REJECTED,
      rejectedById: actor.id,
      rejectionReason,
      approvalNotes: parsed.approvalNotes ?? null,
      rejectedAt: timestamp,
      updatedAt: timestamp,
    })
    .eq("id", id)
    .eq("approvalStatus", currentStatus)
    .select("*")
    .maybeSingle();

  const activity = assertDb(activityResult, STALE_APPROVAL_MESSAGE);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: parsed.requestChanges
      ? "ACTIVITY_CHANGES_REQUESTED"
      : "ACTIVITY_REJECTED",
    entityType: "DailyActivity",
    entityId: id,
    metadata: {
      entityName: `${existing.carrierNameSnapshot as string} - ${String(
        existing.activityDate,
      ).slice(0, 10)}`,
      reason: rejectionReason,
      requestChanges: parsed.requestChanges ?? false,
      previousStatus: currentStatus,
      teamName: existing.teamNameSnapshot as string,
      dispatcherName: existing.dispatcherNameSnapshot as string,
      approvalStatus: REJECTED,
    } as JsonValue,
  });

  await updateEntityNotificationStatuses({
    activityId: id,
    notificationStatus: parsed.requestChanges
      ? NOTIFICATION_CHANGES_REQUESTED
      : NOTIFICATION_REJECTED,
  });

  await notifyDispatcherOutcome({
    organizationId: scope.organizationId,
    dispatcherId: existing.dispatcherId as string,
    activityId: id,
    carrierName: existing.carrierNameSnapshot as string,
    activityDate: String(existing.activityDate).slice(0, 10),
    approved: false,
    requestChanges: parsed.requestChanges,
    reason: rejectionReason,
  });

  return mapDailyActivity(activity);
}
