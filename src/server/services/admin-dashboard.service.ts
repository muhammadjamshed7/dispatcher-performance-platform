import "server-only";

import type { LoadActivityStatus } from "@/generated/prisma/client";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { db } from "@/lib/db/prisma";
import type { AdminDashboardBundle } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  assertFilterAccess,
  buildActivityWhere,
  buildTrendDateKeys,
  formatActivityDate,
  formatTrendDateLabel,
  normalizeActivityFilters,
  parseActivityDate,
  previousPeriodRange,
  resolveDashboardDateRange,
  type ActivityFilters,
} from "@/server/utils/activity-filters";
import {
  carrierScopeFilter,
  dispatcherScopeFilter,
  teamScopeFilter,
} from "@/server/utils/scope-filters";

type ActivityRecord = {
  id: string;
  activityDate: Date;
  createdAt: Date;
  status: LoadActivityStatus;
  loadAmount: { toNumber(): number } | null;
  teamNameSnapshot: string;
  dispatcherNameSnapshot: string;
  carrierNameSnapshot: string;
  truckTypeSnapshot: string;
  origin: string | null;
  destination: string | null;
};

const STATUS_CHART_META: Record<
  LoadActivityStatus,
  { label: string; color: string }
> = {
  DELIVERED: { label: "Delivered", color: "#22C55E" },
  NOT_WORKING: { label: "In Transit", color: "#3B82F6" },
  NOT_BOOKED: { label: "Pending", color: "#F97316" },
  CANCELLED: { label: "Canceled", color: "#EF4444" },
};

function decimalToNumber(value: { toNumber(): number } | null | undefined): number {
  if (!value) {
    return 0;
  }

  return value.toNumber();
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

function computeGrowthPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? null : 100;
  }

  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildSparkline(
  valuesByDate: Map<string, number>,
  dateKeys: string[],
): number[] {
  return dateKeys.map((key) => valuesByDate.get(key) ?? 0);
}

function buildStatusTrend(activities: ActivityRecord[], dateKeys: string[]) {
  const countsByDate = new Map<
    string,
    {
      delivered: number;
      cancelled: number;
      booked: number;
      notBooked: number;
      bookedButCancelled: number;
    }
  >();

  for (const dateKey of dateKeys) {
    countsByDate.set(dateKey, {
      delivered: 0,
      cancelled: 0,
      booked: 0,
      notBooked: 0,
      bookedButCancelled: 0,
    });
  }

  for (const row of activities) {
    const dateKey = formatActivityDate(row.activityDate);
    const bucket = countsByDate.get(dateKey);
    if (!bucket) continue;

    switch (row.status) {
      case DELIVERED:
        bucket.delivered += 1;
        break;
      case CANCELLED:
        bucket.cancelled += 1;
        break;
      case NOT_WORKING:
        bucket.booked += 1;
        break;
      case NOT_BOOKED:
        bucket.notBooked += 1;
        break;
      default:
        break;
    }
  }

  return dateKeys.map((dateKey) => {
    const bucket = countsByDate.get(dateKey)!;

    return {
      date: formatTrendDateLabel(dateKey),
      ...bucket,
    };
  });
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function buildMonthlyGrowthTrend(activities: ActivityRecord[]) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const revenueByMonth = new Map<number, number>();

  for (let month = -1; month <= currentMonth; month += 1) {
    revenueByMonth.set(month, 0);
  }

  for (const row of activities) {
    if (row.status !== DELIVERED) {
      continue;
    }

    const activityYear = row.activityDate.getUTCFullYear();
    const activityMonth = row.activityDate.getUTCMonth();
    const amount = decimalToNumber(row.loadAmount);

    if (activityYear === year && activityMonth <= currentMonth) {
      revenueByMonth.set(
        activityMonth,
        (revenueByMonth.get(activityMonth) ?? 0) + amount,
      );
      continue;
    }

    if (activityYear === year - 1 && activityMonth === 11) {
      revenueByMonth.set(-1, (revenueByMonth.get(-1) ?? 0) + amount);
    }
  }

  return Array.from({ length: currentMonth + 1 }, (_, month) => {
    const revenue = revenueByMonth.get(month) ?? 0;
    const previousRevenue =
      month === 0 ? (revenueByMonth.get(-1) ?? 0) : (revenueByMonth.get(month - 1) ?? 0);
    const growth =
      revenue === 0 && previousRevenue === 0
        ? 0
        : (computeGrowthPercent(revenue, previousRevenue) ?? 0);

    return {
      month: MONTH_LABELS[month]!,
      growth,
      revenue: Math.round(revenue * 100) / 100,
    };
  });
}

function filterActivitiesByDateRange(
  activities: ActivityRecord[],
  dateFrom: string,
  dateTo: string,
): ActivityRecord[] {
  return activities.filter((row) => {
    const dateKey = formatActivityDate(row.activityDate);
    return dateKey >= dateFrom && dateKey <= dateTo;
  });
}

