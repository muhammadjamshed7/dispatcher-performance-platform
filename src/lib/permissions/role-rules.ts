import { ADMIN, DISPATCHER, ROLES, TEAM_LEAD } from "@/lib/constants/roles";

export const ROLE_RULES = {
  [ADMIN]: ROLES,
  [TEAM_LEAD]: [TEAM_LEAD, DISPATCHER] as const,
  [DISPATCHER]: [DISPATCHER] as const,
} as const;
