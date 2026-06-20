export const TEAM_STATUS_ACTIVE = "ACTIVE" as const;
export const TEAM_STATUS_INACTIVE = "INACTIVE" as const;

export const TEAM_STATUSES = [
  TEAM_STATUS_ACTIVE,
  TEAM_STATUS_INACTIVE,
] as const;

export type TeamStatus = (typeof TEAM_STATUSES)[number];
