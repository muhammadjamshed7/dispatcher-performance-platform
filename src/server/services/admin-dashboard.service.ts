import "server-only";

import type { LoadActivityStatus } from "@/lib/db/types";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
} from "@/lib/constants/statuses";
import { APPROVED } from "@/lib/constants/activity-approval";
import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { T, db } from "@/lib/db/client";
import { applyScopeWhere, asFilterable } from "@/lib/db/query";
import { assertDb, countRows, toAmount, unwrapRelation } from "@/lib/db/utils";
import type { AdminDashboardBundle } from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  applyActivityFilters,
  assertFilterAccess,
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
import { getOrganizationPreferences } from "@/server/services/settings.service";
import { getDateKeyInTimeZone } from "@/lib/utils/resolve-date-range";

type ActivityRecord = {
  id: string;
  activityDate: string;
  createdAt: string;
  status: LoadActivityStatus;
  loadAmount: string | null;
  dispatcherId: string;
  teamNameSnapshot: string;
  dispatcherNameSnapshot: string;
  carrierNameSnapshot: string;
  truckTypeSnapshot: string;
  origin: string | null;
  destination: string | null;
};

type DispatcherRevenueLookup = Map<string, { name: string; team: string }>;

const STATUS_CHART_META: Record<
  LoadActivityStatus,
  { label: string; color: string }
> = {
  DELIVERED: { label: "Delivered", color: "#22C55E" },
  NOT_WORKING: { label: "In Transit", color: "#3B82F6" },
  NOT_BOOKED: { label: "Pending", color: "#F97316" },
  CANCELLED: { label: "Canceled", color: "#EF4444" },
};

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

function computeGrowthPercent(
  current: number,
  previous: number,
): number | null {
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
    const dateKey = row.activityDate;
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

    const activityDate = parseActivityDate(row.activityDate);
    const activityYear = activityDate.getUTCFullYear();
    const activityMonth = activityDate.getUTCMonth();
    const amount = toAmount(row.loadAmount);

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
      month === 0
        ? (revenueByMonth.get(-1) ?? 0)
        : (revenueByMonth.get(month - 1) ?? 0);
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
    const dateKey = row.activityDate;
    return dateKey >= dateFrom && dateKey <= dateTo;
  });
}

