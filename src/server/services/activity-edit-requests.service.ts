import "server-only";

import { z } from "zod";
import type { JsonValue, LoadActivityStatus } from "@/lib/db/types";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { ValidationError } from "@/lib/errors/validation-error";
import {
  APPROVED,
  PENDING_ADMIN_APPROVAL,
  PENDING_TEAM_LEAD_APPROVAL,
  REJECTED,
  type ActivityApprovalStatus,
} from "@/lib/constants/activity-approval";
import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import { DELIVERED } from "@/lib/constants/statuses";
import { T, db } from "@/lib/db/client";
import {
  assertDb,
  assertDbVoid,
  createId,
  decimalToNumber,
  nowIso,
  toDateOnly,
} from "@/lib/db/utils";
import type { ActivityEditRequestDto } from "@/lib/types";
import { calculateDispatchFee } from "@/lib/utils/calculate-dispatch-fee";
import { calculateRatePerMile } from "@/lib/utils/calculate-rate-per-mile";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  notifyDispatcherOutcome,
  notifyEditRequestSubmitted,
  notifyFinalApprovalCompleted,
  updateEntityNotificationStatuses,
} from "@/server/services/notifications.service";
import { upsertDailySubmission } from "@/server/services/daily-submissions.service";
import {
  assertAllowedStatusReason,
  getDirectAdminApprovalMode,
  getDispatchFeeRules,
} from "@/server/services/settings.service";
import { parseActivityDate } from "@/server/utils/activity-filters";
import { resolveEditRequestApprovalStatus } from "@/server/utils/approval-workflow";
import { activityScopeFilter } from "@/server/utils/scope-filters";
import {
  NOTIFICATION_CHANGES_REQUESTED,
  NOTIFICATION_COMPLETED,
  NOTIFICATION_REJECTED,
} from "@/lib/constants/notifications";

const STALE_APPROVAL_MESSAGE =
  "This record was already updated. Please refresh and try again.";

const rejectEditRequestSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required"),
  requestChanges: z.boolean().optional(),
  approvalNotes: z.string().trim().optional(),
});

const approveEditRequestSchema = z.object({
  approvalNotes: z.string().trim().optional(),
});

type ProposedActivityChanges = {
  activityDate?: string;
  status?: LoadActivityStatus;
  origin?: string | null;
  destination?: string | null;
  totalMiles?: number | null;
  loadAmount?: number | null;
  reason?: string | null;
  notes?: string | null;
};

function toDecimalString(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

function computeFinancials(
  status: LoadActivityStatus,
  totalMiles: number | undefined | null,
  loadAmount: number | undefined | null,
  dispatchFeePercentage: number,
  feeRules: { minimumFee: number; roundToNearestDollar: boolean },
) {
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

function snapshotActivity(activity: Record<string, unknown>) {
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
    carrierNameSnapshot: activity.carrierNameSnapshot,
    dispatcherNameSnapshot: activity.dispatcherNameSnapshot,
    teamNameSnapshot: activity.teamNameSnapshot,
  };
}

function applyEditScope<T extends { eq: (col: string, val: string) => T }>(
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
  return query;
}

async function getUserName(userId: string): Promise<string | null> {
  const result = await db()
    .from(T.User)
    .select("fullName")
    .eq("id", userId)
    .maybeSingle();
  return (result.data?.fullName as string | null) ?? null;
}

// Batch-resolve user display names in a single query to avoid N+1 lookups when
// mapping lists of edit requests.
async function resolveUserNames(
  ids: Array<string | null | undefined>,
): Promise<Map<string, string | null>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const nameById = new Map<string, string | null>();
  if (unique.length === 0) {
    return nameById;
  }

  const result = await db()
    .from(T.User)
    .select("id, fullName")
    .in("id", unique);
  const rows = assertDb(result) ?? [];
  for (const row of rows) {
    nameById.set(row.id as string, (row.fullName as string | null) ?? null);
  }
  return nameById;
}

