import "server-only";

import type { LoadActivityStatus } from "@/lib/db/types";
import { DELIVERED, STATUSES } from "@/lib/constants/statuses";
import { APPROVED } from "@/lib/constants/activity-approval";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { T, db } from "@/lib/db/client";
import { applyScopeWhere, asFilterable } from "@/lib/db/query";
import { assertDb, decimalToNumber } from "@/lib/db/utils";
import type { DispatcherDashboardBundle } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  applyActivityFilters,
  assertFilterAccess,
  formatActivityDate,
  parseActivityDate,
  resolveDashboardDateRange,
  type ActivityFilters,
} from "@/server/utils/activity-filters";
import { carrierScopeFilter } from "@/server/utils/scope-filters";
import { getOrganizationPreferences } from "@/server/services/settings.service";
import { getDateKeyInTimeZone } from "@/lib/utils/resolve-date-range";

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

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
  activityDate: string;
  carrierId: string;
  status: LoadActivityStatus;
  carrierNameSnapshot: string;
  driverNameSnapshot: string;
  truckTypeSnapshot: string;
  origin: string | null;
  destination: string | null;
  totalMiles: string | null;
  loadAmount: string | null;
  ratePerMile: string | null;
  reason: string | null;
};

type CarrierRow = {
  id: string;
  carrierName: string;
  driverName: string;
  truckType: string;
  status: string;
};

function toAmount(value: string | null | undefined): number {
  return decimalToNumber(value) ?? 0;
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

function getMonthToDateRange(timezone: string): {
  dateFrom: string;
  dateTo: string;
} {
  const todayKey = getDateKeyInTimeZone(new Date(), timezone);
  const now = new Date(`${todayKey}T00:00:00Z`);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    dateFrom: formatActivityDate(start),
    dateTo: todayKey,
  };
}

function getTodayDate(timezone: string): string {
  return getDateKeyInTimeZone(new Date(), timezone);
}

async function fetchScopedActivities(
  scope: AccessScope,
  filters: ActivityFilters,
  approvedOnly = true,
): Promise<ActivityRow[]> {
  const effectiveFilters = approvedOnly
    ? { ...filters, approvalStatus: APPROVED }
    : filters;

  const query = applyActivityFilters(
    asFilterable(
      db()
        .from(T.DailyActivity)
        .select(
          "id, activityDate, carrierId, status, carrierNameSnapshot, driverNameSnapshot, truckTypeSnapshot, origin, destination, totalMiles, loadAmount, ratePerMile, reason",
        )
        .order("activityDate", { ascending: false })
        .order("createdAt", { ascending: false }),
    ),
    scope,
    effectiveFilters,
  );

  return (assertDb(await query) ?? []) as ActivityRow[];
}

async function fetchAssignedActiveCarriers(
  scope: AccessScope,
): Promise<CarrierRow[]> {
  const query = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Carrier)
        .select("id, carrierName, driverName, truckType, status")
        .eq("organizationId", scope.organizationId)
        .eq("status", "ACTIVE")
        .is("deletedAt", null)
        .order("carrierName", { ascending: true }),
    ),
    carrierScopeFilter(scope),
  );

  return (assertDb(await query) ?? []) as CarrierRow[];
}

async function fetchDispatcherName(scope: AccessScope): Promise<string> {
  if (!scope.dispatcherId) {
    return "Dispatcher";
  }

  const result = await db()
    .from(T.Dispatcher)
    .select("user:User!Dispatcher_userId_fkey(fullName)")
    .eq("id", scope.dispatcherId)
    .eq("organizationId", scope.organizationId)
    .is("deletedAt", null)
    .maybeSingle();

  const dispatcher = result.data as {
    user: { fullName: string } | Array<{ fullName: string }>;
  } | null;

  return unwrapRelation(dispatcher?.user)?.fullName ?? "Dispatcher";
}

function filterActivitiesByDate(
  activities: ActivityRow[],
  dateFrom: string,
  dateTo: string,
): ActivityRow[] {
  return activities.filter(
    (row) => row.activityDate >= dateFrom && row.activityDate <= dateTo,
  );
}

function buildRevenueTrend(activities: ActivityRow[]) {
  const revenueByDate = new Map<string, number>();

  for (const row of activities) {
    if (row.status !== DELIVERED) {
      continue;
    }

    const dateKey = row.activityDate;
    const amount = toAmount(row.loadAmount);
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
    (sum, row) => sum + toAmount(row.loadAmount),
    0,
  );
  const rateValues = delivered
    .map((row) => toAmount(row.ratePerMile))
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
    const existing = mtdByCarrier.get(row.carrierId) ?? {
      loads: 0,
      revenue: 0,
    };
    existing.loads += 1;
    if (row.status === DELIVERED) {
      existing.revenue += toAmount(row.loadAmount);
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
        ? parseActivityDate(latest.activityDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
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
    date: parseActivityDate(row.activityDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    carrierName: row.carrierNameSnapshot,
    status: mapStatusToDisplay(row.status),
    origin: row.origin,
    destination: row.destination,
    miles: row.totalMiles ? toAmount(row.totalMiles) : null,
    loadAmount: row.loadAmount ? toAmount(row.loadAmount) : null,
    ratePerMile: row.ratePerMile ? toAmount(row.ratePerMile) : null,
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
    assignedActive > 0
      ? Math.round((loggedToday / assignedActive) * 1000) / 10
      : 0;
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
          ? parseActivityDate(latest.activityDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null,
      };
    });
}

async function fetchFilterOptions(scope: AccessScope) {
  const query = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Carrier)
        .select("id, carrierName")
        .eq("organizationId", scope.organizationId)
        .eq("status", "ACTIVE")
        .is("deletedAt", null)
        .order("carrierName", { ascending: true }),
    ),
    carrierScopeFilter(scope),
  );

  const carriers = (assertDb(await query) ?? []) as Array<{
    id: string;
    carrierName: string;
  }>;

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
  const preferences = await getOrganizationPreferences(scope.organizationId);

  const range = resolveDashboardDateRange(rawFilters, preferences.timezone);
  const filters: ActivityFilters = {
    ...rawFilters,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };
  const mtdRange = getMonthToDateRange(preferences.timezone);
  const today = getTodayDate(preferences.timezone);

  // `allActivities` is the dispatcher's full approved history (no attribute
  // filters). The month-to-date and today sets only ever differed by date, so
  // we slice them in memory instead of issuing separate identical queries.
  const [
    dispatcherName,
    assignedCarriers,
    filterOptions,
    filteredActivities,
    allActivities,
  ] = await Promise.all([
    fetchDispatcherName(scope),
    fetchAssignedActiveCarriers(scope),
    fetchFilterOptions(scope),
    fetchScopedActivities(scope, filters),
    fetchScopedActivities(scope, {}),
  ]);

  const mtdActivities = filterActivitiesByDate(
    allActivities,
    mtdRange.dateFrom,
    mtdRange.dateTo,
  );
  const todayActivities = filterActivitiesByDate(allActivities, today, today);

  const mtdMetrics = buildMtdMetrics(mtdActivities);
  const todayCompletion = buildTodayCompletion(
    assignedCarriers,
    todayActivities,
  );

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
