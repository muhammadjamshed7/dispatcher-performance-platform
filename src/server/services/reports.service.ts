import "server-only";

import { z } from "zod";
import type { DailyActivity, LoadActivityStatus, Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/lib/errors/validation-error";
import {
  CANCELLED,
  DELIVERED,
  NOT_BOOKED,
  NOT_WORKING,
  STATUSES,
} from "@/lib/constants/statuses";
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
import { db } from "@/lib/db/prisma";
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
import { assertFilterAccess } from "@/server/utils/activity-filters";
import { activityScopeFilter } from "@/server/utils/scope-filters";

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

function decimalToNumber(value: { toNumber(): number } | null | undefined): number {
  if (!value) {
    return 0;
  }

  return value.toNumber();
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);

  if (!year || !month || !day) {
    throw new ValidationError("Invalid date format. Use yyyy-MM-dd.");
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function resolveDateRange(
  period: ReportPeriod,
  filters: ReportFilters,
): { start: Date; end: Date } {
  if (filters.dateFrom && filters.dateTo) {
    return {
      start: parseDate(filters.dateFrom),
      end: parseDate(filters.dateTo),
    };
  }

  const today = startOfDay(new Date());

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
        start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
        end: today,
      };
    case HISTORICAL:
      return {
        start: new Date(Date.UTC(2000, 0, 1)),
        end: today,
      };
    case CUSTOM: {
      if (!filters.dateFrom || !filters.dateTo) {
        throw new ValidationError("Custom reports require dateFrom and dateTo.");
      }

      return {
        start: parseDate(filters.dateFrom),
        end: parseDate(filters.dateTo),
      };
    }
    default:
      throw new ValidationError("Unsupported report period.");
  }
}


function buildActivityWhere(
  scope: AccessScope,
  range: { start: Date; end: Date },
  filters: ReportFilters,
): Prisma.DailyActivityWhereInput {
  const where: Prisma.DailyActivityWhereInput = {
    organizationId: scope.organizationId,
    ...activityScopeFilter(scope),
    activityDate: {
      gte: range.start,
      lte: range.end,
    },
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.teamId) {
    where.teamId = filters.teamId;
  }

  if (filters.dispatcherId) {
    where.dispatcherId = filters.dispatcherId;
  }

  if (filters.carrierId) {
    where.carrierId = filters.carrierId;
  }

  if (filters.truckType) {
    where.truckTypeSnapshot = filters.truckType;
  }

  return where;
}

function countByStatus(activities: DailyActivity[], status: LoadActivityStatus): number {
  return activities.filter((activity) => activity.status === status).length;
}

function averageRatePerMile(activities: DailyActivity[]): number | null {
  const rates = activities
    .filter((activity) => activity.status === DELIVERED)
    .map((activity) => decimalToNumber(activity.ratePerMile))
    .filter((value) => value > 0);

  if (rates.length === 0) {
    return null;
  }

  const average = rates.reduce((sum, value) => sum + value, 0) / rates.length;
  return Math.round(average * 100) / 100;
}

function buildSummary(activities: DailyActivity[], activeCarriers: number): ReportSummary {
  const delivered = activities.filter((activity) => activity.status === DELIVERED);

  return {
    revenue: Math.round(
      delivered.reduce((sum, activity) => sum + decimalToNumber(activity.loadAmount), 0) * 100,
    ) / 100,
    dispatchFees: Math.round(
      delivered.reduce((sum, activity) => sum + decimalToNumber(activity.dispatchFee), 0) * 100,
    ) / 100,
    deliveredLoads: delivered.length,
    cancelledLoads: countByStatus(activities, CANCELLED),
    activeCarriers,
  };
}

function buildDispatcherRows(activities: DailyActivity[]): DispatcherReportRow[] {
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
        .reduce((sum, activity) => sum + decimalToNumber(activity.loadAmount), 0);
      const dispatchFees = group.activities
        .filter((activity) => activity.status === DELIVERED)
        .reduce((sum, activity) => sum + decimalToNumber(activity.dispatchFee), 0);
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
        .reduce((sum, activity) => sum + decimalToNumber(activity.loadAmount), 0);
      const dispatchFees = group.activities
        .filter((activity) => activity.status === DELIVERED)
        .reduce((sum, activity) => sum + decimalToNumber(activity.dispatchFee), 0);

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
      .reduce((sum, activity) => sum + decimalToNumber(activity.loadAmount), 0);
    const dispatchFees = group.activities
      .filter((activity) => activity.status === DELIVERED)
      .reduce((sum, activity) => sum + decimalToNumber(activity.dispatchFee), 0);

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
      cancellationRate: total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
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

  const range = resolveDateRange(parsedPeriod, parsedFilters);

  return db.dailyActivity.findMany({
    where: buildActivityWhere(scope, range, parsedFilters),
    orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getReportBundle(
  scope: AccessScope,
  period: ReportPeriod,
  filters: ReportFilters = {},
): Promise<ReportBundle> {
  const activities = await loadReportActivities(scope, period, filters);
  const carrierIds = new Set(activities.map((activity) => activity.carrierId));

  const teamIds = [...new Set(activities.map((activity) => activity.teamId))];
  const teams = teamIds.length
    ? await db.team.findMany({
        where: { id: { in: teamIds }, organizationId: scope.organizationId },
        include: { teamLead: { select: { fullName: true } } },
      })
    : [];

  const teamLeadById = new Map<string, string>(
    teams.map((team) => [team.id, team.teamLead?.fullName ?? "Unassigned"]),
  );

  const mcNumbers = await db.carrier.findMany({
    where: { id: { in: [...carrierIds] }, organizationId: scope.organizationId },
    select: { id: true, mcNumber: true },
  });
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

export async function exportReportCsv(
  scope: AccessScope,
  actor: AuthContextUser,
  period: ReportPeriod,
  filters: ReportFilters = {},
): Promise<{ csv: string; exportId: string; fileName: string }> {
  const parsedPeriod = z.enum(REPORT_PERIODS).parse(period);
  const parsedFilters = reportFiltersSchema.parse(filters);

  const settings = await db.organizationSettings.findUnique({
    where: { organizationId: scope.organizationId },
  });

  const bundle = await getReportBundle(scope, parsedPeriod, parsedFilters);
  const maxRows = settings?.csvMaxRows ?? 10000;
  const includeHeaders = settings?.csvIncludeHeaders ?? true;
  const prefix = settings?.csvFileNamePrefix ?? "dpp-report";

  if (bundle.daily.length > maxRows) {
    throw new ValidationError(`Export exceeds maximum row limit of ${maxRows}.`);
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
    const mapped = row as typeof row & { driverName?: string; totalMiles?: number | null };

    return [
      mapped.date,
      mapped.carrierName,
      mapped.driverName ?? "",
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

  const reportExport = await db.reportExport.create({
    data: {
      organizationId: scope.organizationId,
      requestedById: actor.id,
      reportType: "daily-activities",
      period: parsedPeriod,
      filters: parsedFilters,
      status: "COMPLETED",
      fileName,
      rowCount: bundle.daily.length,
      completedAt: new Date(),
    },
  });

  await writeAuditLog({
    organizationId: scope.organizationId,
    actorUserId: actor.id,
    action: "REPORT_EXPORTED",
    entityType: "ReportExport",
    entityId: reportExport.id,
    metadata: { period: parsedPeriod, rowCount: bundle.daily.length },
  });

  return {
    csv,
    exportId: reportExport.id,
    fileName,
  };
}
