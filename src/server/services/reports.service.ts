import "server-only";

import { z } from "zod";
import { format as formatDate } from "date-fns";
import type { DailyActivity, LoadActivityStatus } from "@/lib/db/types";
import { ValidationError } from "@/lib/errors/validation-error";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";
import { buildCsv } from "@/lib/utils/csv";
import { computeAverageRatePerMile } from "@/lib/utils/compute-finance-metrics";
import { sanitizeFilterId } from "@/lib/constants/filters";
import { APPROVED } from "@/lib/constants/activity-approval";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import {
  CUSTOM,
  DAILY,
  HISTORICAL,
  MONTHLY,
  REPORT_PERIODS,
  WEEKLY,
  type ReportPeriod,
} from "@/lib/constants/report-periods";
import { T, db } from "@/lib/db/client";
import { applyScopeWhere, asFilterable, type FilterableQuery } from "@/lib/db/query";
import {
  assertDb,
  assertDbVoid,
  createId,
  decimalToNumber,
  nowIso,
} from "@/lib/db/utils";
import type {
  CarrierReportRow,
  DispatcherReportRow,
  ReportBundle,
  ReportSummary,
  TeamReportRow,
} from "@/lib/types";
import type { AccessScope, AuthContextUser } from "@/server/auth/types";
import { mapDailyActivity } from "@/server/mappers";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  assertFilterAccess,
  formatActivityDate,
} from "@/server/utils/activity-filters";
import { activityScopeFilter } from "@/server/utils/scope-filters";
import { getOrganizationPreferences } from "@/server/services/settings.service";
import { getDateKeyInTimeZone } from "@/lib/utils/resolve-date-range";

const reportFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
});

type ReportFilters = z.infer<typeof reportFiltersSchema>;

function toAmount(value: string | null | undefined): number {
  return decimalToNumber(value) ?? 0;
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);

  if (!year || !month || !day) {
    throw new ValidationError("Invalid date format. Use yyyy-MM-dd.");
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  // Reject calendar-invalid dates (e.g. 2026-02-31) which Date.UTC would
  // otherwise silently roll over into the following month.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError("Invalid date format. Use yyyy-MM-dd.");
  }

  return date;
}

function resolveDateRange(
  period: ReportPeriod,
  filters: ReportFilters,
  timezone: string,
): { start: Date; end: Date } {
  const today = parseDate(getDateKeyInTimeZone(new Date(), timezone));

  switch (period) {
    case DAILY:
      return { start: today, end: today };
    case WEEKLY: {
      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() - 6);
      return { start, end: today };
    }
    case MONTHLY:
      return {
        start: new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
        ),
        end: today,
      };
    case HISTORICAL:
      return {
        start: new Date(Date.UTC(2000, 0, 1)),
        end: today,
      };
    case CUSTOM: {
      if (!filters.dateFrom || !filters.dateTo) {
        throw new ValidationError(
          "Custom reports require dateFrom and dateTo.",
        );
      }

      const range = {
        start: parseDate(filters.dateFrom),
        end: parseDate(filters.dateTo),
      };

      if (range.start > range.end) {
        throw new ValidationError(
          "Report start date cannot be after end date.",
        );
      }

      return range;
    }
    default:
      throw new ValidationError("Unsupported report period.");
  }
}

function applyReportActivityFilters<T extends FilterableQuery>(
  query: T,
  scope: AccessScope,
  range: { start: Date; end: Date },
  filters: ReportFilters,
): T {
  let q: FilterableQuery = query
    .eq("organizationId", scope.organizationId)
    .eq("approvalStatus", APPROVED)
    .gte("activityDate", formatActivityDate(range.start))
    .lte("activityDate", formatActivityDate(range.end));

  q = applyScopeWhere(q, activityScopeFilter(scope));

  if (filters.status) {
    q = q.eq("status", filters.status);
  }

  const teamId = sanitizeFilterId(filters.teamId);
  const dispatcherId = sanitizeFilterId(filters.dispatcherId);
  const carrierId = sanitizeFilterId(filters.carrierId);

  if (teamId) {
    q = q.eq("teamId", teamId);
  }

  if (dispatcherId) {
    q = q.eq("dispatcherId", dispatcherId);
  }

  if (carrierId) {
    q = q.eq("carrierId", carrierId);
  }

  if (filters.truckType) {
    q = q.eq("truckTypeSnapshot", filters.truckType);
  }

  return q as T;
}

