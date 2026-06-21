import "server-only";

import { z } from "zod";
import type { LoadActivityStatus, Prisma } from "@/generated/prisma/client";
import { STATUSES } from "@/lib/constants/statuses";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import type { AccessScope } from "@/server/auth/types";
import { activityScopeFilter } from "@/server/utils/scope-filters";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";

export const activityFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  teamId: z.string().optional(),
  dispatcherId: z.string().optional(),
  carrierId: z.string().optional(),
  truckType: z.enum(TRUCK_TYPES).optional(),
});

export type ActivityFilters = z.infer<typeof activityFiltersSchema>;

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

export function assertFilterAccess(
  scope: AccessScope,
  filters: ActivityFilters,
): void {
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
}

export function buildActivityWhere(
  scope: AccessScope,
  filters: ActivityFilters,
): Prisma.DailyActivityWhereInput {
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
