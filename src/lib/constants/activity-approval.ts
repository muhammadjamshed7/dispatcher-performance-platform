export const APPROVED = "APPROVED" as const;
export const PENDING_TEAM_LEAD_APPROVAL =
  "PENDING_TEAM_LEAD_APPROVAL" as const;
export const PENDING_ADMIN_APPROVAL = "PENDING_ADMIN_APPROVAL" as const;
export const REJECTED = "REJECTED" as const;

export const ACTIVITY_APPROVAL_STATUSES = [
  APPROVED,
  PENDING_TEAM_LEAD_APPROVAL,
  PENDING_ADMIN_APPROVAL,
  REJECTED,
] as const;

export type ActivityApprovalStatus =
  (typeof ACTIVITY_APPROVAL_STATUSES)[number];

export const PENDING_APPROVAL_STATUSES = [
  PENDING_TEAM_LEAD_APPROVAL,
  PENDING_ADMIN_APPROVAL,
] as const;

export const NEW_ACTIVITY = "NEW_ACTIVITY" as const;
export const EDIT_ACTIVITY = "EDIT_ACTIVITY" as const;

export const ACTIVITY_APPROVAL_TYPES = [NEW_ACTIVITY, EDIT_ACTIVITY] as const;

export type ActivityApprovalType = (typeof ACTIVITY_APPROVAL_TYPES)[number];

export const ACTIVITY_APPROVAL_LABELS: Record<ActivityApprovalStatus, string> =
  {
    APPROVED: "Approved",
    PENDING_TEAM_LEAD_APPROVAL: "Pending Team Lead",
    PENDING_ADMIN_APPROVAL: "Pending Admin",
    REJECTED: "Rejected",
  };
