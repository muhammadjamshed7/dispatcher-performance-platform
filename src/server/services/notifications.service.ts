import "server-only";

import type { ActivityApprovalStatus } from "@/lib/constants/activity-approval";
import {
  NOTIFICATION_ADMIN_APPROVAL_REQUIRED,
  NOTIFICATION_APPROVED,
  NOTIFICATION_CHANGES_REQUESTED,
  NOTIFICATION_COMPLETED,
  NOTIFICATION_PENDING,
  NOTIFICATION_REJECTED,
  NOTIFICATION_TEAM_LEAD_APPROVAL_REQUIRED,
  type NotificationStatus,
} from "@/lib/constants/notifications";
import { ADMIN, TEAM_LEAD } from "@/lib/constants/roles";
import { PENDING_TEAM_LEAD_APPROVAL } from "@/lib/constants/activity-approval";
import type { Notification as NotificationRow } from "@/lib/db/types";
import { T, db } from "@/lib/db/client";
import { assertDb, assertDbVoid, createId, nowIso } from "@/lib/db/utils";
import type { AppNotification } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { toIsoString } from "@/lib/db/utils";

type CreateNotificationInput = {
  organizationId: string;
  recipientUserId: string;
  title: string;
  message: string;
  notificationStatus: NotificationStatus;
  activityId?: string | null;
  editRequestId?: string | null;
  metadata?: Record<string, unknown>;
};

async function getActiveUserIdsByRole(
  organizationId: string,
  role: typeof ADMIN | typeof TEAM_LEAD,
): Promise<string[]> {
  const result = await db()
    .from(T.User)
    .select("id")
    .eq("organizationId", organizationId)
    .eq("role", role)
    .eq("status", "ACTIVE")
    .is("deletedAt", null);

  const rows = assertDb(result) ?? [];
  return rows.map((row) => row.id as string);
}

async function getTeamLeadUserId(teamId: string): Promise<string | null> {
  const result = await db()
    .from(T.Team)
    .select("teamLeadUserId")
    .eq("id", teamId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data?.teamLeadUserId as string | null) ?? null;
}

async function getDispatcherUserId(dispatcherId: string): Promise<string | null> {
  const result = await db()
    .from(T.Dispatcher)
    .select("userId")
    .eq("id", dispatcherId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data?.userId as string | null) ?? null;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  const result = await db()
    .from(T.Notification)
    .insert({
      id: createId(),
      organizationId: input.organizationId,
      recipientUserId: input.recipientUserId,
      title: input.title,
      message: input.message,
      notificationStatus: input.notificationStatus,
      activityId: input.activityId ?? null,
      editRequestId: input.editRequestId ?? null,
      metadata: input.metadata ?? null,
      createdAt: nowIso(),
    });

  assertDbVoid(result);
}

async function notifyUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "recipientUserId">,
): Promise<void> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  await Promise.all(
    uniqueIds.map((recipientUserId) =>
      createNotification({ ...input, recipientUserId }),
    ),
  );
}

export async function notifyNewActivitySubmitted(input: {
  organizationId: string;
  teamId: string;
  activityId: string;
  carrierName: string;
  activityDate: string;
  dispatcherName: string;
  approvalStatus: ActivityApprovalStatus;
}): Promise<void> {
  const title = "New activity submitted";
  const message = `${input.dispatcherName} submitted activity for ${input.carrierName} on ${input.activityDate}.`;
  const metadata = {
    carrierName: input.carrierName,
    activityDate: input.activityDate,
    dispatcherName: input.dispatcherName,
    teamId: input.teamId,
  };

  // Parallel approval: notify the assigned team lead AND all admins at once so
  // either authorized role can approve first. Direct-admin submissions skip the
  // team lead and notify admins only.
  if (input.approvalStatus === PENDING_TEAM_LEAD_APPROVAL) {
    const teamLeadUserId = await getTeamLeadUserId(input.teamId);
    if (teamLeadUserId) {
      await notifyUsers([teamLeadUserId], {
        organizationId: input.organizationId,
        title,
        message,
        notificationStatus: NOTIFICATION_TEAM_LEAD_APPROVAL_REQUIRED,
        activityId: input.activityId,
        metadata,
      });
    }
  }

  const adminIds = await getActiveUserIdsByRole(input.organizationId, ADMIN);
  await notifyUsers(adminIds, {
    organizationId: input.organizationId,
    title,
    message,
    notificationStatus: NOTIFICATION_ADMIN_APPROVAL_REQUIRED,
    activityId: input.activityId,
    metadata,
  });
}

