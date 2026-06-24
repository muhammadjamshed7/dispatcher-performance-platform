import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  type Status,
} from "@/lib/constants/statuses";

type DeliveredActivityLike = {
  status: Status | string;
  loadAmount?: number | null;
  miles?: number | null;
  totalMiles?: number | null;
};

function activityMiles(activity: DeliveredActivityLike): number {
  return activity.miles ?? activity.totalMiles ?? 0;
}

export function computeAverageRatePerMile(
  activities: DeliveredActivityLike[],
): number | null {
  const delivered = activities.filter(
    (activity) => activity.status === DELIVERED,
  );
  const revenue = delivered.reduce(
    (sum, activity) => sum + (activity.loadAmount ?? 0),
    0,
  );
  const miles = delivered.reduce(
    (sum, activity) => sum + activityMiles(activity),
    0,
  );

  if (miles <= 0) {
    return null;
  }

  return Math.round((revenue / miles) * 100) / 100;
}

export function computeBookingEfficiency(
  activities: Array<{ status: Status | string }>,
): number {
  const delivered = activities.filter(
    (activity) => activity.status === DELIVERED,
  ).length;
  const cancelled = activities.filter(
    (activity) => activity.status === CANCELLED,
  ).length;
  const notBooked = activities.filter(
    (activity) => activity.status === NOT_BOOKED,
  ).length;
  const actionable = delivered + cancelled + notBooked;

  if (actionable <= 0) {
    return 0;
  }

  return Math.round((delivered / actionable) * 1000) / 10;
}
