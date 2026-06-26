import "server-only";

import {
  EDIT_ACTIVITY,
  NEW_ACTIVITY,
  PENDING_ADMIN_APPROVAL,
  PENDING_TEAM_LEAD_APPROVAL,
} from "@/lib/constants/activity-approval";
import { ADMIN, DISPATCHER, TEAM_LEAD } from "@/lib/constants/roles";
import type { LoadActivityStatus } from "@/lib/db/types";
import type {
  ActivityEditRequestDto,
  DailyActivity,
  PendingApprovalItem,
} from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { listPendingEditRequests } from "@/server/services/activity-edit-requests.service";
import { listPendingActivities } from "@/server/services/activities.service";

function toPendingItemFromActivity(activity: DailyActivity): PendingApprovalItem {
  return {
    kind: "new_activity",
    id: activity.id,
    approvalStatus: activity.approvalStatus,
    approvalType: activity.approvalType ?? NEW_ACTIVITY,
    activityDate: activity.date,
    carrierName: activity.carrierName,
    dispatcherName: activity.dispatcherName,
    teamName: activity.teamName,
    status: activity.status,
    submittedAt: activity.submittedAt,
    editedAt: null,
    submittedByName: null,
    editedByName: null,
    rejectionReason: activity.rejectionReason,
    activity,
  };
}

function toPendingItemFromEditRequest(
  editRequest: ActivityEditRequestDto,
): PendingApprovalItem {
  const proposed = editRequest.proposedChanges;
  return {
    kind: "edit_request",
    id: editRequest.id,
    approvalStatus: editRequest.approvalStatus,
    approvalType: EDIT_ACTIVITY,
    activityDate: editRequest.activityDate ?? "",
    carrierName: editRequest.carrierName ?? "",
    dispatcherName: editRequest.dispatcherName ?? "",
    teamName: editRequest.teamName ?? "",
    status: (proposed.status as LoadActivityStatus) ?? "DELIVERED",
    submittedAt: editRequest.submittedAt,
    editedAt: editRequest.editedAt,
    submittedByName: null,
    editedByName: editRequest.editedByName,
    rejectionReason: editRequest.rejectionReason,
    editRequest,
  };
}

export async function listPendingApprovals(
  scope: AccessScope,
): Promise<PendingApprovalItem[]> {
  if (scope.role !== ADMIN && scope.role !== TEAM_LEAD) {
    throw new ForbiddenError("You do not have access to pending approvals.");
  }

  const [activities, editRequests] = await Promise.all([
    listPendingActivities(scope),
    listPendingEditRequests(scope),
  ]);

  const items = [
    ...activities.map(toPendingItemFromActivity),
    ...editRequests.map(toPendingItemFromEditRequest),
  ];

  return items.sort((left, right) => {
    const leftTime = left.submittedAt ?? left.editedAt ?? "";
    const rightTime = right.submittedAt ?? right.editedAt ?? "";
    return rightTime.localeCompare(leftTime);
  });
}

export async function listDispatcherSubmissions(
  scope: AccessScope,
): Promise<PendingApprovalItem[]> {
  if (scope.role !== DISPATCHER || !scope.dispatcherId) {
    throw new ForbiddenError("Dispatcher access is required.");
  }

  const { listActivities } = await import(
    "@/server/services/activities.service"
  );
  const { listDispatcherEditRequests } = await import(
    "@/server/services/activity-edit-requests.service"
  );

  const [activities, editRequests] = await Promise.all([
    listActivities(scope, {
      approvalStatuses: [
        PENDING_TEAM_LEAD_APPROVAL,
        PENDING_ADMIN_APPROVAL,
        "REJECTED",
      ].join(","),
    }),
    listDispatcherEditRequests(scope),
  ]);

  const items = [
    ...activities.map(toPendingItemFromActivity),
    ...editRequests.map(toPendingItemFromEditRequest),
  ];

  return items.sort((left, right) => {
    const leftTime = left.submittedAt ?? left.editedAt ?? "";
    const rightTime = right.submittedAt ?? right.editedAt ?? "";
    return rightTime.localeCompare(leftTime);
  });
}