export async function notifyEditRequestSubmitted(input: {
  organizationId: string;
  teamId: string;
  editRequestId: string;
  activityId: string;
  carrierName: string;
  activityDate: string;
  editorName: string;
  approvalStatus: ActivityApprovalStatus;
}): Promise<void> {
  const title = "Activity edit submitted";
  const message = `${input.editorName} submitted edits for ${input.carrierName} on ${input.activityDate}.`;
  const metadata = {
    carrierName: input.carrierName,
    activityDate: input.activityDate,
    editorName: input.editorName,
    teamId: input.teamId,
  };

  // Parallel approval: notify the assigned team lead AND all admins at once so
  // either authorized role can approve first.
  if (input.approvalStatus === PENDING_TEAM_LEAD_APPROVAL) {
    const teamLeadUserId = await getTeamLeadUserId(input.teamId);
    if (teamLeadUserId) {
      await notifyUsers([teamLeadUserId], {
        organizationId: input.organizationId,
        title,
        message,
        notificationStatus: NOTIFICATION_TEAM_LEAD_APPROVAL_REQUIRED,
        activityId: input.activityId,
        editRequestId: input.editRequestId,
        metadata,
      });
    }
  }

  const adminIds = await getActiveUserIdsByRole(input.organizationId, ADMIN);
  await notifyUsers(adminIds, {
    organizationId: input.organizationId,
    title,
    message,
    notificationStatus: NOTIFICATION_ADMIN_APPROVAL_REQUIRED,
    activityId: input.activityId,
    editRequestId: input.editRequestId,
    metadata,
  });
}

export async function notifyDispatcherOutcome(input: {
  organizationId: string;
  dispatcherId: string;
  activityId?: string | null;
  editRequestId?: string | null;
  carrierName: string;
  activityDate: string;
  approved: boolean;
  requestChanges?: boolean;
  reason?: string;
}): Promise<void> {
  const dispatcherUserId = await getDispatcherUserId(input.dispatcherId);
  if (!dispatcherUserId) {
    return;
  }

  let notificationStatus: NotificationStatus = input.approved
    ? NOTIFICATION_APPROVED
    : NOTIFICATION_REJECTED;
  let title = input.approved ? "Activity approved" : "Activity rejected";
  let message = input.approved
    ? `Your activity for ${input.carrierName} on ${input.activityDate} was approved.`
    : `Your activity for ${input.carrierName} on ${input.activityDate} was rejected.`;

  if (!input.approved && input.requestChanges) {
    notificationStatus = NOTIFICATION_CHANGES_REQUESTED;
    title = "Changes requested";
    message = `Changes were requested for ${input.carrierName} on ${input.activityDate}: ${input.reason ?? "See details."}`;
  } else if (!input.approved && input.reason) {
    message = `${message} Reason: ${input.reason}`;
  }

  await createNotification({
    organizationId: input.organizationId,
    recipientUserId: dispatcherUserId,
    title,
    message,
    notificationStatus,
    activityId: input.activityId ?? null,
    editRequestId: input.editRequestId ?? null,
    metadata: {
      carrierName: input.carrierName,
      activityDate: input.activityDate,
      reason: input.reason ?? null,
    },
  });
}

const APPROVER_ROLE_LABELS: Record<typeof ADMIN | typeof TEAM_LEAD, string> = {
  [ADMIN]: "Admin",
  [TEAM_LEAD]: "Team Lead",
};

