import type { AuditAction } from "@/lib/db/types";

/**
 * High-level outcome ("status") of an audit action, used for display badges and
 * the Audit Logs status filter. Derived purely from the action so logs never
 * need to store a separate status column.
 */
export const AUDIT_STATUSES = [
  "Created",
  "Updated",
  "Deleted",
  "Approved",
  "Rejected",
  "Submitted",
  "Exported",
  "Logged In",
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

const ACTION_STATUS: Record<string, AuditStatus> = {
  USER_APPROVED: "Approved",
  USER_REJECTED: "Rejected",
  USER_ROLE_ASSIGNED: "Updated",
  USER_TEAM_ASSIGNED: "Updated",
  USER_LOGGED_IN: "Logged In",
  TEAM_CREATED: "Created",
  TEAM_UPDATED: "Updated",
  TEAM_DEACTIVATED: "Deleted",
  DISPATCHER_CREATED: "Created",
  DISPATCHER_UPDATED: "Updated",
  DISPATCHER_DEACTIVATED: "Deleted",
  CARRIER_CREATED: "Created",
  CARRIER_UPDATED: "Updated",
  CARRIER_DEACTIVATED: "Deleted",
  CARRIER_REASSIGNED: "Updated",
  ACTIVITY_CREATED: "Created",
  ACTIVITY_UPDATED: "Updated",
  ACTIVITY_SUBMITTED: "Submitted",
  ACTIVITY_APPROVED_BY_TEAM_LEAD: "Approved",
  ACTIVITY_APPROVED_BY_ADMIN: "Approved",
  ACTIVITY_REJECTED: "Rejected",
  ACTIVITY_PENDING_UPDATED: "Updated",
  SETTINGS_UPDATED: "Updated",
  REPORT_EXPORTED: "Exported",
};

export function deriveAuditStatus(action: string): AuditStatus {
  return ACTION_STATUS[action] ?? "Updated";
}

/**
 * The set of actions that map to a given status. Used to translate a status
 * filter into a DB-level `action IN (...)` query.
 */
export function actionsForStatus(status: string): AuditAction[] {
  return (Object.keys(ACTION_STATUS) as AuditAction[]).filter(
    (action) => ACTION_STATUS[action] === status,
  );
}

/** Friendly, human-readable label for the affected module (entityType). */
export const AUDIT_MODULE_LABELS: Record<string, string> = {
  Team: "Teams",
  User: "Users",
  RegistrationRequest: "User Requests",
  ReportExport: "Reports",
  ActivityEditRequest: "Activity Edits",
  DailyActivity: "Activities",
  Dispatcher: "Dispatchers",
  Carrier: "Carriers",
  OrganizationSettings: "Settings",
};

export function deriveAuditModule(entityType: string): string {
  return AUDIT_MODULE_LABELS[entityType] ?? entityType;
}

/** Distinct entity types that can appear, for the module filter dropdown. */
export const AUDIT_MODULE_ENTITY_TYPES = Object.keys(AUDIT_MODULE_LABELS);

/** Friendly label for a raw action enum value, e.g. "Activity Approved By Admin". */
export function formatAuditAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}
