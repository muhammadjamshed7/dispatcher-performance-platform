import { ROLE_ROUTE_PREFIX } from "@/lib/auth/roles";
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
import { ADMIN, DISPATCHER, TEAM_LEAD, type Role } from "@/lib/constants/roles";
import type { AppNotification } from "@/lib/types";

const APPROVAL_REQUIRED_STATUSES = new Set<NotificationStatus>([
  NOTIFICATION_PENDING,
  NOTIFICATION_TEAM_LEAD_APPROVAL_REQUIRED,
  NOTIFICATION_ADMIN_APPROVAL_REQUIRED,
]);

const DISPATCHER_SUBMISSION_STATUSES = new Set<NotificationStatus>([
  NOTIFICATION_PENDING,
  NOTIFICATION_APPROVED,
  NOTIFICATION_REJECTED,
  NOTIFICATION_CHANGES_REQUESTED,
  NOTIFICATION_COMPLETED,
]);

export type NotificationLinkTarget = Pick<
  AppNotification,
  "notificationStatus" | "activityId" | "editRequestId"
>;

function buildQuery(
  params: Record<string, string | null | undefined>,
): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

function notificationQuery(notification: NotificationLinkTarget): string {
  return buildQuery({
    activityId: notification.activityId,
    editRequestId: notification.editRequestId,
  });
}

export function getNotificationHref(
  role: Role,
  notification: NotificationLinkTarget,
): string {
  const prefix = ROLE_ROUTE_PREFIX[role];
  const query = notificationQuery(notification);

  if (role === DISPATCHER) {
    if (DISPATCHER_SUBMISSION_STATUSES.has(notification.notificationStatus)) {
      return `/${prefix}/activities/submissions${query}`;
    }

    return `/${prefix}/activities/submissions${query}`;
  }

  if (role === TEAM_LEAD) {
    if (APPROVAL_REQUIRED_STATUSES.has(notification.notificationStatus)) {
      return `/${prefix}/activities/pending${query}`;
    }

    if (notification.activityId) {
      return `/${prefix}/activities${query}`;
    }

    return `/${prefix}/notifications`;
  }

  if (role === ADMIN) {
    if (APPROVAL_REQUIRED_STATUSES.has(notification.notificationStatus)) {
      return `/${prefix}/activities/pending${query}`;
    }

    if (notification.activityId) {
      return `/${prefix}/activities${query}`;
    }

    return `/${prefix}/notifications`;
  }

  return `/${prefix}/notifications`;
}

export function matchesPendingApprovalDeepLink(
  item: { kind: "new_activity" | "edit_request"; id: string; activity?: { id: string } },
  params: { activityId?: string | null; editRequestId?: string | null },
): boolean {
  if (params.editRequestId && item.kind === "edit_request") {
    return item.id === params.editRequestId;
  }

  if (params.activityId) {
    if (item.kind === "new_activity") {
      return item.id === params.activityId;
    }

    return item.activity?.id === params.activityId;
  }

  return false;
}