function countByStatus(
  activities: DailyActivity[],
  status: LoadActivityStatus,
): number {
  return activities.filter((activity) => activity.status === status).length;
}

function averageRatePerMile(activities: DailyActivity[]): number | null {
  return computeAverageRatePerMile(
    activities.map((activity) => ({
      status: activity.status,
      loadAmount: toAmount(activity.loadAmount),
      totalMiles: toAmount(activity.totalMiles),
    })),
  );
}

function buildSummary(
  activities: DailyActivity[],
  activeCarriers: number,
): ReportSummary {
  const delivered = activities.filter(
    (activity) => activity.status === DELIVERED,
  );

  return {
    revenue:
      Math.round(
        delivered.reduce(
          (sum, activity) => sum + toAmount(activity.loadAmount),
          0,
        ) * 100,
      ) / 100,
    dispatchFees:
      Math.round(
        delivered.reduce(
          (sum, activity) => sum + toAmount(activity.dispatchFee),
          0,
        ) * 100,
      ) / 100,
    deliveredLoads: delivered.length,
    cancelledLoads: countByStatus(activities, CANCELLED),
    activeCarriers,
  };
}

function buildDispatcherRows(
  activities: DailyActivity[],
): DispatcherReportRow[] {
  const grouped = new Map<
    string,
    {
      dispatcherName: string;
      teamName: string;
      activities: DailyActivity[];
    }
  >();

  for (const activity of activities) {
    const existing = grouped.get(activity.dispatcherId) ?? {
      dispatcherName: activity.dispatcherNameSnapshot,
      teamName: activity.teamNameSnapshot,
      activities: [],
    };

    existing.activities.push(activity);
    grouped.set(activity.dispatcherId, existing);
  }

  return [...grouped.entries()]
    .map(([id, group]) => {
      const delivered = countByStatus(group.activities, DELIVERED);
      const cancelled = countByStatus(group.activities, CANCELLED);
      const notBooked = countByStatus(group.activities, NOT_BOOKED);
      const notWorking = countByStatus(group.activities, NOT_WORKING);
      const total = group.activities.length;
      const revenue = group.activities
        .filter((activity) => activity.status === DELIVERED)
        .reduce((sum, activity) => sum + toAmount(activity.loadAmount), 0);
      const dispatchFees = group.activities
        .filter((activity) => activity.status === DELIVERED)
        .reduce((sum, activity) => sum + toAmount(activity.dispatchFee), 0);
      const actionable = delivered + cancelled + notBooked;

      return {
        id,
        dispatcherName: group.dispatcherName,
        teamName: group.teamName,
        deliveredLoads: delivered,
        cancelledLoads: cancelled,
        notBookedCount: notBooked,
        notWorkingCount: notWorking,
        revenue: Math.round(revenue * 100) / 100,
        dispatchFees: Math.round(dispatchFees * 100) / 100,
        averageRatePerMile: averageRatePerMile(group.activities),
        cancellationRate:
          total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
        bookingEfficiency:
          actionable > 0 ? Math.round((delivered / actionable) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function buildCarrierRows(activities: DailyActivity[]): CarrierReportRow[] {
  const grouped = new Map<
    string,
    {
      carrierName: string;
      driverName: string;
      mcNumber: string;
      dispatcherName: string;
      teamName: string;
      truckType: DailyActivity["truckTypeSnapshot"];
      activities: DailyActivity[];
    }
  >();

  for (const activity of activities) {
    const existing = grouped.get(activity.carrierId) ?? {
      carrierName: activity.carrierNameSnapshot,
      driverName: activity.driverNameSnapshot,
      mcNumber: "",
      dispatcherName: activity.dispatcherNameSnapshot,
      teamName: activity.teamNameSnapshot,
      truckType: activity.truckTypeSnapshot,
      activities: [],
    };

    existing.activities.push(activity);
    grouped.set(activity.carrierId, existing);
  }

  return [...grouped.entries()]
    .map(([id, group]) => {
      const delivered = countByStatus(group.activities, DELIVERED);
      const total = group.activities.length;
      const revenue = group.activities
        .filter((activity) => activity.status === DELIVERED)
        .reduce((sum, activity) => sum + toAmount(activity.loadAmount), 0);
      const dispatchFees = group.activities
        .filter((activity) => activity.status === DELIVERED)
        .reduce((sum, activity) => sum + toAmount(activity.dispatchFee), 0);

      return {
        id,
        carrierName: group.carrierName,
        driverName: group.driverName,
        mcNumber: group.mcNumber,
        dispatcherName: group.dispatcherName,
        teamName: group.teamName,
        truckType: group.truckType,
        deliveredLoads: delivered,
        cancelledLoads: countByStatus(group.activities, CANCELLED),
        notBookedCount: countByStatus(group.activities, NOT_BOOKED),
        notWorkingCount: countByStatus(group.activities, NOT_WORKING),
        revenue: Math.round(revenue * 100) / 100,
        dispatchFees: Math.round(dispatchFees * 100) / 100,
        averageRatePerMile: averageRatePerMile(group.activities),
        activityScore: total > 0 ? Math.round((delivered / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore);
}

function buildTeamRows(activities: DailyActivity[]): TeamReportRow[] {
  const grouped = new Map<
    string,
    {
      teamName: string;
      teamLeadName: string;
      dispatcherIds: Set<string>;
      carrierIds: Set<string>;
      activities: DailyActivity[];
    }
  >();

  for (const activity of activities) {
    const existing = grouped.get(activity.teamId) ?? {
      teamName: activity.teamNameSnapshot,
      teamLeadName: "Unassigned",
      dispatcherIds: new Set<string>(),
      carrierIds: new Set<string>(),
      activities: [],
    };

    existing.dispatcherIds.add(activity.dispatcherId);
    existing.carrierIds.add(activity.carrierId);
    existing.activities.push(activity);
    grouped.set(activity.teamId, existing);
  }

  const rows = [...grouped.entries()].map(([id, group]) => {
    const delivered = countByStatus(group.activities, DELIVERED);
    const cancelled = countByStatus(group.activities, CANCELLED);
    const total = group.activities.length;
    const revenue = group.activities
      .filter((activity) => activity.status === DELIVERED)
      .reduce((sum, activity) => sum + toAmount(activity.loadAmount), 0);
    const dispatchFees = group.activities
      .filter((activity) => activity.status === DELIVERED)
      .reduce((sum, activity) => sum + toAmount(activity.dispatchFee), 0);

    return {
      id,
      teamName: group.teamName,
      teamLeadName: group.teamLeadName,
      dispatchers: group.dispatcherIds.size,
      activeCarriers: group.carrierIds.size,
      deliveredLoads: delivered,
      cancelledLoads: cancelled,
      revenue: Math.round(revenue * 100) / 100,
      dispatchFees: Math.round(dispatchFees * 100) / 100,
      averageRatePerMile: averageRatePerMile(group.activities),
      cancellationRate:
        total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
      teamRank: 0,
    };
  });

  return rows
    .sort((a, b) => b.revenue - a.revenue)
    .map((row, index) => ({ ...row, teamRank: index + 1 }));
}

async function loadReportActivities(
  scope: AccessScope,
  period: ReportPeriod,
  filters: ReportFilters,
): Promise<DailyActivity[]> {
  const parsedPeriod = z.enum(REPORT_PERIODS).parse(period);
  const parsedFilters = reportFiltersSchema.parse(filters);
  await assertFilterAccess(scope, parsedFilters);
  const preferences = await getOrganizationPreferences(scope.organizationId);

  const range = resolveDateRange(
    parsedPeriod,
    parsedFilters,
    preferences.timezone,
  );

  const query = applyReportActivityFilters(
    asFilterable(
      db()
        .from(T.DailyActivity)
        .select("*")
        .order("activityDate", { ascending: false })
        .order("createdAt", { ascending: false }),
    ),
    scope,
    range,
    parsedFilters,
  );

  return (assertDb(await query) ?? []) as DailyActivity[];
}

export async function getReportBundle(
  scope: AccessScope,
  period: ReportPeriod,
  filters: ReportFilters = {},
): Promise<ReportBundle> {
  const activities = await loadReportActivities(scope, period, filters);
  const carrierIds = new Set(activities.map((activity) => activity.carrierId));

  const teamIds = [...new Set(activities.map((activity) => activity.teamId))];
  const teams =
    teamIds.length > 0
      ? ((assertDb(
          await db()
            .from(T.Team)
            .select("id, teamLead:User!Team_teamLeadUserId_fkey(fullName)")
            .in("id", teamIds)
            .eq("organizationId", scope.organizationId),
        ) ?? []) as Array<{
          id: string;
          teamLead: { fullName: string } | Array<{ fullName: string }> | null;
        }>)
      : [];

  const teamLeadById = new Map<string, string>(
    teams.map((team) => [
      team.id,
      unwrapRelation(team.teamLead)?.fullName ?? "Unassigned",
    ]),
  );

  const carrierIdList = [...carrierIds];
  const mcNumbers =
    carrierIdList.length > 0
      ? ((assertDb(
          await db()
            .from(T.Carrier)
            .select("id, mcNumber")
            .in("id", carrierIdList)
            .eq("organizationId", scope.organizationId),
        ) ?? []) as Array<{ id: string; mcNumber: string }>)
      : [];

  const mcByCarrierId = new Map<string, string>(
    mcNumbers.map((carrier) => [carrier.id, carrier.mcNumber]),
  );

  const enrichedCarrierRows = buildCarrierRows(activities).map((row) => ({
    ...row,
    mcNumber: mcByCarrierId.get(row.id) ?? "",
  }));

  const teamRows = buildTeamRows(activities).map((row) => ({
    ...row,
    teamLeadName: teamLeadById.get(row.id) ?? row.teamLeadName,
  }));

  return {
    summary: buildSummary(activities, carrierIds.size),
    daily: activities.map(mapDailyActivity),
    dispatchers: buildDispatcherRows(activities),
    carriers: enrichedCarrierRows,
    teams: teamRows,
  };
}

export async function exportReportCsv(
  scope: AccessScope,
  actor: AuthContextUser,
  period: ReportPeriod,
  filters: ReportFilters = {},
): Promise<{ csv: string; exportId: string; fileName: string }> {
  const parsedPeriod = z.enum(REPORT_PERIODS).parse(period);
  const parsedFilters = reportFiltersSchema.parse(filters);

  const settingsResult = await db()
    .from(T.OrganizationSettings)
    .select("csvMaxRows, csvIncludeHeaders, csvFileNamePrefix, csvDateFormat")
    .eq("organizationId", scope.organizationId)
    .maybeSingle();

  const settings = settingsResult.data;

  const bundle = await getReportBundle(scope, parsedPeriod, parsedFilters);
  const maxRows = settings?.csvMaxRows ?? 10000;
  const includeHeaders = settings?.csvIncludeHeaders ?? true;
  const prefix = settings?.csvFileNamePrefix ?? "dpp-report";
  const csvDateFormat = settings?.csvDateFormat ?? "yyyy-MM-dd";

  if (bundle.daily.length > maxRows) {
    throw new ValidationError(
      `Export exceeds maximum row limit of ${maxRows}.`,
    );
  }

  const headers = [
    "Date",
    "Carrier",
    "Driver",
    "Dispatcher",
    "Team",
    "Truck Type",
    "Status",
    "Origin",
    "Destination",
    "Miles",
    "Load Amount",
    "Rate Per Mile",
    "Dispatch Fee",
    "Reason",
    "Notes",
  ];

  const dataRows = bundle.daily.map((row) => {
    const mapped = row as typeof row & {
      totalMiles?: number | null;
    };

    return [
      formatDate(new Date(`${mapped.date}T12:00:00Z`), csvDateFormat),
      mapped.carrierName,
      mapped.driverName,
      mapped.dispatcherName,
      mapped.teamName,
      mapped.truckType,
      mapped.status,
      mapped.origin ?? "",
      mapped.destination ?? "",
      mapped.totalMiles?.toString() ?? mapped.miles?.toString() ?? "",
      mapped.loadAmount?.toString() ?? "",
      mapped.ratePerMile?.toString() ?? "",
      mapped.dispatchFee?.toString() ?? "",
      mapped.reason ?? "",
      mapped.notes ?? "",
    ];
  });

  const csv = buildCsv(includeHeaders ? [headers, ...dataRows] : dataRows);
  const fileName = `${prefix}-${parsedPeriod.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;

  const exportId = createId();
  const completedAt = nowIso();

  assertDbVoid(
    await db().from(T.ReportExport).insert({
      id: exportId,
      organizationId: scope.organizationId,
      requestedById: actor.id,
      reportType: "daily-activities",
      period: parsedPeriod,
      filters: parsedFilters,
      status: "COMPLETED",
      fileName,
      rowCount: bundle.daily.length,
      completedAt,
      createdAt: nowIso(),
      errorMessage: null,
    }),
  );

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "REPORT_EXPORTED",
    entityType: "ReportExport",
    entityId: exportId,
    metadata: { period: parsedPeriod, rowCount: bundle.daily.length },
  });

  return {
    csv,
    exportId,
    fileName,
  };
}