function summarizeActivities(
  activities: ActivityRecord[],
  trendDateKeys: string[],
  dispatcherLookup: DispatcherRevenueLookup = new Map(),
) {
  const revenueByDate = new Map<string, number>();
  const loadsByDate = new Map<string, number>();
  const deliveredByDate = new Map<string, number>();
  const loadsByTeamMap = new Map<string, number>();
  const revenueByTeamMap = new Map<string, number>();
  const statusCounts = new Map<LoadActivityStatus, number>();
  const revenueByDispatcher = new Map<
    string,
    { id: string; name: string; team: string; revenue: number }
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
    const dateKey = row.activityDate;
    loadsByDate.set(dateKey, (loadsByDate.get(dateKey) ?? 0) + 1);
    deliveredByDate.set(dateKey, (deliveredByDate.get(dateKey) ?? 0) + 1);

    const amount = toAmount(row.loadAmount);
    totalRevenue += amount;
    revenueByDate.set(dateKey, (revenueByDate.get(dateKey) ?? 0) + amount);
    revenueByTeamMap.set(team, (revenueByTeamMap.get(team) ?? 0) + amount);

    const dispatcher = dispatcherLookup.get(row.dispatcherId);
    const dispatcherName =
      dispatcher?.name || row.dispatcherNameSnapshot || "Unknown Dispatcher";
    const dispatcherTeam =
      dispatcher?.team || row.teamNameSnapshot || "Unassigned";
    const existing = revenueByDispatcher.get(row.dispatcherId) ?? {
      id: row.dispatcherId,
      name: dispatcherName,
      team: dispatcherTeam,
      revenue: 0,
    };
    existing.revenue += amount;
    revenueByDispatcher.set(row.dispatcherId, existing);
  }

  return {
    totalLoads: activities.length,
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
    revenueComparison: [
      ...[...revenueByDispatcher.values()]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map((entry) => ({
          label: entry.name,
          group: "Dispatcher" as const,
          revenue: Math.round(entry.revenue * 100) / 100,
        })),
      ...[...revenueByTeamMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([team, revenue]) => ({
          label: team,
          group: "Team" as const,
          revenue: Math.round(revenue * 100) / 100,
        })),
    ],
    dispatcherRevenue: [...revenueByDispatcher.values()]
      .filter((entry) => entry.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .map((entry) => ({
        dispatcherId: entry.id,
        dispatcher: entry.name,
        team: entry.team || "Unassigned",
        revenue: Math.round(entry.revenue * 100) / 100,
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
      dateTime: new Date(row.createdAt).toLocaleString("en-US", {
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
      amount: toAmount(row.loadAmount),
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
  const query = applyActivityFilters(
    asFilterable(
      db()
        .from(T.DailyActivity)
        .select(
          "id, activityDate, createdAt, status, loadAmount, dispatcherId, teamNameSnapshot, dispatcherNameSnapshot, carrierNameSnapshot, truckTypeSnapshot, origin, destination",
        )
        .eq("approvalStatus", APPROVED)
        .order("activityDate", { ascending: false })
        .order("createdAt", { ascending: false }),
    ),
    scope,
    filters,
  );

  return (assertDb(await query) ?? []) as ActivityRecord[];
}

async function fetchActiveDispatchers(
  scope: AccessScope,
  filters: ActivityFilters,
): Promise<number> {
  const normalized = normalizeActivityFilters(filters);
  const countFilters: Array<{
    column: string;
    value: string | null;
    op?: "eq" | "is";
  }> = [
    { column: "organizationId", value: scope.organizationId },
    { column: "status", value: "ACTIVE" },
    { column: "deletedAt", value: null, op: "is" },
  ];

  const dispatcherFilter = dispatcherScopeFilter(scope);
  if ("id" in dispatcherFilter && dispatcherFilter.id) {
    countFilters.push({ column: "id", value: dispatcherFilter.id });
  }
  if ("teamId" in dispatcherFilter && dispatcherFilter.teamId) {
    countFilters.push({ column: "teamId", value: dispatcherFilter.teamId });
  }

  if (normalized.teamIds.length === 1) {
    countFilters.push({ column: "teamId", value: normalized.teamIds[0]! });
  } else if (normalized.teamIds.length > 1) {
    return countRowsWithIn(
      T.Dispatcher,
      countFilters,
      "teamId",
      normalized.teamIds,
    );
  }

  if (normalized.dispatcherIds.length === 1) {
    countFilters.push({ column: "id", value: normalized.dispatcherIds[0]! });
  } else if (normalized.dispatcherIds.length > 1) {
    return countRowsWithIn(
      T.Dispatcher,
      countFilters,
      "id",
      normalized.dispatcherIds,
    );
  }

  return countRows(T.Dispatcher, countFilters);
}

async function countRowsWithIn(
  table: string,
  filters: Array<{ column: string; value: string | null; op?: "eq" | "is" }>,
  inColumn: string,
  inValues: string[],
): Promise<number> {
  let query = db()
    .from(table)
    .select("*", { count: "exact", head: true })
    .in(inColumn, inValues);

  for (const filter of filters) {
    if (filter.op === "is") {
      query = query.is(filter.column, filter.value);
    } else {
      query = query.eq(filter.column, filter.value as string);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function fetchFilterOptions(scope: AccessScope) {
  const teamQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Team)
        .select("id, name")
        .eq("organizationId", scope.organizationId)
        .eq("status", "ACTIVE")
        .is("deletedAt", null)
        .order("name", { ascending: true }),
    ),
    teamScopeFilter(scope),
  );

  const dispatcherQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Dispatcher)
        .select("id, teamId, user:User!Dispatcher_userId_fkey(fullName)")
        .eq("organizationId", scope.organizationId)
        .eq("status", "ACTIVE")
        .is("deletedAt", null),
    ),
    dispatcherScopeFilter(scope),
  );

  const carrierQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Carrier)
        .select("id, carrierName, teamId, dispatcherId")
        .eq("organizationId", scope.organizationId)
        .eq("status", "ACTIVE")
        .is("deletedAt", null)
        .order("carrierName", { ascending: true }),
    ),
    carrierScopeFilter(scope),
  );

  const [teams, dispatchersRaw, carriers] = await Promise.all([
    assertDb(await teamQuery) ?? [],
    assertDb(await dispatcherQuery) ?? [],
    assertDb(await carrierQuery) ?? [],
  ]);

  const dispatchers = (
    dispatchersRaw as Array<{
      id: string;
      teamId: string;
      user: { fullName: string } | Array<{ fullName: string }>;
    }>
  )
    .map((dispatcher) => ({
      id: dispatcher.id,
      name: unwrapRelation(dispatcher.user)?.fullName ?? "",
      teamId: dispatcher.teamId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    teams: teams as Array<{ id: string; name: string }>,
    dispatchers,
    carriers: (
      carriers as Array<{
        id: string;
        carrierName: string;
        teamId: string;
        dispatcherId: string | null;
      }>
    ).map((carrier) => ({
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
  const preferences = await getOrganizationPreferences(scope.organizationId);

  const range = resolveDashboardDateRange(rawFilters, preferences.timezone);

  const previousRange = previousPeriodRange(range.dateFrom, range.dateTo);
  const todayKey = getDateKeyInTimeZone(new Date(), preferences.timezone);
  const now = new Date(`${todayKey}T00:00:00Z`);
  const year = now.getUTCFullYear();
  const yearTrendFrom = formatActivityDate(new Date(Date.UTC(year - 1, 11, 1)));
  const yearTrendTo = todayKey;

  const trendDateKeys = buildTrendDateKeys(range.dateFrom, range.dateTo);
  const trendDates = trendDateKeys.map(formatTrendDateLabel);

  const combinedDateFrom = [
    range.dateFrom,
    previousRange.dateFrom,
    yearTrendFrom,
  ].reduce((min, value) => (value < min ? value : min));
  const combinedDateTo = [
    range.dateTo,
    previousRange.dateTo,
    yearTrendTo,
  ].reduce((max, value) => (value > max ? value : max));

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
  const teamNameById = new Map(
    filterOptions.teams.map((team) => [team.id, team.name]),
  );
  const dispatcherLookup: DispatcherRevenueLookup = new Map(
    filterOptions.dispatchers.map((dispatcher) => [
      dispatcher.id,
      {
        name: dispatcher.name,
        team: teamNameById.get(dispatcher.teamId) ?? "Unassigned",
      },
    ]),
  );

  const current = summarizeActivities(
    currentActivities,
    trendDateKeys,
    dispatcherLookup,
  );
  const previous = summarizeActivities(
    previousActivities,
    trendDateKeys,
    dispatcherLookup,
  );

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
        revenue: computeGrowthPercent(
          current.totalRevenue,
          previous.totalRevenue,
        ),
        loads: computeGrowthPercent(current.totalLoads, previous.totalLoads),
        delivered: computeGrowthPercent(
          current.deliveredLoads,
          previous.deliveredLoads,
        ),
        dispatchers: null,
        onTimeRate: computeGrowthPercent(
          current.onTimeRate,
          previous.onTimeRate,
        ),
        monthlyGrowth,
      },
      sparklines: current.sparklines,
      statusTrend: current.statusTrend,
      trendDates,
      monthlyGrowthTrend: buildMonthlyGrowthTrend(yearTrendActivities),
    },
    revenueTrend: current.revenueTrend,
    revenueComparison: current.revenueComparison,
    dispatcherRevenue: current.dispatcherRevenue,
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
