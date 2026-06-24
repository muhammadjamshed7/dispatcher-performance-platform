import "server-only";

import { T, db } from "@/lib/db/client";
import { DELIVERED } from "@/lib/constants/statuses";
import { computeAverageRatePerMile } from "@/lib/utils/compute-finance-metrics";
import { assertDb, countRows, decimalToNumber } from "@/lib/db/utils";
import type { DashboardMetric } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  activityScopeFilter,
  dispatcherScopeFilter,
} from "@/server/utils/scope-filters";

async function buildMetrics(scope: AccessScope): Promise<DashboardMetric> {
  const activityFilter = activityScopeFilter(scope);
  let activitiesQuery = db()
    .from(T.DailyActivity)
    .select("status, loadAmount, totalMiles")
    .eq("organizationId", scope.organizationId);

  if ("dispatcherId" in activityFilter && activityFilter.dispatcherId) {
    activitiesQuery = activitiesQuery.eq(
      "dispatcherId",
      activityFilter.dispatcherId,
    );
  }

  if ("teamId" in activityFilter && activityFilter.teamId) {
    activitiesQuery = activitiesQuery.eq("teamId", activityFilter.teamId);
  }

  if ("id" in activityFilter && activityFilter.id) {
    activitiesQuery = activitiesQuery.eq("id", activityFilter.id);
  }

  const activitiesResult = await activitiesQuery;
  const activities = assertDb(activitiesResult) ?? [];

  const delivered = activities.filter(
    (activity) => activity.status === DELIVERED,
  );
  const totalRevenue = delivered.reduce(
    (sum, activity) => sum + (decimalToNumber(activity.loadAmount) ?? 0),
    0,
  );
  const avgRatePerMile =
    computeAverageRatePerMile(
      activities.map((activity) => ({
        status: activity.status,
        loadAmount: decimalToNumber(activity.loadAmount) ?? 0,
        totalMiles: decimalToNumber(activity.totalMiles) ?? 0,
      })),
    ) ?? 0;

  const dispatcherFilter = dispatcherScopeFilter(scope);
  const dispatcherCountFilters: Array<{
    column: string;
    value: string | null;
    op?: "eq" | "is";
  }> = [
    { column: "organizationId", value: scope.organizationId },
    { column: "status", value: "ACTIVE" },
    { column: "deletedAt", value: null, op: "is" },
  ];

  if ("id" in dispatcherFilter && dispatcherFilter.id) {
    dispatcherCountFilters.push({ column: "id", value: dispatcherFilter.id });
  }

  if ("teamId" in dispatcherFilter && dispatcherFilter.teamId) {
    dispatcherCountFilters.push({
      column: "teamId",
      value: dispatcherFilter.teamId,
    });
  }

  const activeDispatchers = await countRows(
    T.Dispatcher,
    dispatcherCountFilters,
  );

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalLoads: activities.length,
    deliveredLoads: delivered.length,
    avgRatePerMile: Math.round(avgRatePerMile * 100) / 100,
    activeDispatchers,
  };
}

export async function getTeamLeadMetrics(
  scope: AccessScope,
): Promise<DashboardMetric> {
  return buildMetrics(scope);
}
