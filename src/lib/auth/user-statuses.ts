export const ACTIVE = "ACTIVE" as const;
export const PENDING_APPROVAL = "PENDING_APPROVAL" as const;
export const INACTIVE = "INACTIVE" as const;
export const INVITED = "INVITED" as const;

export const USER_STATUSES = [
  ACTIVE,
  PENDING_APPROVAL,
  INACTIVE,
  INVITED,
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];
