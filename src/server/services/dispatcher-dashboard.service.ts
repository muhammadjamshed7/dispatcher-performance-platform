import "server-only";

import type { LoadActivityStatus } from "@/generated/prisma/client";
import { DELIVERED, STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { db } from "@/lib/db/prisma";
import type { DispatcherDashboardBundle } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  assertFilterAccess,
  buildActivityWhere,
  formatActivityDate,
  parseActivityDate,
  resolveDashboardDateRange,
  type ActivityFilters,
} from "@/server/utils/activity-filters";
import { carrierScopeFilter } from "@/server/utils/scope-filters";

const STATUS_CHART_META: Record<
  LoadActivityStatus,
  { label: string; color: string }
> = {
  DELIVERED: { label: "Delivered", color: "#22C55E" },
  NOT_WORKING: { label: "In Transit", color: "#3B82F6" },
  NOT_BOOKED: { label: "Pending", color: "#F97316" },
  CANCELLED: { label: "Canceled", color: "#EF4444" },
};

type ActivityRow = {
  id: string;
  activityDate: Date;
  carrierId: string;
  status: LoadActivityStatus;
  carrierNameSnapshot: string;
  driverNameSnapshot: string;
  truckTypeSnapshot: string;
  origin: string | null;
  destination: string | null;
  totalMiles: { toNumber(): number } | null;
  loadAmount: { toNumber(): number } | null;
  ratePerMile: { toNumber(): number } | null;
  reason: string | null;
};

type CarrierRow = {
  id: string;
  carrierName: string;
  driverName: string;
  truckType: string;
  status: string;
};

function decimalToNumber(value: { toNumber(): number } | null | undefined): number {
  if (!value) {
    return 0;
  }

  return value.toNumber();
}

function formatTruckTypeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapStatusToDisplay(status: LoadActivityStatus): string {
  return STATUS_CHART_META[status].label;
}

function getMonthToDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    dateFrom: formatActivityDate(start),
    dateTo: formatActivityDate(now),
  };
}

function getTodayDate(): string {
  return formatActivityDate(new Date());
}

async function fetchScopedActivities(
  scope: AccessScope,
  filters: ActivityFilters,
): Promise<ActivityRow[]> {
  return db.dailyActivity.findMany({
    where: buildActivityWhere(scope, filters),
    orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      activityDate: true,
      carrierId: true,
      status: true,
      carrierNameSnapshot: true,
      driverNameSnapshot: true,
      truckTypeSnapshot: true,
      origin: true,
      destination: true,
      totalMiles: true,
      loadAmount: true,
      ratePerMile: true,
      reason: true,
    },
  });
}

async function fetchAssignedActiveCarriers(scope: AccessScope): Promise<CarrierRow[]> {
  return db.carrier.findMany({
    where: {
      organizationId: scope.organizationId,
      status: "ACTIVE",
      deletedAt: null,
      ...carrierScopeFilter(scope),
    },
    select: {
      id: true,
      carrierName: true,
      driverName: true,
      truckType: true,
      status: true,
    },
    orderBy: { carrierName: "asc" },
  });
}