export async function mapEditRequestRow(
  row: Record<string, unknown>,
  nameCache?: Map<string, string | null>,
): Promise<ActivityEditRequestDto> {
  const previousData = (row.previousData ?? {}) as Record<string, unknown>;
  const adminApprovedById = (row.adminApprovedById as string | null) ?? null;
  const teamLeadApprovedById =
    (row.teamLeadApprovedById as string | null) ?? null;
  const isApproved = row.approvalStatus === APPROVED;
  const approverRole = isApproved
    ? adminApprovedById
      ? ADMIN
      : teamLeadApprovedById
        ? TEAM_LEAD
        : null
    : null;
  const approverId = adminApprovedById ?? teamLeadApprovedById;
  const editedById = row.editedById as string;
  const lookupName = async (id: string | null): Promise<string | null> => {
    if (!id) {
      return null;
    }
    if (nameCache) {
      return nameCache.get(id) ?? null;
    }
    return getUserName(id);
  };
  const editedByName = await lookupName(editedById);
  const approvedByName =
    isApproved && approverId ? await lookupName(approverId) : null;
  return {
    id: row.id as string,
    originalActivityId: row.originalActivityId as string,
    teamId: row.teamId as string,
    dispatcherId: row.dispatcherId as string,
    approvalStatus: row.approvalStatus as ActivityApprovalStatus,
    proposedChanges: (row.proposedChanges ?? {}) as Record<string, unknown>,
    previousData,
    submittedById: row.submittedById as string,
    editedById,
    editedByName,
    teamLeadApprovedById: (row.teamLeadApprovedById as string | null) ?? null,
    adminApprovedById: (row.adminApprovedById as string | null) ?? null,
    rejectedById: (row.rejectedById as string | null) ?? null,
    rejectionReason: (row.rejectionReason as string | null) ?? null,
    approvalNotes: (row.approvalNotes as string | null) ?? null,
    submittedAt: row.submittedAt as string,
    editedAt: row.editedAt as string,
    teamLeadApprovedAt: (row.teamLeadApprovedAt as string | null) ?? null,
    adminApprovedAt: (row.adminApprovedAt as string | null) ?? null,
    rejectedAt: (row.rejectedAt as string | null) ?? null,
    carrierName: (previousData.carrierNameSnapshot as string | null) ?? null,
    activityDate: previousData.activityDate
      ? String(previousData.activityDate).slice(0, 10)
      : null,
    dispatcherName:
      (previousData.dispatcherNameSnapshot as string | null) ?? null,
    teamName: (previousData.teamNameSnapshot as string | null) ?? null,
    approvedByName,
    approvedByRole: approverRole,
  };
}

export async function createEditRequest(
  scope: AccessScope,
  actor: AuthContextUser,
  originalActivity: Record<string, unknown>,
  proposed: ProposedActivityChanges,
): Promise<ActivityEditRequestDto> {
  if (scope.role !== DISPATCHER && scope.role !== TEAM_LEAD) {
    throw new ForbiddenError(
      "Only dispatchers and team leads submit edit requests for approved activities.",
    );
  }

  const activityTeamId = originalActivity.teamId as string;

  if (scope.role === TEAM_LEAD) {
    if (!scope.teamId || scope.teamId !== activityTeamId) {
      throw new ForbiddenError("You can only submit edits for activities on your team.");
    }
  }

  const originalStatus = originalActivity.approvalStatus as ActivityApprovalStatus;
  if (originalStatus !== APPROVED) {
    throw new ValidationError(
      "Only approved activities use the edit request workflow.",
    );
  }

  const pendingExisting = await db()
    .from(T.ActivityEditRequest)
    .select("id")
    .eq("originalActivityId", originalActivity.id as string)
    .in("approvalStatus", [PENDING_TEAM_LEAD_APPROVAL, PENDING_ADMIN_APPROVAL])
    .maybeSingle();

  if (pendingExisting.data) {
    throw new ValidationError(
      "A pending edit request already exists for this activity.",
    );
  }

  const directAdminApproval = await getDirectAdminApprovalMode(
    scope.organizationId,
  );
  const approvalStatus = resolveEditRequestApprovalStatus(
    scope.role,
    directAdminApproval,
  );
  const timestamp = nowIso();
  const previousData = snapshotActivity(originalActivity);

  const insertResult = await db()
    .from(T.ActivityEditRequest)
    .insert({
      id: createId(),
      organizationId: scope.organizationId,
      originalActivityId: originalActivity.id as string,
      teamId: originalActivity.teamId as string,
      dispatcherId: originalActivity.dispatcherId as string,
      approvalStatus,
      proposedChanges: proposed,
      previousData,
      submittedById: actor.id,
      editedById: actor.id,
      submittedAt: timestamp,
      editedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("*")
    .single();

  const row = assertDb(insertResult);
  const dto = await mapEditRequestRow(row);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "ACTIVITY_SUBMITTED",
    entityType: "ActivityEditRequest",
    entityId: row.id as string,
    metadata: {
      originalActivityId: originalActivity.id as string,
      previousData,
      proposedChanges: proposed,
      approvalStatus,
    } as JsonValue,
  });

  await notifyEditRequestSubmitted({
    organizationId: scope.organizationId,
    teamId: originalActivity.teamId as string,
    editRequestId: row.id as string,
    activityId: originalActivity.id as string,
    carrierName: originalActivity.carrierNameSnapshot as string,
    activityDate: String(originalActivity.activityDate).slice(0, 10),
    editorName: actor.fullName,
    approvalStatus,
  });

  return dto;
}

