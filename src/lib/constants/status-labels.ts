import type { LoadActivityStatus } from "@/lib/db/types";

export const LOAD_ACTIVITY_STATUS_LABELS: Record<LoadActivityStatus, string> = {
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  NOT_BOOKED: "Not Booked",
  NOT_WORKING: "Not Working",
};

export function getLoadActivityStatusLabel(status: LoadActivityStatus): string {
  return LOAD_ACTIVITY_STATUS_LABELS[status];
}
