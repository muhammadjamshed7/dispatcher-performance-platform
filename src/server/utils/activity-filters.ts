import "server-only";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import type { AccessScope } from "@/server/auth/types";
import { activityScopeFilter } from "@/server/utils/scope-filters";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { db } from "@/lib/db/prisma";

export const activityFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  statuses: z.string().optional(),
  teamId: z.string().optional(),
  teamIds: z.string().optional(),
  dispatcherId: z.string().optional(),
  dispatcherIds: z.string().optional(),
  carrierId: z.string().optional(),
  carrierIds: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
  truckTypes: z.string().optional(),
  statusKeys: z.string().optional(),
});

export type ActivityFilters = z.infer<typeof activityFiltersSchema>;

function parseCsvParam(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function normalizeActivityFilters(filters: ActivityFilters) {
  const teamIds = [
    ...parseCsvParam(filters.teamIds),
    ...(filters.teamId ? [filters.teamId] : []),
  ];
  const dispatcherIds = [
    ...parseCsvParam(filters.dispatcherIds),
    ...(filters.dispatcherId ? [filters.dispatcherId] : []),
  ];
  const carrierIds = [
    ...parseCsvParam(filters.carrierIds),
    ...(filters.carrierId ? [filters.carrierId] : []),
  ];
  const truckTypes = [
    ...parseCsvParam(filters.truckTypes),
    ...(filters.truckType ? [filters.truckType] : []),
  ] as typeof TRUCK_TYPES[number][];
  const statuses = [
    ...parseCsvParam(filters.statuses),
    ...(filters.status ? [filters.status] : []),
  ] as typeof STATUSES[number][];

  return {
    ...filters,
    teamIds: [...new Set(teamIds)],
    dispatcherIds: [...new Set(dispatcherIds)],
    carrierIds: [...new Set(carrierIds)],
    truckTypes: [...new Set(truckTypes)],
    statuses: [...new Set(statuses)],
    statusKeys: parseCsvParam(filters.statusKeys),
  };
}

export function parseActivityDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);

  if (!year || !month || !day) {
    throw new ValidationError("Invalid activity date.");
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function formatActivityDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Last N days ending at dateTo, clamped to dateFrom (for dashboard trend charts). */
export function buildTrendDateKeys(
  dateFrom: string,
  dateTo: string,
  dayCount = 7,
): string[] {
  const start = parseActivityDate(dateFrom);
  const end = parseActivityDate(dateTo);
  const dayMs = 24 * 60 * 60 * 1000;
  const windowStart = new Date(
    Math.max(start.getTime(), end.getTime() - (dayCount - 1) * dayMs),
  );
  const keys: string[] = [];

  for (
    let cursor = windowStart.getTime();
    cursor <= end.getTime();
    cursor += dayMs
  ) {
    keys.push(formatActivityDate(new Date(cursor)));
  }

  return keys;
}

export function formatTrendDateLabel(dateKey: string): string {
  return parseActivityDate(dateKey).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export async function assertFilterAccess(
  scope: AccessScope,
  filters: ActivityFilters,
): Promise<void> {
  if (filters.teamId && !scope.isCompanyWide && scope.teamId !== filters.teamId) {
    throw new ForbiddenError("You cannot filter by another team.");
  }

  if (
    filters.dispatcherId &&
    scope.role === "DISPATCHER" &&
    scope.dispatcherId !== filters.dispatcherId
  ) {
    throw new ForbiddenError("You cannot filter by another dispatcher.");
  }

  if (scope.role === "TEAM_LEAD" && scope.teamId) {
    if (filters.dispatcherId) {
      const dispatcher = await db.dispatcher.findFirst({
        where: {
          id: filters.dispatcherId,
          organizationId: scope.organizationId,
          teamId: scope.teamId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!dispatcher) {
        throw new ForbiddenError("You cannot filter by that dispatcher.");
      }
    }

    if (filters.carrierId) {
      const carrier = await db.carrier.findFirst({
        where: {
          id: filters.carrierId,
          organizationId: scope.organizationId,
          teamId: scope.teamId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!carrier) {
        throw new ForbiddenError("You cannot filter by that carrier.");
      }
    }
  }
}

export function buildActivityWhere(
  scope: AccessScope,
  filters: ActivityFilters,
): Prisma.DailyActivityWhereInput {
  const normalized = normalizeActivityFilters(filters);
  const where: Prisma.DailyActivityWhereInput = {
    organizationId: scope.organizationId,
    ...activityScopeFilter(scope),
  };

  if (filters.dateFrom || filters.dateTo) {
    where.activityDate = {};

    if (filters.dateFrom) {
      where.activityDate.gte = parseActivityDate(filters.dateFrom);
    }

    if (filters.dateTo) {
      where.activityDate.lte = parseActivityDate(filters.dateTo);
    }
  }

  if (normalized.statuses.length === 1) {
    where.status = normalized.statuses[0];
  } else if (normalized.statuses.length > 1) {
    where.status = { in: normalized.statuses };
  } else if (normalized.statusKeys.length > 0) {
    where.status = { in: [] };
  }

  if (normalized.teamIds.length === 1) {
    where.teamId = normalized.teamIds[0];
  } else if (normalized.teamIds.length > 1) {
    where.teamId = { in: normalized.teamIds };
  }

  if (normalized.dispatcherIds.length === 1) {
    where.dispatcherId = normalized.dispatcherIds[0];
  } else if (normalized.dispatcherIds.length > 1) {
    where.dispatcherId = { in: normalized.dispatcherIds };
  }

  if (normalized.carrierIds.length === 1) {
    where.carrierId = normalized.carrierIds[0];
  } else if (normalized.carrierIds.length > 1) {
    where.carrierId = { in: normalized.carrierIds };
  }

  if (normalized.truckTypes.length === 1) {
    where.truckTypeSnapshot = normalized.truckTypes[0];
  } else if (normalized.truckTypes.length > 1) {
    where.truckTypeSnapshot = { in: normalized.truckTypes };
  }

  return where;
}

export function resolveDashboardDateRange(filters: ActivityFilters): {
  dateFrom: string;
  dateTo: string;
} {
  if (filters.dateFrom && filters.dateTo) {
    return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return {
    dateFrom: formatActivityDate(start),
    dateTo: formatActivityDate(end),
  };
}

export function previousPeriodRange(
  dateFrom: string,
  dateTo: string,
): { dateFrom: string; dateTo: string } {
  const from = parseActivityDate(dateFrom);
  const to = parseActivityDate(dateTo);
  const dayMs = 24 * 60 * 60 * 1000;
  const spanDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / dayMs) + 1,
  );
  const prevTo = new Date(from.getTime() - dayMs);
  const prevFrom = new Date(prevTo.getTime() - (spanDays - 1) * dayMs);

  return {
    dateFrom: formatActivityDate(prevFrom),
    dateTo: formatActivityDate(prevTo),
  };
}