export async function listPendingEditRequests(
  scope: AccessScope,
): Promise<ActivityEditRequestDto[]> {
  const approvalStatuses: ActivityApprovalStatus[] =
    scope.role === ADMIN
      ? [PENDING_TEAM_LEAD_APPROVAL, PENDING_ADMIN_APPROVAL]
      : scope.role === TEAM_LEAD
        ? [PENDING_TEAM_LEAD_APPROVAL]
        : [];

  if (approvalStatuses.length === 0) {
    throw new ForbiddenError("You do not have access to pending edit requests.");
  }

  let query = db()
    .from(T.ActivityEditRequest)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .in("approvalStatus", approvalStatuses);

  query = applyEditScope(query, scope);

  const result = await query
    .order("submittedAt", { ascending: false })
    .order("editedAt", { ascending: false });

  const rows = assertDb(result) ?? [];
  const nameCache = await resolveUserNames(
    rows.flatMap((row) => [
      row.editedById as string | null,
      row.adminApprovedById as string | null,
      row.teamLeadApprovedById as string | null,
    ]),
  );
  return Promise.all(rows.map((row) => mapEditRequestRow(row, nameCache)));
}

export async function listDispatcherEditRequests(
  scope: AccessScope,
): Promise<ActivityEditRequestDto[]> {
  if (!scope.dispatcherId) {
    throw new ForbiddenError("Dispatcher access is required.");
  }

  const result = await db()
    .from(T.ActivityEditRequest)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .eq("dispatcherId", scope.dispatcherId)
    .order("editedAt", { ascending: false });

  const rows = assertDb(result) ?? [];
  const nameCache = await resolveUserNames(
    rows.flatMap((row) => [
      row.editedById as string | null,
      row.adminApprovedById as string | null,
      row.teamLeadApprovedById as string | null,
    ]),
  );
  return Promise.all(rows.map((row) => mapEditRequestRow(row, nameCache)));
}

async function getEditRequestInScope(
  scope: AccessScope,
  id: string,
): Promise<Record<string, unknown>> {
  let query = db()
    .from(T.ActivityEditRequest)
    .select("*")
    .eq("id", id)
    .eq("organizationId", scope.organizationId);

  query = applyEditScope(query, scope);

  const result = await query.maybeSingle();
  if (result.error) {
    throw new Error(result.error.message);
  }
  if (!result.data) {
    throw new NotFoundError("Edit request not found.");
  }
  return result.data as Record<string, unknown>;
}

