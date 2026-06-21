import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { DELIVERED } from "@/lib/constants/statuses";
import { db } from "@/lib/db/prisma";
import type { DashboardMetric } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  activityScopeFilter,
  dispatcherScopeFilter,
} from "@/server/utils/scope-filters";

function decimalToNumber(value: { toNumber(): number } | null | undefined): number {
  if (!value) {
    return 0;
  }

  return value.toNumber();
}

async function buildMetrics(
  scope: AccessScope,
  activityWhere: Prisma.DailyActivityWhereInput,
): Promise<DashboardMetric> {
  const activities = await db.dailyActivity.findMany({
    where: {
      organizationId: scope.organizationId,
      ...activityWhere,
    },
    select: {
      status: true,
      loadAmount: true,
      ratePerMile: true,
    },
  });

  const delivered = activities.filter((activity) => activity.status === DELIVERED);
  const totalRevenue = delivered.reduce(
    (sum, activity) => sum + decimalToNumber(activity.loadAmount),
    0,
  );
  const rateValues = delivered
    .map((activity) => decimalToNumber(activity.ratePerMile))
    .filter((value) => value > 0);
  const avgRatePerMile =
    rateValues.length > 0
      ? rateValues.reduce((sum, value) => sum + value, 0) / rateValues.length
      : 0;

  const activeDispatchers = await db.dispatcher.count({
    where: {
      organizationId: scope.organizationId,
      status: "ACTIVE",
      deletedAt: null,
      ...dispatcherScopeFilter(scope),
    },
  });

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalLoads: activities.length,
    deliveredLoads: delivered.length,
    avgRatePerMile: Math.round(avgRatePerMile * 100) / 100,
    activeDispatchers,
  };
}

export async function getTeamLeadMetrics(scope: AccessScope): Promise<DashboardMetric> {
  return buildMetrics(scope, activityScopeFilter(scope));
}
