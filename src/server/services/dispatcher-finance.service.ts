import "server-only";

import { z } from "zod";
import { format as formatDate } from "date-fns";
import type {
  DailyActivity,
  LoadActivityStatus,
  TeamStatus,
  TruckType,
} from "@/lib/db/types";
import { NotFoundError } from "@/lib/errors/not-found-error";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";
import { LOAD_ACTIVITY_STATUS_LABELS } from "@/lib/constants/status-labels";
import { APPROVED } from "@/lib/constants/activity-approval";
import { T, db } from "@/lib/db/client";
import { assertDb, decimalToNumber } from "@/lib/db/utils";
import type {
  DispatcherFinanceBundle,
  FinanceAppliedFilters,
  FinanceCarrierRow,
  FinanceLoadRow,
  FinanceMonthlyEarnings,
  FinanceSummary,
} from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  computeAverageRatePerMile,
  computeBookingEfficiency,
} from "@/lib/utils/compute-finance-metrics";
import { resolveFinanceDateRangeStrict } from "@/lib/utils/resolve-finance-date-range";
import {
  getDateKeyInTimeZone,
  formatDateKey,
} from "@/lib/utils/resolve-date-range";
import { getOrganizationPreferences } from "@/server/services/settings.service";

const financeFiltersSchema = z.object({
  dateRange: z.enum(["today", "this-week", "this-month", "custom"]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  carrierId: z.string().optional(),
  status: z.enum(STATUSES).optional(),
});

export type FinanceFilters = z.infer<typeof financeFiltersSchema>;

type ActivityRecord = Pick<
  DailyActivity,
  | "id"
  | "activityDate"
  | "carrierId"
  | "status"
  | "carrierNameSnapshot"
  | "driverNameSnapshot"
  | "truckTypeSnapshot"
  | "origin"
  | "destination"
  | "totalMiles"
  | "loadAmount"
  | "ratePerMile"
  | "dispatchFee"
>;

function toAmount(value: string | null | undefined): number {
  return decimalToNumber(value) ?? 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function countByStatus(
  activities: ActivityRecord[],
  status: LoadActivityStatus,
): number {
  return activities.filter((activity) => activity.status === status).length;
}

function deliveredRevenue(activities: ActivityRecord[]): number {
  return roundCurrency(
    activities
      .filter((activity) => activity.status === DELIVERED)
      .reduce((sum, activity) => sum + toAmount(activity.loadAmount), 0),
  );
}

function deliveredDispatchFees(activities: ActivityRecord[]): number {
  return roundCurrency(
    activities
      .filter((activity) => activity.status === DELIVERED)
      .reduce((sum, activity) => sum + toAmount(activity.dispatchFee), 0),
  );
}

function mapActivityMetrics(activities: ActivityRecord[]) {
  return activities.map((activity) => ({
    status: activity.status,
    loadAmount: toAmount(activity.loadAmount),
    totalMiles: toAmount(activity.totalMiles),
  }));
}

function monthOverMonthChange(
  current: number,
  previous: number,
): number | null {
  if (previous <= 0) {
    return current > 0 ? 100 : null;
  }

  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildSummary(
  filteredActivities: ActivityRecord[],
  efficiencyActivities: ActivityRecord[],
  currentMonthActivities: ActivityRecord[],
  previousMonthActivities: ActivityRecord[],
): FinanceSummary {
  return {
    totalRevenue: deliveredRevenue(filteredActivities),
    totalDispatchFee: deliveredDispatchFees(filteredActivities),
    deliveredLoads: countByStatus(filteredActivities, DELIVERED),
    cancelledLoads: countByStatus(filteredActivities, CANCELLED),
    notBookedCount: countByStatus(filteredActivities, NOT_BOOKED),
    notWorkingCount: countByStatus(filteredActivities, NOT_WORKING),
    averageRatePerMile: computeAverageRatePerMile(
      mapActivityMetrics(filteredActivities),
    ),
    bookingEfficiency: computeBookingEfficiency(efficiencyActivities),
    currentMonthRevenue: deliveredRevenue(currentMonthActivities),
    currentMonthDispatchFee: deliveredDispatchFees(currentMonthActivities),
    monthOverMonthRevenueChange: monthOverMonthChange(
      deliveredRevenue(currentMonthActivities),
      deliveredRevenue(previousMonthActivities),
    ),
    monthOverMonthDispatchFeeChange: monthOverMonthChange(
      deliveredDispatchFees(currentMonthActivities),
      deliveredDispatchFees(previousMonthActivities),
    ),
  };
}

function buildCarrierBreakdown(
  activities: ActivityRecord[],
): FinanceCarrierRow[] {
  const grouped = new Map<
    string,
    {
      carrierName: string;
      driverName: string;
      truckType: ActivityRecord["truckTypeSnapshot"];
      activities: ActivityRecord[];
    }
  >();

  for (const activity of activities) {
    const existing = grouped.get(activity.carrierId) ?? {
      carrierName: activity.carrierNameSnapshot,
      driverName: activity.driverNameSnapshot,
      truckType: activity.truckTypeSnapshot,
      activities: [],
    };

    existing.activities.push(activity);
    grouped.set(activity.carrierId, existing);
  }

  return [...grouped.entries()]
    .map(([id, group]) => ({
      id,
      carrierName: group.carrierName,
      driverName: group.driverName,
      truckType: group.truckType,
      deliveredLoads: countByStatus(group.activities, DELIVERED),
      totalLoadAmount: deliveredRevenue(group.activities),
      dispatchFeeEarned: deliveredDispatchFees(group.activities),
      averageRatePerMile: computeAverageRatePerMile(
        mapActivityMetrics(group.activities),
      ),
    }))
    .sort((a, b) => b.totalLoadAmount - a.totalLoadAmount);
}

function buildLoadHistory(activities: ActivityRecord[]): FinanceLoadRow[] {
  return activities.map((activity) => ({
    id: activity.id,
    date: activity.activityDate,
    carrierName: activity.carrierNameSnapshot,
    origin: activity.origin,
    destination: activity.destination,
    miles: toAmount(activity.totalMiles) || null,
    loadAmount:
      activity.status === DELIVERED
        ? toAmount(activity.loadAmount) || null
        : null,
    ratePerMile:
      activity.status === DELIVERED
        ? toAmount(activity.ratePerMile) || null
        : null,
    dispatchFee:
      activity.status === DELIVERED
        ? toAmount(activity.dispatchFee) || null
        : null,
    status: activity.status,
  }));
}

function buildMonthlyEarnings(
  activities: ActivityRecord[],
  timezone: string,
): FinanceMonthlyEarnings[] {
  const now = new Date(
    `${getDateKeyInTimeZone(new Date(), timezone)}T00:00:00Z`,
  );
  const monthKeys: string[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    monthKeys.push(
      `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }

  const grouped = new Map<string, ActivityRecord[]>(
    monthKeys.map((monthKey) => [monthKey, []]),
  );

  for (const activity of activities) {
    const monthKey = activity.activityDate.slice(0, 7);
    const bucket = grouped.get(monthKey);
    if (bucket) {
      bucket.push(activity);
    }
  }

  return monthKeys.map((monthKey) => {
    const monthActivities = grouped.get(monthKey) ?? [];
    const [year, month] = monthKey.split("-").map(Number);
    const monthLabel = new Date(
      Date.UTC(year!, month! - 1, 1),
    ).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    return {
      monthKey,
      monthLabel,
      revenue: deliveredRevenue(monthActivities),
      dispatchFee: deliveredDispatchFees(monthActivities),
    };
  });
}

function getMonthRange(
  monthOffset: number,
  timezone: string,
): { dateFrom: string; dateTo: string } {
  const todayKey = getDateKeyInTimeZone(new Date(), timezone);
  const now = new Date(`${todayKey}T00:00:00Z`);
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1),
  );
  const end =
    monthOffset === 0
      ? now
      : new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + monthOffset + 1,
            0,
          ),
        );

  return {
    dateFrom: formatDateKey(start),
    dateTo: formatDateKey(end),
  };
}

function getMonthlyTrendRange(timezone: string): {
  dateFrom: string;
  dateTo: string;
} {
  const todayKey = getDateKeyInTimeZone(new Date(), timezone);
  const now = new Date(`${todayKey}T00:00:00Z`);
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );
  return {
    dateFrom: formatDateKey(start),
    dateTo: todayKey,
  };
}

async function fetchActivitiesForDispatcher(
  organizationId: string,
  dispatcherId: string,
  dateFrom: string,
  dateTo: string,
  filters: Pick<FinanceFilters, "carrierId" | "status">,
): Promise<ActivityRecord[]> {
  let query = db()
    .from(T.DailyActivity)
    .select(
      "id, activityDate, carrierId, status, carrierNameSnapshot, driverNameSnapshot, truckTypeSnapshot, origin, destination, totalMiles, loadAmount, ratePerMile, dispatchFee",
    )
    .eq("organizationId", organizationId)
    .eq("dispatcherId", dispatcherId)
    .eq("approvalStatus", APPROVED)
    .gte("activityDate", dateFrom)
    .lte("activityDate", dateTo)
    .order("activityDate", { ascending: false })
    .order("createdAt", { ascending: false });

  if (filters.carrierId) {
    query = query.eq("carrierId", filters.carrierId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  return (assertDb(await query) ?? []) as ActivityRecord[];
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadDispatcherProfile(
  organizationId: string,
  dispatcherId: string,
) {
  const [dispatcherResult, carriersResult] = await Promise.all([
    db()
      .from(T.Dispatcher)
      .select(
        "id, status, user:User!Dispatcher_userId_fkey(fullName, email, phoneNumber, role), team:Team!Dispatcher_teamId_fkey(name)",
      )
      .eq("id", dispatcherId)
      .eq("organizationId", organizationId)
      .is("deletedAt", null)
      .maybeSingle(),
    db()
      .from(T.Carrier)
      .select("id, carrierName, driverName, truckType")
      .eq("dispatcherId", dispatcherId)
      .eq("organizationId", organizationId)
      .is("deletedAt", null)
      .order("carrierName", { ascending: true }),
  ]);

  const dispatcher = dispatcherResult.data as {
    id: string;
    status: TeamStatus;
    user:
      | {
          fullName: string;
          email: string;
          phoneNumber: string | null;
          role: string;
        }
      | Array<{
          fullName: string;
          email: string;
          phoneNumber: string | null;
          role: string;
        }>;
    team: { name: string } | Array<{ name: string }>;
  } | null;

  if (!dispatcher) {
    throw new NotFoundError("Dispatcher not found.");
  }

  const user = unwrapRelation(dispatcher.user);
  const team = unwrapRelation(dispatcher.team);
  const carriers = (assertDb(carriersResult) ?? []) as Array<{
    id: string;
    carrierName: string;
    driverName: string;
    truckType: TruckType;
  }>;

  return {
    id: dispatcher.id,
    status: dispatcher.status,
    user: {
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
      phoneNumber: user?.phoneNumber ?? null,
      role: user?.role ?? "DISPATCHER",
    },
    team: { name: team?.name ?? "" },
    carriers,
  };
}

function buildAppliedFilters(
  filters: FinanceFilters,
  timezone: string,
): FinanceAppliedFilters {
  const { dateFrom, dateTo } = resolveFinanceDateRangeStrict(
    filters.dateRange,
    filters.dateFrom,
    filters.dateTo,
    timezone,
  );

  return {
    dateRange: filters.dateRange,
    dateFrom,
    dateTo,
    carrierId: filters.carrierId ?? null,
    status: filters.status ?? null,
  };
}

export async function getDispatcherFinanceBundle(
  scope: AccessScope,
  dispatcherId: string,
  rawFilters: FinanceFilters = { dateRange: "this-month" },
): Promise<DispatcherFinanceBundle> {
  if (!scope.isCompanyWide && scope.dispatcherId !== dispatcherId) {
    throw new NotFoundError("Dispatcher not found.");
  }

  const filters = financeFiltersSchema.parse(rawFilters);
  const preferences = await getOrganizationPreferences(scope.organizationId);
  const applied = buildAppliedFilters(filters, preferences.timezone);
  const dispatcher = await loadDispatcherProfile(
    scope.organizationId,
    dispatcherId,
  );

  const currentMonthRange = getMonthRange(0, preferences.timezone);
  const previousMonthRange = getMonthRange(-1, preferences.timezone);
  const monthlyTrendRange = getMonthlyTrendRange(preferences.timezone);

  const [
    filteredActivities,
    efficiencyActivities,
    currentMonthActivities,
    previousMonthActivities,
    monthlyTrendActivities,
  ] = await Promise.all([
    fetchActivitiesForDispatcher(
      scope.organizationId,
      dispatcherId,
      applied.dateFrom,
      applied.dateTo,
      filters,
    ),
    fetchActivitiesForDispatcher(
      scope.organizationId,
      dispatcherId,
      applied.dateFrom,
      applied.dateTo,
      { carrierId: filters.carrierId },
    ),
    fetchActivitiesForDispatcher(
      scope.organizationId,
      dispatcherId,
      currentMonthRange.dateFrom,
      currentMonthRange.dateTo,
      {},
    ),
    fetchActivitiesForDispatcher(
      scope.organizationId,
      dispatcherId,
      previousMonthRange.dateFrom,
      previousMonthRange.dateTo,
      {},
    ),
    fetchActivitiesForDispatcher(
      scope.organizationId,
      dispatcherId,
      monthlyTrendRange.dateFrom,
      monthlyTrendRange.dateTo,
      {},
    ),
  ]);

  const summary = buildSummary(
    filteredActivities,
    efficiencyActivities,
    currentMonthActivities,
    previousMonthActivities,
  );

  return {
    profile: {
      id: dispatcher.id,
      fullName: dispatcher.user.fullName,
      email: dispatcher.user.email,
      phoneNumber: dispatcher.user.phoneNumber ?? "",
      teamName: dispatcher.team.name,
      role: dispatcher.user.role.replaceAll("_", " "),
      status: dispatcher.status,
      assignedCarriersCount: dispatcher.carriers.length,
      assignedCarriers: dispatcher.carriers.map((carrier) => ({
        id: carrier.id,
        carrierName: carrier.carrierName,
        driverName: carrier.driverName,
        truckType: carrier.truckType,
      })),
    },
    filters: applied,
    filterOptions: {
      carriers: dispatcher.carriers.map((carrier) => ({
        id: carrier.id,
        name: carrier.carrierName,
      })),
      statuses: STATUSES.map((status) => ({
        value: status,
        label: LOAD_ACTIVITY_STATUS_LABELS[status],
      })),
    },
    summary,
    monthlyEarnings: buildMonthlyEarnings(
      monthlyTrendActivities,
      preferences.timezone,
    ),
    carrierBreakdown: buildCarrierBreakdown(filteredActivities),
    loadHistory: buildLoadHistory(filteredActivities),
    paymentTracking: {
      paidAmount: 0,
      pendingAmount: summary.totalDispatchFee,
      message:
        "Pending equals earned dispatch fees because no payments are recorded for this period.",
    },
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function exportDispatcherFinanceCsv(
  scope: AccessScope,
  actor: AuthContextUser,
  dispatcherId: string,
  rawFilters: FinanceFilters = { dateRange: "this-month" },
): Promise<{ csv: string; fileName: string }> {
  const bundle = await getDispatcherFinanceBundle(
    scope,
    dispatcherId,
    rawFilters,
  );
  const settingsResult = await db()
    .from(T.OrganizationSettings)
    .select("csvFileNamePrefix, csvIncludeHeaders, csvDateFormat")
    .eq("organizationId", scope.organizationId)
    .maybeSingle();

  const settings = settingsResult.data;
  const prefix = settings?.csvFileNamePrefix ?? "dpp-finance";
  const includeHeaders = settings?.csvIncludeHeaders ?? true;
  const csvDateFormat = settings?.csvDateFormat ?? "yyyy-MM-dd";

  const summaryRows = [
    ["Metric", "Value"],
    ["Total Revenue", bundle.summary.totalRevenue.toFixed(2)],
    ["Total Dispatch Fee", bundle.summary.totalDispatchFee.toFixed(2)],
    ["Delivered Loads", bundle.summary.deliveredLoads.toString()],
    ["Cancelled Loads", bundle.summary.cancelledLoads.toString()],
    ["Not Booked", bundle.summary.notBookedCount.toString()],
    ["Not Working", bundle.summary.notWorkingCount.toString()],
    [
      "Average Rate Per Mile",
      bundle.summary.averageRatePerMile?.toFixed(4) ?? "N/A",
    ],
    ["Booking Efficiency %", bundle.summary.bookingEfficiency.toFixed(1)],
  ];

  const carrierHeaders = [
    "Carrier Name",
    "Driver Name",
    "Truck Type",
    "Delivered Loads",
    "Total Load Amount",
    "Dispatch Fee Earned",
    "Average Rate Per Mile",
  ];

  const carrierRows = bundle.carrierBreakdown.map((row) => [
    row.carrierName,
    row.driverName,
    row.truckType,
    row.deliveredLoads.toString(),
    row.totalLoadAmount.toFixed(2),
    row.dispatchFeeEarned.toFixed(2),
    row.averageRatePerMile?.toFixed(4) ?? "N/A",
  ]);

  const loadHeaders = [
    "Date",
    "Carrier",
    "Origin",
    "Destination",
    "Miles",
    "Load Amount",
    "Rate Per Mile",
    "Dispatch Fee",
    "Status",
  ];

  const loadRows = bundle.loadHistory.map((row) => [
    formatDate(new Date(`${row.date}T12:00:00Z`), csvDateFormat),
    row.carrierName,
    row.origin ?? "",
    row.destination ?? "",
    row.miles?.toString() ?? "",
    row.loadAmount?.toFixed(2) ?? "",
    row.ratePerMile?.toFixed(4) ?? "",
    row.dispatchFee?.toFixed(2) ?? "",
    row.status,
  ]);

  const sections = [
    ["Finance Summary"],
    ...(includeHeaders ? summaryRows : summaryRows.slice(1)),
    [],
    ["Carrier Breakdown"],
    ...(includeHeaders ? [carrierHeaders, ...carrierRows] : carrierRows),
    [],
    ["Load History"],
    ...(includeHeaders ? [loadHeaders, ...loadRows] : loadRows),
  ];

  const csv = buildCsv(sections);
  const fileName = `${prefix}-dispatcher-${dispatcherId}-${bundle.filters.dateFrom}-to-${bundle.filters.dateTo}.csv`;

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "REPORT_EXPORTED",
    entityType: "ReportExport",
    entityId: dispatcherId,
    metadata: {
      reportType: "dispatcher-finance",
      rowCount: bundle.loadHistory.length,
    },
  });

  return { csv, fileName };
}