export async function notifyFinalApprovalCompleted(input: {
  organizationId: string;
  dispatcherId: string;
  activityId?: string | null;
  editRequestId?: string | null;
  carrierName: string;
  activityDate: string;
  approverRole?: typeof ADMIN | typeof TEAM_LEAD;
  approverName?: string | null;
}): Promise<void> {
  const dispatcherUserId = await getDispatcherUserId(input.dispatcherId);
  if (!dispatcherUserId) {
    return;
  }

  const approverLabel = input.approverRole
    ? APPROVER_ROLE_LABELS[input.approverRole]
    : null;
  const approverSuffix = approverLabel
    ? ` Approved by ${approverLabel}${input.approverName ? ` (${input.approverName})` : ""}.`
    : "";

  await createNotification({
    organizationId: input.organizationId,
    recipientUserId: dispatcherUserId,
    title: "Final approval completed",
    message: `Your activity for ${input.carrierName} on ${input.activityDate} is now live in reports and dashboards.${approverSuffix}`,
    notificationStatus: NOTIFICATION_COMPLETED,
    activityId: input.activityId ?? null,
    editRequestId: input.editRequestId ?? null,
    metadata: {
      carrierName: input.carrierName,
      activityDate: input.activityDate,
      approverRole: input.approverRole ?? null,
      approverName: input.approverName ?? null,
    },
  });
}

export async function updateEntityNotificationStatuses(input: {
  activityId?: string | null;
  editRequestId?: string | null;
  notificationStatus: NotificationStatus;
}): Promise<void> {
  let query = db().from(T.Notification).update({
    notificationStatus: input.notificationStatus,
  });

  if (input.activityId) {
    query = query.eq("activityId", input.activityId);
  } else if (input.editRequestId) {
    query = query.eq("editRequestId", input.editRequestId);
  } else {
    return;
  }

  const result = await query.in("notificationStatus", [
    NOTIFICATION_TEAM_LEAD_APPROVAL_REQUIRED,
    NOTIFICATION_ADMIN_APPROVAL_REQUIRED,
    NOTIFICATION_PENDING,
  ]);

  assertDbVoid(result);
}

function mapNotification(row: NotificationRow): AppNotification {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    notificationStatus: row.notificationStatus,
    activityId: row.activityId,
    editRequestId: row.editRequestId,
    readAt: row.readAt ? toIsoString(row.readAt) : null,
    createdAt: toIsoString(row.createdAt),
    submittedByName: (metadata.submittedByName as string | null) ?? null,
    carrierName: (metadata.carrierName as string | null) ?? null,
    activityDate: (metadata.activityDate as string | null) ?? null,
  };
}

export async function listNotifications(
  scope: AccessScope,
  userId: string,
): Promise<AppNotification[]> {
  let query = db()
    .from(T.Notification)
    .select("*")
    .eq("organizationId", scope.organizationId)
    .eq("recipientUserId", userId)
    .order("createdAt", { ascending: false })
    .limit(100);

  if (scope.role === TEAM_LEAD && scope.teamId) {
    query = query.or(
      `metadata->>teamId.is.null,metadata->>teamId.eq.${scope.teamId}`,
    );
  }

  const result = await query;
  const rows = assertDb(result) ?? [];
  return rows.map((row) => mapNotification(row as NotificationRow));
}

export async function markNotificationRead(
  scope: AccessScope,
  userId: string,
  notificationId: string,
): Promise<void> {
  const existing = await db()
    .from(T.Notification)
    .select("id, recipientUserId")
    .eq("id", notificationId)
    .eq("organizationId", scope.organizationId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (!existing.data || existing.data.recipientUserId !== userId) {
    throw new ForbiddenError("Notification not found.");
  }

  const result = await db()
    .from(T.Notification)
    .update({ readAt: nowIso() })
    .eq("id", notificationId);

  assertDbVoid(result);
}

export async function markAllNotificationsRead(
  scope: AccessScope,
  userId: string,
): Promise<void> {
  const result = await db()
    .from(T.Notification)
    .update({ readAt: nowIso() })
    .eq("organizationId", scope.organizationId)
    .eq("recipientUserId", userId)
    .is("readAt", null);

  assertDbVoid(result);
}

export async function countUnreadNotifications(
  scope: AccessScope,
  userId: string,
): Promise<number> {
  const result = await db()
    .from(T.Notification)
    .select("id", { count: "exact", head: true })
    .eq("organizationId", scope.organizationId)
    .eq("recipientUserId", userId)
    .is("readAt", null);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.count ?? 0;
}