async function applyApprovedChanges(
  organizationId: string,
  originalActivity: Record<string, unknown>,
  proposed: ProposedActivityChanges,
): Promise<void> {
  const status = (proposed.status ??
    originalActivity.status) as LoadActivityStatus;
  const activityDate = proposed.activityDate
    ? toDateOnly(parseActivityDate(proposed.activityDate))
    : toDateOnly(parseActivityDate(originalActivity.activityDate as string));

  if (proposed.reason?.trim()) {
    await assertAllowedStatusReason(organizationId, proposed.reason);
  }

  const dispatchFeePercentage =
    decimalToNumber(originalActivity.dispatchFeePercentageSnapshot as string) ??
    0;
  const feeRules = await getDispatchFeeRules(organizationId);
  const totalMiles =
    proposed.totalMiles ??
    decimalToNumber(originalActivity.totalMiles as string | null);
  const loadAmount =
    proposed.loadAmount ??
    decimalToNumber(originalActivity.loadAmount as string | null);
  const { ratePerMile, dispatchFee } = computeFinancials(
    status,
    totalMiles ?? undefined,
    loadAmount ?? undefined,
    dispatchFeePercentage,
    feeRules,
  );

  const updatePayload: Record<string, unknown> = {
    status,
    activityDate,
    origin:
      status === DELIVERED
        ? (proposed.origin ?? originalActivity.origin)?.toString().trim() ||
          null
        : null,
    destination:
      status === DELIVERED
        ? (proposed.destination ?? originalActivity.destination)
            ?.toString()
            .trim() || null
        : null,
    totalMiles:
      status === DELIVERED ? toDecimalString(totalMiles) : null,
    loadAmount:
      status === DELIVERED ? toDecimalString(loadAmount) : null,
    ratePerMile: toDecimalString(ratePerMile),
    dispatchFee: toDecimalString(dispatchFee),
    reason:
      status === DELIVERED
        ? null
        : (proposed.reason ?? originalActivity.reason)?.toString().trim() ||
          null,
    notes:
      proposed.notes !== undefined
        ? proposed.notes?.trim() || null
        : (originalActivity.notes as string | null),
    updatedAt: nowIso(),
  };

  const updateResult = await db()
    .from(T.DailyActivity)
    .update(updatePayload)
    .eq("id", originalActivity.id as string);

  assertDbVoid(updateResult);

  await upsertDailySubmission(
    organizationId,
    originalActivity.dispatcherId as string,
    originalActivity.teamId as string,
    parseActivityDate(activityDate),
  );
}

export async function approveEditRequest(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input?: { approvalNotes?: string },
): Promise<ActivityEditRequestDto> {
  const parsed = approveEditRequestSchema.parse(input ?? {});
  const existing = await getEditRequestInScope(scope, id);
  const currentStatus = existing.approvalStatus as ActivityApprovalStatus;
  const teamId = existing.teamId as string;
  const timestamp = nowIso();

  // Parallel approval: the first authorized approver (team lead OR admin)
  // finalizes the edit request, applies the proposed changes to the activity,
  // and marks it APPROVED. Team leads finalize edits awaiting team lead review
  // on their own team; admins finalize any pending edit request.
  const previousData = existing.previousData as Record<string, unknown>;
  const proposed = existing.proposedChanges as ProposedActivityChanges;

  if (scope.role === TEAM_LEAD) {
    if (currentStatus !== PENDING_TEAM_LEAD_APPROVAL) {
      throw new ValidationError(
        "This edit request is no longer awaiting team lead approval.",
      );
    }
    if (!scope.teamId || scope.teamId !== teamId) {
      throw new ForbiddenError("You can only approve edits on your team.");
    }
  } else if (scope.role === ADMIN) {
    if (
      currentStatus !== PENDING_ADMIN_APPROVAL &&
      currentStatus !== PENDING_TEAM_LEAD_APPROVAL
    ) {
      throw new ValidationError("This edit request is not awaiting approval.");
    }
  } else {
    throw new ForbiddenError("Admin or team lead access is required.");
  }

  const isTeamLeadApprover = scope.role === TEAM_LEAD;

  const originalResult = await db()
    .from(T.DailyActivity)
    .select("*")
    .eq("id", existing.originalActivityId as string)
    .single();

  const originalActivity = assertDb(originalResult);

  await applyApprovedChanges(
    scope.organizationId,
    originalActivity as Record<string, unknown>,
    proposed,
  );

  const updatePayload: Record<string, unknown> = {
    approvalStatus: APPROVED,
    approvalNotes: parsed.approvalNotes ?? null,
    teamLeadApprovedById: isTeamLeadApprover ? actor.id : null,
    teamLeadApprovedAt: isTeamLeadApprover ? timestamp : null,
    adminApprovedById: isTeamLeadApprover ? null : actor.id,
    adminApprovedAt: isTeamLeadApprover ? null : timestamp,
    rejectedById: null,
    rejectionReason: null,
    rejectedAt: null,
    updatedAt: timestamp,
  };

  const updateResult = await db()
    .from(T.ActivityEditRequest)
    .update(updatePayload)
    .eq("id", id)
    .eq("approvalStatus", currentStatus)
    .select("*")
    .maybeSingle();

  const row = assertDb(updateResult, STALE_APPROVAL_MESSAGE);

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: isTeamLeadApprover
      ? "ACTIVITY_APPROVED_BY_TEAM_LEAD"
      : "ACTIVITY_APPROVED_BY_ADMIN",
    entityType: "ActivityEditRequest",
    entityId: id,
    metadata: {
      previousData,
      proposedChanges: proposed,
      originalActivityId: existing.originalActivityId as string,
      previousStatus: currentStatus,
      approvalStatus: APPROVED,
    } as JsonValue,
  });

  // Mark every pending approval notification for this edit request (team lead
  // AND admin copies) as completed so the other authorized role cannot approve
  // it again.
  await updateEntityNotificationStatuses({
    editRequestId: id,
    notificationStatus: NOTIFICATION_COMPLETED,
  });

  await notifyFinalApprovalCompleted({
    organizationId: scope.organizationId,
    dispatcherId: existing.dispatcherId as string,
    editRequestId: id,
    activityId: existing.originalActivityId as string,
    carrierName: previousData.carrierNameSnapshot as string,
    activityDate: String(previousData.activityDate).slice(0, 10),
    approverRole: isTeamLeadApprover ? TEAM_LEAD : ADMIN,
    approverName: actor.fullName,
  });

  return mapEditRequestRow(row);
}

