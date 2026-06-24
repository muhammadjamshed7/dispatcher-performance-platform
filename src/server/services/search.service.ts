import "server-only";

import type { AccessScope } from "@/server/auth/types";
import {
  activityScopeFilter,
  carrierScopeFilter,
  dispatcherScopeFilter,
} from "@/server/utils/scope-filters";
import { T, db } from "@/lib/db/client";
import { applyScopeWhere, asFilterable } from "@/lib/db/query";
import { assertDb, toDateOnly } from "@/lib/db/utils";
import { buildIlikeOr } from "@/server/utils/text-search";

import type { SearchResults } from "@/lib/types";

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function roleActivitiesPath(role: AccessScope["role"]): string {
  if (role === "ADMIN") {
    return "/admin/activities";
  }

  if (role === "TEAM_LEAD") {
    return "/team-lead/activities";
  }

  return "/dispatcher/activities";
}

function roleCarriersPath(role: AccessScope["role"]): string {
  if (role === "ADMIN") {
    return "/admin/carriers";
  }

  if (role === "TEAM_LEAD") {
    return "/team-lead/carriers";
  }

  return "/dispatcher/carriers";
}

function roleDispatchersPath(role: AccessScope["role"]): string {
  if (role === "ADMIN") {
    return "/admin/dispatchers";
  }

  return "/team-lead/dispatchers";
}

async function searchCarriers(scope: AccessScope, query: string) {
  let carrierQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Carrier)
        .select("id, carrierName")
        .eq("organizationId", scope.organizationId)
        .is("deletedAt", null)
        .or(buildIlikeOr(["carrierName", "driverName", "mcNumber"], query))
        .order("carrierName", { ascending: true })
        .limit(8),
    ),
    carrierScopeFilter(scope),
  );

  return (assertDb(await carrierQuery) ?? []) as Array<{
    id: string;
    carrierName: string;
  }>;
}

async function searchDispatchers(scope: AccessScope, query: string) {
  let dispatcherQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Dispatcher)
        .select("id, user:User!Dispatcher_userId_fkey!inner(fullName)")
        .eq("organizationId", scope.organizationId)
        .is("deletedAt", null)
        .or(buildIlikeOr(["fullName", "email"], query), {
          referencedTable: "user",
        })
        .limit(8),
    ),
    dispatcherScopeFilter(scope),
  );

  const rows = (assertDb(await dispatcherQuery) ?? []) as Array<{
    id: string;
    user: { fullName: string } | Array<{ fullName: string }>;
  }>;

  return rows
    .map((row) => ({
      id: row.id,
      user: { fullName: unwrapRelation(row.user)?.fullName ?? "" },
    }))
    .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName))
    .slice(0, 8);
}

async function searchActivities(scope: AccessScope, query: string) {
  const activityQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.DailyActivity)
        .select("id, carrierNameSnapshot, activityDate, createdAt")
        .eq("organizationId", scope.organizationId)
        .or(
          buildIlikeOr(
            [
              "carrierNameSnapshot",
              "dispatcherNameSnapshot",
              "teamNameSnapshot",
              "origin",
              "destination",
            ],
            query,
          ),
        )
        .order("activityDate", { ascending: false })
        .order("createdAt", { ascending: false })
        .limit(8),
    ),
    activityScopeFilter(scope),
  );

  return (assertDb(await activityQuery) ?? []) as Array<{
    id: string;
    carrierNameSnapshot: string;
    activityDate: string;
    createdAt: string;
  }>;
}

export async function searchOrganization(
  scope: AccessScope,
  rawQuery: string,
): Promise<SearchResults> {
  const query = rawQuery.trim();

  if (query.length < 2) {
    return { carriers: [], dispatchers: [], activities: [] };
  }

  const [carriers, dispatchers, activities] = await Promise.all([
    searchCarriers(scope, query),
    scope.isCompanyWide || scope.role === "TEAM_LEAD"
      ? searchDispatchers(scope, query)
      : Promise.resolve([]),
    searchActivities(scope, query),
  ]);

  const carriersPath = roleCarriersPath(scope.role);
  const dispatchersPath = roleDispatchersPath(scope.role);
  const activitiesPath = roleActivitiesPath(scope.role);

  return {
    carriers: carriers.map((carrier) => ({
      id: carrier.id,
      label: carrier.carrierName,
      href: `${carriersPath}?${new URLSearchParams({
        q: carrier.carrierName,
      }).toString()}`,
    })),
    dispatchers: dispatchers.map((dispatcher) => ({
      id: dispatcher.id,
      label: dispatcher.user.fullName,
      href: `${dispatchersPath}?${new URLSearchParams({
        q: dispatcher.user.fullName,
      }).toString()}`,
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      label: `${activity.carrierNameSnapshot} (${toDateOnly(activity.activityDate)})`,
      href: `${activitiesPath}?${new URLSearchParams({
        activityId: activity.id,
      }).toString()}`,
    })),
  };
}