async function fetchDispatcherName(scope: AccessScope): Promise<string> {
  if (!scope.dispatcherId) {
    return "Dispatcher";
  }

  const dispatcher = await db.dispatcher.findFirst({
    where: {
      id: scope.dispatcherId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    select: { user: { select: { fullName: true } } },
  });

  return dispatcher?.user.fullName ?? "Dispatcher";
}

function buildRevenueTrend(activities: ActivityRow[]) {
  const revenueByDate = new Map<string, number>();

  for (const row of activities) {
    if (row.status !== DELIVERED) {
      continue;
    }

    const dateKey = formatActivityDate(row.activityDate);
    const amount = decimalToNumber(row.loadAmount);
    revenueByDate.set(dateKey, (revenueByDate.get(dateKey) ?? 0) + amount);
  }

  return [...revenueByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({
      date: parseActivityDate(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      revenue: Math.round(revenue * 100) / 100,
    }));
}

function buildStatusBreakdown(activities: ActivityRow[]) {
  const statusCounts = new Map<LoadActivityStatus, number>();
  for (const status of STATUSES) {
    statusCounts.set(status, 0);
  }

  for (const row of activities) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  const total = activities.length;

  return STATUSES.map((status) => {
    const value = statusCounts.get(status) ?? 0;
    const meta = STATUS_CHART_META[status];
    return {
      name: meta.label,
      value,
      percent: total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%",
      color: meta.color,
    };
  }).filter((item) => item.value > 0);
}

function buildMtdMetrics(mtdActivities: ActivityRow[]) {
  const delivered = mtdActivities.filter((row) => row.status === DELIVERED);
  const personalRevenue = delivered.reduce(
    (sum, row) => sum + decimalToNumber(row.loadAmount),
    0,
  );
  const rateValues = delivered
    .map((row) => decimalToNumber(row.ratePerMile))
    .filter((value) => value > 0);
  const avgRatePerMile =
    rateValues.length > 0
      ? rateValues.reduce((sum, value) => sum + value, 0) / rateValues.length
      : 0;

  return {
    personalRevenue: Math.round(personalRevenue * 100) / 100,
    deliveredLoads: delivered.length,
    avgRatePerMile: Math.round(avgRatePerMile * 100) / 100,
  };
}

function buildCarrierPerformance(
  carriers: CarrierRow[],
  mtdActivities: ActivityRow[],
  allActivities: ActivityRow[],
) {
  const mtdByCarrier = new Map<string, { loads: number; revenue: number }>();
  const latestByCarrier = new Map<string, ActivityRow>();

  for (const row of mtdActivities) {
    const existing = mtdByCarrier.get(row.carrierId) ?? { loads: 0, revenue: 0 };
    existing.loads += 1;
    if (row.status === DELIVERED) {
      existing.revenue += decimalToNumber(row.loadAmount);
    }
    mtdByCarrier.set(row.carrierId, existing);
  }

  for (const row of allActivities) {
    if (!latestByCarrier.has(row.carrierId)) {
      latestByCarrier.set(row.carrierId, row);
    }
  }

  return carriers.map((carrier) => {
    const mtd = mtdByCarrier.get(carrier.id) ?? { loads: 0, revenue: 0 };
    const latest = latestByCarrier.get(carrier.id);

    return {
      carrierId: carrier.id,
      carrierName: carrier.carrierName,
      driverName: carrier.driverName,
      truckType: formatTruckTypeLabel(carrier.truckType),
      recentStatus: latest ? mapStatusToDisplay(latest.status) : "—",
      lastActivityDate: latest
        ? parseActivityDate(formatActivityDate(latest.activityDate)).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" },
          )
        : null,
      loadsMtd: mtd.loads,
      revenueMtd: Math.round(mtd.revenue * 100) / 100,
      carrierStatus: carrier.status === "ACTIVE" ? "Active" : "Inactive",
    };
  });
}

function buildRecentActivities(activities: ActivityRow[]) {
  return activities.slice(0, 10).map((row) => ({
    id: row.id,
    date: parseActivityDate(formatActivityDate(row.activityDate)).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" },
    ),
    carrierName: row.carrierNameSnapshot,
    status: mapStatusToDisplay(row.status),
    origin: row.origin,
    destination: row.destination,
    miles: row.totalMiles ? decimalToNumber(row.totalMiles) : null,
    loadAmount: row.loadAmount ? decimalToNumber(row.loadAmount) : null,
    ratePerMile: row.ratePerMile ? decimalToNumber(row.ratePerMile) : null,
    reason: row.reason,
  }));
}

function buildTodayCompletion(
  carriers: CarrierRow[],
  todayActivities: ActivityRow[],
): DispatcherDashboardBundle["todayCompletion"] {
  const assignedActive = carriers.length;
  const loggedCarrierIds = new Set(todayActivities.map((row) => row.carrierId));
  const loggedToday = loggedCarrierIds.size;
  const pendingCount = Math.max(assignedActive - loggedToday, 0);
  const completionPercent =
    assignedActive > 0 ? Math.round((loggedToday / assignedActive) * 1000) / 10 : 0;
  const isComplete = assignedActive > 0 && pendingCount === 0;

  let message = "All assigned carriers have activity logged for today.";
  if (assignedActive === 0) {
    message = "No active carriers are assigned to you.";
  } else if (!isComplete) {
    message = `${pendingCount} carrier${pendingCount === 1 ? "" : "s"} still need today's activity.`;
  }

  return {
    assignedActive,
    loggedToday,
    pendingCount,
    completionPercent,
    isComplete,
    message,
  };
}

