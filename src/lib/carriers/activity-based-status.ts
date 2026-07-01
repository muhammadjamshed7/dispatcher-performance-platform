import type { CarrierStatus } from "@/lib/db/types";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";

export const CARRIER_AUTO_STATUS_THRESHOLD_HOURS = 72;

export const VALID_CARRIER_AUTO_ACTIVITY_STATUSES = [
  DELIVERED,
  CANCELLED,
  NOT_BOOKED,
  NOT_WORKING,
] as const;

export const EXCLUDED_CARRIER_AUTO_ACTIVITY_STATUSES = ["IN_TRANSIT"] as const;

export function isValidCarrierAutoActivityStatus(status: string): boolean {
  return (
    !EXCLUDED_CARRIER_AUTO_ACTIVITY_STATUSES.includes(
      status as (typeof EXCLUDED_CARRIER_AUTO_ACTIVITY_STATUSES)[number],
    ) &&
    VALID_CARRIER_AUTO_ACTIVITY_STATUSES.includes(
      status as (typeof VALID_CARRIER_AUTO_ACTIVITY_STATUSES)[number],
    )
  );
}

export function resolveCarrierStatusFromLastValidActivity(
  lastValidActivityDate: string | null,
  now = new Date(),
  thresholdHours = CARRIER_AUTO_STATUS_THRESHOLD_HOURS,
): CarrierStatus {
  if (!lastValidActivityDate) {
    return "INACTIVE";
  }

  const activityTime = Date.parse(lastValidActivityDate);
  if (!Number.isFinite(activityTime)) {
    return "INACTIVE";
  }

  const thresholdTime = now.getTime() - thresholdHours * 60 * 60 * 1000;
  return activityTime >= thresholdTime ? "ACTIVE" : "INACTIVE";
}
