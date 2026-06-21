import "server-only";

import type { LoadActivityStatus } from "@/generated/prisma/client";
import { DELIVERED } from "@/lib/constants/statuses";
import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { db } from "@/lib/db/prisma";
import type { AdminDashboardBundle } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  assertFilterAccess,
  buildActivityWhere,
  formatActivityDate,
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

function buildSparkline(valuesByDate: Map<string, number>): number[] {
  const values = [...valuesByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);

  if (values.length === 0) {
    return [];
  }

  return values.slice(-7);
}

function summarizeActivities(activities: ActivityRecord[]) {
  const delivered = activities.filter((row) => row.status === DELIVERED);
  const totalRevenue = delivered.reduce(
    (sum, row) => sum + decimalToNumber(row.loadAmount),
    0,
  );

  const revenueByDate = new Map<string, number>();
  const loadsByDate = new Map<string, number>();
  const deliveredByDate = new Map<string, number>();

  for (const row of activities) {
    const dateKey = formatActivityDate(row.activityDate);
    loadsByDate.set(dateKey, (loadsByDate.get(dateKey) ?? 0) + 1);

    if (row.status === DELIVERED) {
      deliveredByDate.set(dateKey, (deliveredByDate.get(dateKey) ?? 0) + 1);
      const amount = decimalToNumber(row.loadAmount);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) ?? 0) + amount);
    }
  }

  const loadsByTeamMap = new Map<string, number>();
  for (const row of activities) {
    const team = row.teamNameSnapshot || "Unassigned";
    loadsByTeamMap.set(team, (loadsByTeamMap.get(team) ?? 0) + 1);
  }

  const statusCounts = new Map<LoadActivityStatus, number>();
  for (const status of STATUSES) {
    statusCounts.set(status, 0);
  }
  for (const row of activities) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  }

  const revenueByDispatcher = new Map<
    string,
    { name: string; team: string; revenue: number }
  >();
  for (const row of delivered) {
    const amount = decimalToNumber(row.loadAmount);
    const existing = revenueByDispatcher.get(row.dispatcherNameSnapshot) ?? {
      name: row.dispatcherNameSnapshot,
      team: row.teamNameSnapshot,
      revenue: 0,
    };
    existing.revenue += amount;
    revenueByDispatcher.set(row.dispatcherNameSnapshot, existing);
  }

  return {
    totalLoads: activities.length,
    deliveredLoads: delivered.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    onTimeRate:
      activities.length > 0
        ? Math.round((delivered.length / activities.length) * 1000) / 10
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
      revenue: buildSparkline(revenueByDate),
      loads: buildSparkline(loadsByDate),
      delivered: buildSparkline(deliveredByDate),
    },
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

async function fetchActiveDispatchers(scope: AccessScope): Promise<number> {
  return db.dispatcher.count({
    where: {
      organizationId: scope.organizationId,
      status: "ACTIVE",
      deletedAt: null,
      ...dispatcherScopeFilter(scope),
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
      select: { id: true, carrierName: true },
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
  assertFilterAccess(scope, rawFilters);

  const range = resolveDashboardDateRange(rawFilters);
  const filters: ActivityFilters = {
    ...rawFilters,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };

  const previousRange = previousPeriodRange(range.dateFrom, range.dateTo);

  const [currentActivities, previousActivities, activeDispatchers, filterOptions] =
    await Promise.all([
      fetchActivities(scope, filters),
      fetchActivities(scope, {
        ...rawFilters,
        dateFrom: previousRange.dateFrom,
        dateTo: previousRange.dateTo,
      }),
      fetchActiveDispatchers(scope),
      fetchFilterOptions(scope),
    ]);

  const current = summarizeActivities(currentActivities);
  const previous = summarizeActivities(previousActivities);

  const monthlyGrowth = computeGrowthPercent(
    current.totalRevenue,
    previous.totalRevenue,
  );

  return {
    filters: {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      teamId: filters.teamId ?? null,
      dispatcherId: filters.dispatcherId ?? null,
      carrierId: filters.carrierId ?? null,
      truckType: filters.truckType ?? null,
      status: filters.status ?? null,
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

export async function getDispatcherDashboardBundle(
  scope: AccessScope,
  rawFilters: ActivityFilters = {},
): Promise<AdminDashboardBundle> {
  return getAdminDashboardBundle(scope, rawFilters);
}
