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
  "Failed",
  "Submitted",
  "Exported",
  "Viewed",
  "Logged In",
  "Logged Out",
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

const ACTION_STATUS: Record<string, AuditStatus> = {
  USER_APPROVED: "Approved",
  USER_MANUALLY_CREATED: "Created",
  USER_PASSWORD_RESET: "Updated",
  USER_PASSWORD_CHANGED: "Updated",
  USER_REJECTED: "Rejected",
  USER_ROLE_ASSIGNED: "Updated",
  USER_TEAM_ASSIGNED: "Updated",
  USER_ACTIVATED: "Updated",
  USER_DEACTIVATED: "Deleted",
  USER_LOGGED_IN: "Logged In",
  USER_LOGGED_OUT: "Logged Out",
  USER_LOGIN_FAILED: "Failed",
  TEAM_CREATED: "Created",
  TEAM_UPDATED: "Updated",
  TEAM_ACTIVATED: "Updated",
  TEAM_DEACTIVATED: "Deleted",
  TEAM_LEAD_CREATED: "Created",
  TEAM_LEAD_ASSIGNED: "Updated",
  DISPATCHER_CREATED: "Created",
  DISPATCHER_UPDATED: "Updated",
  DISPATCHER_REACTIVATED: "Updated",
  DISPATCHER_DEACTIVATED: "Deleted",
  CARRIER_CREATED: "Created",
  CARRIER_UPDATED: "Updated",
  CARRIER_ACTIVATED: "Updated",
  CARRIER_DEACTIVATED: "Deleted",
  CARRIER_REASSIGNED: "Updated",
  CARRIER_EXPORTED: "Exported",
  ACTIVITY_CREATED: "Created",
  ACTIVITY_UPDATED: "Updated",
  ACTIVITY_SUBMITTED: "Submitted",
  ACTIVITY_EDIT_REQUEST_SUBMITTED: "Submitted",
  ACTIVITY_APPROVED_BY_TEAM_LEAD: "Approved",
  ACTIVITY_APPROVED_BY_ADMIN: "Approved",
  ACTIVITY_REJECTED: "Rejected",
  ACTIVITY_CHANGES_REQUESTED: "Rejected",
  ACTIVITY_PENDING_UPDATED: "Updated",
  ACTIVITY_EXPORTED: "Exported",
  SETTINGS_UPDATED: "Updated",
  SETTINGS_DISPATCH_FEE_RULES_UPDATED: "Updated",
  SETTINGS_TRUCK_TYPES_UPDATED: "Updated",
  SETTINGS_STATUS_REASONS_UPDATED: "Updated",
  SETTINGS_DIRECT_APPROVAL_UPDATED: "Updated",
  NOTIFICATION_READ: "Updated",
  NOTIFICATION_MARK_ALL_READ: "Updated",
  REPORT_VIEWED: "Viewed",
  REPORT_EXPORTED: "Exported",
  FINANCE_VIEWED: "Viewed",
  FINANCE_EXPORTED: "Exported",
  AUDIT_LOGS_EXPORTED: "Exported",
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
  Notification: "Notifications",
  OrganizationSettings: "Settings",
  Finance: "Finance",
  AuditLog: "Audit Logs",
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

/** Em dash used to represent empty/null audit data across UI, CSV and PDF. */
export const AUDIT_EMPTY_VALUE = "—";

/**
 * Common acronyms that should stay upper-cased when humanizing an audit data
 * key (e.g. `mcNumber` -> "MC Number"). Keys are compared in lower case.
 */
const AUDIT_KEY_ACRONYMS: Record<string, string> = {
  id: "ID",
  ids: "IDs",
  mc: "MC",
  dot: "DOT",
  url: "URL",
  api: "API",
  ip: "IP",
  ein: "EIN",
  pdf: "PDF",
  csv: "CSV",
  usd: "USD",
};

/**
 * Converts a camelCase or snake_case audit data key into a human-readable Title
 * Case label. Examples: `teamName` -> "Team Name", `ratePerMile` -> "Rate Per
 * Mile", `mc_number` -> "MC Number".
 */
export function humanizeAuditKey(key: string): string {
  if (!key) return key;

  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\s]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (AUDIT_KEY_ACRONYMS[lower]) return AUDIT_KEY_ACRONYMS[lower];
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatAuditPrimitive(value: unknown): string {
  if (value === null || value === undefined) return AUDIT_EMPTY_VALUE;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? AUDIT_EMPTY_VALUE : trimmed;
  }
  return String(value);
}

/**
 * Formats a value that appears on the right-hand side of a "Label: value" line.
 * Nested objects and arrays are flattened into readable text instead of raw
 * JSON braces.
 */
function formatAuditNestedValue(value: unknown): string {
  if (value === null || value === undefined) return AUDIT_EMPTY_VALUE;

  if (Array.isArray(value)) {
    if (value.length === 0) return AUDIT_EMPTY_VALUE;
    return value.map((item) => formatAuditNestedValue(item)).join("; ");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return AUDIT_EMPTY_VALUE;
    return entries
      .map(
        ([key, val]) =>
          `${humanizeAuditKey(key)}: ${formatAuditNestedValue(val)}`,
      )
      .join(", ");
  }

  return formatAuditPrimitive(value);
}

export type AuditDataLine = { label: string; value: string };

/**
 * Converts raw audit data (`Record<string, unknown>`, array, primitive, JSON
 * string, or null) into readable per-line `{ label, value }` pairs. Returns an
 * empty array when there is no meaningful data to show.
 */
export function formatAuditDataLines(value: unknown): AuditDataLine[] {
  if (value === null || value === undefined) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return [];

    const looksLikeJson =
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"));

    if (looksLikeJson) {
      try {
        return formatAuditDataLines(JSON.parse(trimmed));
      } catch {
        // Not valid JSON; fall through and show the raw string.
      }
    }

    return [{ label: "", value: trimmed }];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    return value.map((item, index) => ({
      label: `Item ${index + 1}`,
      value: formatAuditNestedValue(item),
    }));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return [];
    return entries.map(([key, val]) => ({
      label: humanizeAuditKey(key),
      value: formatAuditNestedValue(val),
    }));
  }

  return [{ label: "", value: formatAuditPrimitive(value) }];
}

/**
 * Renders raw audit data as readable "Label: value" lines joined by newlines.
 * Returns an em dash when the data is empty/null/`{}`. Shared by the audit logs
 * table, CSV export and PDF export so all three stay consistent.
 */
export function formatAuditData(value: unknown): string {
  const lines = formatAuditDataLines(value);
  if (lines.length === 0) return AUDIT_EMPTY_VALUE;

  return lines
    .map((line) => (line.label ? `${line.label}: ${line.value}` : line.value))
    .join("\n");
}
