import { DELIVERED } from "@/lib/constants/statuses";
import type { DailyActivity } from "@/lib/types";
import { calculateRatePerMile } from "@/lib/utils/calculate-rate-per-mile";

export type ActivityFinancialTotals = {
  activityCount: number;
  deliveredCount: number;
  totalMiles: number;
  totalLoadAmount: number;
  averageRatePerMile: number | null;
  totalDispatchFee: number;
};

export type CarrierActivitySummary = {
  carrierName: string;
  totals: ActivityFinancialTotals;
};

export type DispatcherActivitySummary = {
  dispatcherName: string;
  teamName: string;
  totals: ActivityFinancialTotals;
};

export function calculateActivityFinancialTotals(
  activities: DailyActivity[],
): ActivityFinancialTotals {
  let totalMiles = 0;
  let totalLoadAmount = 0;
  let totalDispatchFee = 0;
  let deliveredCount = 0;

  for (const activity of activities) {
    if (activity.status !== DELIVERED) {
      continue;
    }

    deliveredCount += 1;
    totalMiles += activity.miles ?? 0;
    totalLoadAmount += activity.loadAmount ?? 0;
    totalDispatchFee += activity.dispatchFee ?? 0;
  }

  const averageRatePerMile =
    totalMiles > 0 ? calculateRatePerMile(totalLoadAmount, totalMiles) : null;

  return {
    activityCount: activities.length,
    deliveredCount,
    totalMiles,
    totalLoadAmount,
    averageRatePerMile,
    totalDispatchFee,
  };
}

export function groupActivitiesByCarrier(
  activities: DailyActivity[],
): CarrierActivitySummary[] {
  const groups = new Map<string, DailyActivity[]>();

  for (const activity of activities) {
    const existing = groups.get(activity.carrierName) ?? [];
    existing.push(activity);
    groups.set(activity.carrierName, existing);
  }

  return [...groups.entries()]
    .map(([carrierName, items]) => ({
      carrierName,
      totals: calculateActivityFinancialTotals(items),
    }))
    .sort((left, right) => left.carrierName.localeCompare(right.carrierName));
}

export function groupActivitiesByDispatcher(
  activities: DailyActivity[],
): DispatcherActivitySummary[] {
  const groups = new Map<string, DailyActivity[]>();

  for (const activity of activities) {
    const existing = groups.get(activity.dispatcherName) ?? [];
    existing.push(activity);
    groups.set(activity.dispatcherName, existing);
  }

  return [...groups.entries()]
    .map(([dispatcherName, items]) => ({
      dispatcherName,
      teamName: items[0]?.teamName ?? "",
      totals: calculateActivityFinancialTotals(items),
    }))
    .sort((left, right) =>
      left.dispatcherName.localeCompare(right.dispatcherName),
    );
}
