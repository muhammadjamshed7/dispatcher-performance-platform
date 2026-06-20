export const ADMIN = "ADMIN" as const;
export const TEAM_LEAD = "TEAM_LEAD" as const;
export const DISPATCHER = "DISPATCHER" as const;

export const ROLES = [ADMIN, TEAM_LEAD, DISPATCHER] as const;

export type Role = (typeof ROLES)[number];
