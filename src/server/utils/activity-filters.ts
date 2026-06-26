import "server-only";

import { z } from "zod";
import { STATUSES } from "@/lib/constants/statuses";
import {
  ACTIVITY_APPROVAL_STATUSES,
  APPROVED,
} from "@/lib/constants/activity-approval";
import { TRUCK_TYPES } from "@/lib/constants/truck-types";
import { isFilterAll, sanitizeFilterId } from "@/lib/constants/filters";
import { T, db } from "@/lib/db/client";
import { toDateOnly } from "@/lib/db/utils";
import type { AccessScope } from "@/server/auth/types";
import { activityScopeFilter } from "@/server/utils/scope-filters";
import { ForbiddenError } from "@/lib/errors/forbidden-error";
import { ValidationError } from "@/lib/errors/validation-error";
import { getDateKeyInTimeZone } from "@/lib/utils/resolve-date-range";
import { buildIlikeOr } from "@/server/utils/text-search";

export const activityFiltersSchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  activityId: z.string().optional(),
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
  approvalStatus: z.enum(ACTIVITY_APPROVAL_STATUSES).optional(),
  approvalStatuses: z.string().optional(),
});

export type ActivityFilters = z.infer<typeof activityFiltersSchema>;

import type { FilterableQuery } from "@/lib/db/query";

function parseCsvParam(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].filter((part) => !isFilterAll(part));
}