function buildPendingCarriers(
  carriers: CarrierRow[],
  todayActivities: ActivityRow[],
  allActivities: ActivityRow[],
): DispatcherDashboardBundle["pendingCarriers"] {
  const loggedTodayIds = new Set(todayActivities.map((row) => row.carrierId));
  const latestByCarrier = new Map<string, ActivityRow>();

  for (const row of allActivities) {
    if (!latestByCarrier.has(row.carrierId)) {
      latestByCarrier.set(row.carrierId, row);
    }
  }

  return carriers
    .filter((carrier) => !loggedTodayIds.has(carrier.id))
    .map((carrier) => {
      const latest = latestByCarrier.get(carrier.id);
      return {
        id: carrier.id,
        carrierName: carrier.carrierName,
        driverName: carrier.driverName,
        truckType: formatTruckTypeLabel(carrier.truckType),
        lastActivityStatus: latest ? mapStatusToDisplay(latest.status) : null,
        lastActivityDate: latest
          ? parseActivityDate(formatActivityDate(latest.activityDate)).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", year: "numeric" },
            )
          : null,
      };
    });
}

async function fetchFilterOptions(scope: AccessScope) {
  const carriers = await db.carrier.findMany({
    where: {
      organizationId: scope.organizationId,
      deletedAt: null,
      status: "ACTIVE",
      ...carrierScopeFilter(scope),
    },
    select: { id: true, carrierName: true },
    orderBy: { carrierName: "asc" },
  });

  return {
    carriers: carriers.map((carrier) => ({
      id: carrier.id,
      name: carrier.carrierName,
    })),
    truckTypes: TRUCK_TYPES.map((type) => ({
      value: type,
      label: formatTruckTypeLabel(type),
    })),
    statuses: STATUSES.map((status) => ({
      value: status,
      label: mapStatusToDisplay(status),
    })),
  };
}

export async function getDispatcherDashboardBundle(
  scope: AccessScope,
  rawFilters: ActivityFilters = {},
): Promise<DispatcherDashboardBundle> {
  await assertFilterAccess(scope, rawFilters);

  const range = resolveDashboardDateRange(rawFilters);
  const filters: ActivityFilters = {
    ...rawFilters,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };
  const mtdRange = getMonthToDateRange();
  const today = getTodayDate();

  const [
    dispatcherName,
    assignedCarriers,
    filterOptions,
    filteredActivities,
    mtdActivities,
    todayActivities,
    allActivities,
  ] = await Promise.all([
    fetchDispatcherName(scope),
    fetchAssignedActiveCarriers(scope),
    fetchFilterOptions(scope),
    fetchScopedActivities(scope, filters),
    fetchScopedActivities(scope, mtdRange),
    fetchScopedActivities(scope, { dateFrom: today, dateTo: today }),
    fetchScopedActivities(scope, {}),
  ]);

  const mtdMetrics = buildMtdMetrics(mtdActivities);
  const todayCompletion = buildTodayCompletion(assignedCarriers, todayActivities);

  return {
    dispatcherName,
    filters: {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      carrierId: filters.carrierId ?? null,
      truckType: filters.truckType ?? null,
      status: filters.status ?? null,
    },
    metrics: {
      ...mtdMetrics,
      assignedCarriers: assignedCarriers.length,
    },
    todayCompletion,
    pendingCarriers: buildPendingCarriers(
      assignedCarriers,
      todayActivities,
      allActivities,
    ),
    revenueTrend: buildRevenueTrend(filteredActivities),
    statusBreakdown: buildStatusBreakdown(filteredActivities),
    assignedCarrierPerformance: buildCarrierPerformance(
      assignedCarriers,
      mtdActivities,
      allActivities,
    ),
    recentActivities: buildRecentActivities(filteredActivities),
    filterOptions,
  };
}