function summarizeActivities(
  activities: ActivityRecord[],
  trendDateKeys: string[],
) {
  const revenueByDate = new Map<string, number>();
  const loadsByDate = new Map<string, number>();
  const deliveredByDate = new Map<string, number>();
  const loadsByTeamMap = new Map<string, number>();
  const statusCounts = new Map<LoadActivityStatus, number>();
  const revenueByDispatcher = new Map<
    string,
    { name: string; team: string; revenue: number }
  >();

  for (const status of STATUSES) {
    statusCounts.set(status, 0);
  }

  let deliveredCount = 0;
  let totalRevenue = 0;

  for (const row of activities) {
    const team = row.teamNameSnapshot || "Unassigned";
    loadsByTeamMap.set(team, (loadsByTeamMap.get(team) ?? 0) + 1);
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);

    if (row.status !== DELIVERED) {
      continue;
    }

    deliveredCount += 1;
    const dateKey = formatActivityDate(row.activityDate);
    loadsByDate.set(dateKey, (loadsByDate.get(dateKey) ?? 0) + 1);
    deliveredByDate.set(dateKey, (deliveredByDate.get(dateKey) ?? 0) + 1);

    const amount = decimalToNumber(row.loadAmount);
    totalRevenue += amount;
    revenueByDate.set(dateKey, (revenueByDate.get(dateKey) ?? 0) + amount);

    const existing = revenueByDispatcher.get(row.dispatcherNameSnapshot) ?? {
      name: row.dispatcherNameSnapshot,
      team: row.teamNameSnapshot,
      revenue: 0,
    };
    existing.revenue += amount;
    revenueByDispatcher.set(row.dispatcherNameSnapshot, existing);
  }

  return {
    totalLoads: deliveredCount,
    deliveredLoads: deliveredCount,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    onTimeRate:
      activities.length > 0
        ? Math.round((deliveredCount / activities.length) * 1000) / 10
        : 0,
    revenueTrend: [...revenueByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({
        date: parseActivityDate(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        revenue: Math.round(revenue),
      })),
    loadsByTeam: [...loadsByTeamMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([team, loads]) => ({ team, loads })),
    statusBreakdown: STATUSES.map((status) => {
      const value = statusCounts.get(status) ?? 0;
      const total = activities.length;
      const meta = STATUS_CHART_META[status];
      return {
        name: meta.label,
        value,
        percent: total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%",
        color: meta.color,
      };
    }).filter((item) => item.value > 0),
    topPerformers: [...revenueByDispatcher.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map((entry, index) => ({
        rank: index + 1,
        name: entry.name,
        initials: getInitials(entry.name),
        team: entry.team,
        revenue: Math.round(entry.revenue * 100) / 100,
      })),
    recentActivities: activities.slice(0, 5).map((row) => ({
      id: row.id,
      dateTime: row.createdAt.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      dispatcher: row.dispatcherNameSnapshot,
      initials: getInitials(row.dispatcherNameSnapshot),
      carrier: row.carrierNameSnapshot,
      loadId: row.id.toUpperCase(),
      route:
        row.origin && row.destination
          ? `${row.origin} → ${row.destination}`
          : "—",
      truckType: formatTruckTypeLabel(row.truckTypeSnapshot),
      status: mapStatusToDisplay(row.status),
      amount: decimalToNumber(row.loadAmount),
    })),
    sparklines: {
      revenue: buildSparkline(revenueByDate, trendDateKeys),
      loads: buildSparkline(loadsByDate, trendDateKeys),
      delivered: buildSparkline(deliveredByDate, trendDateKeys),
    },
    statusTrend: buildStatusTrend(activities, trendDateKeys),
  };
}

async function fetchActivities(
  scope: AccessScope,
  filters: ActivityFilters,
): Promise<ActivityRecord[]> {
  return db.dailyActivity.findMany({
    where: buildActivityWhere(scope, filters),
    orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      activityDate: true,
      createdAt: true,
      status: true,
      loadAmount: true,
      teamNameSnapshot: true,
      dispatcherNameSnapshot: true,
      carrierNameSnapshot: true,
      truckTypeSnapshot: true,
      origin: true,
      destination: true,
    },
  });
}

async function fetchActiveDispatchers(
  scope: AccessScope,
  filters: ActivityFilters,
): Promise<number> {
  const normalized = normalizeActivityFilters(filters);

  return db.dispatcher.count({
    where: {
      organizationId: scope.organizationId,
      status: "ACTIVE",
      deletedAt: null,
      ...dispatcherScopeFilter(scope),
      ...(normalized.teamIds.length === 1
        ? { teamId: normalized.teamIds[0] }
        : normalized.teamIds.length > 1
          ? { teamId: { in: normalized.teamIds } }
          : {}),
      ...(normalized.dispatcherIds.length === 1
        ? { id: normalized.dispatcherIds[0] }
        : normalized.dispatcherIds.length > 1
          ? { id: { in: normalized.dispatcherIds } }
          : {}),
    },
  });
}