export async function rejectEditRequest(
  scope: AccessScope,
  actor: AuthContextUser,
  id: string,
  input: { reason: string; requestChanges?: boolean; approvalNotes?: string },
): Promise<ActivityEditRequestDto> {
  const parsed = rejectEditRequestSchema.parse(input);
  const existing = await getEditRequestInScope(scope, id);
  const currentStatus = existing.approvalStatus as ActivityApprovalStatus;
  const teamId = existing.teamId as string;
  const timestamp = nowIso();

  if (
    currentStatus !== PENDING_TEAM_LEAD_APPROVAL &&
    currentStatus !== PENDING_ADMIN_APPROVAL
  ) {
    throw new ValidationError("Only pending edit requests can be rejected.");
  }

  if (scope.role === TEAM_LEAD) {
    if (currentStatus !== PENDING_TEAM_LEAD_APPROVAL) {
      throw new ValidationError(
        "Team leads can only reject edit requests pending team lead review.",
      );
    }
    if (!scope.teamId || scope.teamId !== teamId) {
      throw new ForbiddenError("You can only reject edits on your team.");
    }
  } else if (scope.role !== ADMIN) {
    throw new ForbiddenError("Admin or team lead access is required.");
  }

  const rejectionReason = parsed.requestChanges
    ? `Changes requested: ${parsed.reason}`
    : parsed.reason;

  const updateResult = await db()
    .from(T.ActivityEditRequest)
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

  const row = assertDb(updateResult, STALE_APPROVAL_MESSAGE);
  const previousData = existing.previousData as Record<string, unknown>;

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "ACTIVITY_REJECTED",
    entityType: "ActivityEditRequest",
    entityId: id,
    metadata: {
      reason: rejectionReason,
      requestChanges: parsed.requestChanges ?? false,
      previousData,
      proposedChanges: existing.proposedChanges,
    } as JsonValue,
  });

  await updateEntityNotificationStatuses({
    editRequestId: id,
    notificationStatus: parsed.requestChanges
      ? NOTIFICATION_CHANGES_REQUESTED
      : NOTIFICATION_REJECTED,
  });

  await notifyDispatcherOutcome({
    organizationId: scope.organizationId,
    dispatcherId: existing.dispatcherId as string,
    editRequestId: id,
    activityId: existing.originalActivityId as string,
    carrierName: previousData.carrierNameSnapshot as string,
    activityDate: String(previousData.activityDate).slice(0, 10),
    approved: false,
    requestChanges: parsed.requestChanges,
    reason: rejectionReason,
  });

  return mapEditRequestRow(row);
}

export { type ProposedActivityChanges };
