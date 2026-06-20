export const DELIVERED = "DELIVERED" as const;
export const CANCELLED = "CANCELLED" as const;
export const NOT_BOOKED = "NOT_BOOKED" as const;
export const NOT_WORKING = "NOT_WORKING" as const;

export const STATUSES = [
  DELIVERED,
  CANCELLED,
  NOT_BOOKED,
  NOT_WORKING,
] as const;

export type Status = (typeof STATUSES)[number];