export function normalizeActivityFilters(filters: ActivityFilters) {
  const teamId = sanitizeFilterId(filters.teamId);
  const dispatcherId = sanitizeFilterId(filters.dispatcherId);
  const carrierId = sanitizeFilterId(filters.carrierId);
  const activityId = sanitizeFilterId(filters.activityId);
  const truckType = filters.truckType;

  const teamIds = [
    ...parseCsvParam(filters.teamIds),
    ...(teamId ? [teamId] : []),
  ];
  const dispatcherIds = [
    ...parseCsvParam(filters.dispatcherIds),
    ...(dispatcherId ? [dispatcherId] : []),
  ];
  const carrierIds = [
    ...parseCsvParam(filters.carrierIds),
    ...(carrierId ? [carrierId] : []),
  ];
  const truckTypes = [
    ...parseCsvParam(filters.truckTypes),
    ...(truckType ? [truckType] : []),
  ] as (typeof TRUCK_TYPES)[number][];
  const statuses = [
    ...parseCsvParam(filters.statuses),
    ...(filters.status ? [filters.status] : []),
  ] as (typeof STATUSES)[number][];

  return {
    ...filters,
    teamId,
    dispatcherId,
    carrierId,
    truckType,
    teamIds: [...new Set(teamIds)],
    dispatcherIds: [...new Set(dispatcherIds)],
    carrierIds: [...new Set(carrierIds)],
    activityId,
    truckTypes: [...new Set(truckTypes)],
    statuses: [...new Set(statuses)],
    statusKeys: parseCsvParam(filters.statusKeys),
    approvalStatuses: [
      ...parseCsvParam(filters.approvalStatuses),
      ...(filters.approvalStatus ? [filters.approvalStatus] : []),
    ] as (typeof ACTIVITY_APPROVAL_STATUSES)[number][],
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
  const teamId = sanitizeFilterId(filters.teamId);
  const dispatcherId = sanitizeFilterId(filters.dispatcherId);
  const carrierId = sanitizeFilterId(filters.carrierId);

  if (teamId && !scope.isCompanyWide && scope.teamId !== teamId) {
    throw new ForbiddenError("You cannot filter by another team.");
  }

  if (
    dispatcherId &&
    scope.role === "DISPATCHER" &&
    scope.dispatcherId !== dispatcherId
  ) {
    throw new ForbiddenError("You cannot filter by another dispatcher.");
  }

  if (scope.role === "TEAM_LEAD" && scope.teamId) {
    if (dispatcherId) {
      const dispatcherResult = await db()
        .from(T.Dispatcher)
        .select("id")
        .eq("id", dispatcherId)
        .eq("organizationId", scope.organizationId)
        .eq("teamId", scope.teamId)
        .is("deletedAt", null)
        .maybeSingle();

      if (dispatcherResult.error) {
        throw new Error(dispatcherResult.error.message);
      }

      if (!dispatcherResult.data) {
        throw new ForbiddenError("You cannot filter by that dispatcher.");
      }
    }

    if (carrierId) {
      const carrierResult = await db()
        .from(T.Carrier)
        .select("id")
        .eq("id", carrierId)
        .eq("organizationId", scope.organizationId)
        .eq("teamId", scope.teamId)
        .is("deletedAt", null)
        .maybeSingle();

      if (carrierResult.error) {
        throw new Error(carrierResult.error.message);
      }

      if (!carrierResult.data) {
        throw new ForbiddenError("You cannot filter by that carrier.");
      }
    }
  }
}

export function applyActivityFilters<T extends FilterableQuery>(
  query: T,
  scope: AccessScope,
  filters: ActivityFilters,
): T {
  const normalized = normalizeActivityFilters(filters);
  let scopedQuery = query.eq("organizationId", scope.organizationId);

  const scopeFilter = activityScopeFilter(scope);

  if ("dispatcherId" in scopeFilter && scopeFilter.dispatcherId) {
    scopedQuery = scopedQuery.eq("dispatcherId", scopeFilter.dispatcherId);
  } else if ("teamId" in scopeFilter && scopeFilter.teamId) {
    scopedQuery = scopedQuery.eq("teamId", scopeFilter.teamId);
  } else if ("id" in scopeFilter && scopeFilter.id) {
    scopedQuery = scopedQuery.eq("id", scopeFilter.id);
  }

  if (normalized.activityId) {
    return scopedQuery.eq("id", normalized.activityId) as T;
  }

  if (filters.dateFrom) {
    scopedQuery = scopedQuery.gte(
      "activityDate",
      toDateOnly(parseActivityDate(filters.dateFrom)),
    );
  }

  if (filters.dateTo) {
    scopedQuery = scopedQuery.lte(
      "activityDate",
      toDateOnly(parseActivityDate(filters.dateTo)),
    );
  }

  if (normalized.statuses.length === 1) {
    scopedQuery = scopedQuery.eq("status", normalized.statuses[0]);
  } else if (normalized.statuses.length > 1) {
    scopedQuery = scopedQuery.in("status", normalized.statuses);
  } else if (normalized.statusKeys.length > 0) {
    scopedQuery = scopedQuery.in("status", []);
  }

  if (normalized.teamIds.length === 1) {
    scopedQuery = scopedQuery.eq("teamId", normalized.teamIds[0]);
  } else if (normalized.teamIds.length > 1) {
    scopedQuery = scopedQuery.in("teamId", normalized.teamIds);
  }

  if (normalized.dispatcherIds.length === 1) {
    scopedQuery = scopedQuery.eq("dispatcherId", normalized.dispatcherIds[0]);
  } else if (normalized.dispatcherIds.length > 1) {
    scopedQuery = scopedQuery.in("dispatcherId", normalized.dispatcherIds);
  }

  if (normalized.carrierIds.length === 1) {
    scopedQuery = scopedQuery.eq("carrierId", normalized.carrierIds[0]);
  } else if (normalized.carrierIds.length > 1) {
    scopedQuery = scopedQuery.in("carrierId", normalized.carrierIds);
  }

  if (normalized.truckTypes.length === 1) {
    scopedQuery = scopedQuery.eq("truckTypeSnapshot", normalized.truckTypes[0]);
  } else if (normalized.truckTypes.length > 1) {
    scopedQuery = scopedQuery.in("truckTypeSnapshot", normalized.truckTypes);
  }

  if (normalized.q) {
    scopedQuery = scopedQuery.or(
      buildIlikeOr(
        [
          "carrierNameSnapshot",
          "driverNameSnapshot",
          "dispatcherNameSnapshot",
          "teamNameSnapshot",
          "origin",
          "destination",
          "reason",
          "notes",
        ],
        normalized.q,
      ),
    );
  }

  if (normalized.approvalStatuses.length === 1) {
    scopedQuery = scopedQuery.eq(
      "approvalStatus",
      normalized.approvalStatuses[0],
    );
  } else if (normalized.approvalStatuses.length > 1) {
    scopedQuery = scopedQuery.in(
      "approvalStatus",
      normalized.approvalStatuses,
    );
  }

  return scopedQuery as T;
}

export function resolveDashboardDateRange(
  filters: ActivityFilters,
  timezone?: string,
): {
  dateFrom: string;
  dateTo: string;
} {
  if (filters.dateFrom && filters.dateTo) {
    return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  }

  const todayKey = getDateKeyInTimeZone(new Date(), timezone ?? "UTC");
  const now = new Date(`${todayKey}T00:00:00Z`);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    dateFrom: formatActivityDate(start),
    dateTo: todayKey,
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

export function restrictToApprovedActivities<
  T extends { eq: (column: string, value: string) => T },
>(query: T): T {
  return query.eq("approvalStatus", APPROVED);
}