async function fetchFilterOptions(scope: AccessScope) {
  const [teams, dispatchers, carriers] = await Promise.all([
    db.team.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        status: "ACTIVE",
        ...teamScopeFilter(scope),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.dispatcher.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        status: "ACTIVE",
        ...dispatcherScopeFilter(scope),
      },
      select: {
        id: true,
        teamId: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    db.carrier.findMany({
      where: {
        organizationId: scope.organizationId,
        deletedAt: null,
        status: "ACTIVE",
        ...carrierScopeFilter(scope),
      },
      select: { id: true, carrierName: true, teamId: true, dispatcherId: true },
      orderBy: { carrierName: "asc" },
    }),
  ]);

  return {
    teams,
    dispatchers: dispatchers.map((dispatcher) => ({
      id: dispatcher.id,
      name: dispatcher.user.fullName,
      teamId: dispatcher.teamId,
    })),
    carriers: carriers.map((carrier) => ({
      id: carrier.id,
      name: carrier.carrierName,
      teamId: carrier.teamId,
      dispatcherId: carrier.dispatcherId,
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

export async function getAdminDashboardBundle(
  scope: AccessScope,
  rawFilters: ActivityFilters = {},
): Promise<AdminDashboardBundle> {
  await assertFilterAccess(scope, rawFilters);

  const range = resolveDashboardDateRange(rawFilters);

  const previousRange = previousPeriodRange(range.dateFrom, range.dateTo);
  const now = new Date();
  const year = now.getUTCFullYear();
  const yearTrendFrom = formatActivityDate(new Date(Date.UTC(year - 1, 11, 1)));
  const yearTrendTo = formatActivityDate(now);

  const trendDateKeys = buildTrendDateKeys(range.dateFrom, range.dateTo);
  const trendDates = trendDateKeys.map(formatTrendDateLabel);

  const combinedDateFrom = [range.dateFrom, previousRange.dateFrom, yearTrendFrom].reduce(
    (min, value) => (value < min ? value : min),
  );
  const combinedDateTo = [range.dateTo, previousRange.dateTo, yearTrendTo].reduce(
    (max, value) => (value > max ? value : max),
  );

  const [allActivities, activeDispatchers, filterOptions] = await Promise.all([
    fetchActivities(scope, {
      ...rawFilters,
      dateFrom: combinedDateFrom,
      dateTo: combinedDateTo,
    }),
    fetchActiveDispatchers(scope, rawFilters),
    fetchFilterOptions(scope),
  ]);

  const currentActivities = filterActivitiesByDateRange(
    allActivities,
    range.dateFrom,
    range.dateTo,
  );
  const previousActivities = filterActivitiesByDateRange(
    allActivities,
    previousRange.dateFrom,
    previousRange.dateTo,
  );
  const yearTrendActivities = filterActivitiesByDateRange(
    allActivities,
    yearTrendFrom,
    yearTrendTo,
  );

  const current = summarizeActivities(currentActivities, trendDateKeys);
  const previous = summarizeActivities(previousActivities, trendDateKeys);

  const monthlyGrowth = computeGrowthPercent(
    current.totalRevenue,
    previous.totalRevenue,
  );

  const normalizedFilters = normalizeActivityFilters(rawFilters);

  return {
    filters: {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      teamIds: normalizedFilters.teamIds,
      dispatcherIds: normalizedFilters.dispatcherIds,
      carrierIds: normalizedFilters.carrierIds,
      truckTypes: normalizedFilters.truckTypes,
      statuses: normalizedFilters.statuses,
      statusKeys: normalizedFilters.statusKeys,
    },
    metrics: {
      totalRevenue: current.totalRevenue,
      totalLoads: current.totalLoads,
      deliveredLoads: current.deliveredLoads,
      activeDispatchers,
      onTimeRate: current.onTimeRate,
      monthlyGrowth: monthlyGrowth ?? 0,
      growth: {
        revenue: computeGrowthPercent(current.totalRevenue, previous.totalRevenue),
        loads: computeGrowthPercent(current.totalLoads, previous.totalLoads),
        delivered: computeGrowthPercent(
          current.deliveredLoads,
          previous.deliveredLoads,
        ),
        dispatchers: null,
        onTimeRate: computeGrowthPercent(current.onTimeRate, previous.onTimeRate),
        monthlyGrowth,
      },
      sparklines: current.sparklines,
      statusTrend: current.statusTrend,
      trendDates,
      monthlyGrowthTrend: buildMonthlyGrowthTrend(yearTrendActivities),
    },
    revenueTrend: current.revenueTrend,
    loadsByTeam: current.loadsByTeam,
    statusBreakdown: current.statusBreakdown,
    topPerformers: current.topPerformers,
    recentActivities: current.recentActivities,
    filterOptions,
  };
}

export async function getTeamLeadDashboardBundle(
  scope: AccessScope,
  rawFilters: ActivityFilters = {},
): Promise<AdminDashboardBundle> {
  return getAdminDashboardBundle(scope, rawFilters);
}
