import "server-only";

import { DELIVERED } from "@/lib/constants/statuses";
import { APPROVED } from "@/lib/constants/activity-approval";
import { sanitizeFilterId } from "@/lib/constants/filters";
import { T, db } from "@/lib/db/client";
import { applyScopeWhere, asFilterable } from "@/lib/db/query";
import { assertDb, decimalToNumber, unwrapRelation } from "@/lib/db/utils";
import type {
  CarrierRanking,
  DispatcherRanking,
  TeamRanking,
} from "@/lib/types";
import type { AccessScope } from "@/server/auth/types";
import {
  activityScopeFilter,
  carrierScopeFilter,
  dispatcherScopeFilter,
  teamScopeFilter,
} from "@/server/utils/scope-filters";

export type RankingFilters = {
  teamId?: string;
  dispatcherId?: string;
};

function buildScopedRankingFilters(
  scope: AccessScope,
  filters: RankingFilters = {},
): RankingFilters {
  const teamId = sanitizeFilterId(filters.teamId);
  const dispatcherId = sanitizeFilterId(filters.dispatcherId);

  if (scope.isCompanyWide) {
    return { teamId, dispatcherId };
  }

  if (scope.role === "DISPATCHER") {
    return {};
  }

  if (scope.teamId) {
    return { dispatcherId };
  }

  return {};
}

function computeActivityScore(delivered: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((delivered / total) * 100);
}

export async function getDispatcherRankings(
  scope: AccessScope,
  filters: RankingFilters = {},
): Promise<DispatcherRanking[]> {
  const scopedFilters = buildScopedRankingFilters(scope, filters);

  let dispatcherQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Dispatcher)
        .select(
          "id, user:User!Dispatcher_userId_fkey(fullName), team:Team!Dispatcher_teamId_fkey(name)",
        )
        .eq("organizationId", scope.organizationId)
        .eq("status", "ACTIVE")
        .is("deletedAt", null),
    ),
    dispatcherScopeFilter(scope),
  );

  if (scopedFilters.teamId) {
    dispatcherQuery = dispatcherQuery.eq(
      "teamId",
      scopedFilters.teamId,
    ) as typeof dispatcherQuery;
  }

  if (scopedFilters.dispatcherId) {
    dispatcherQuery = dispatcherQuery.eq(
      "id",
      scopedFilters.dispatcherId,
    ) as typeof dispatcherQuery;
  }

  const dispatchers = (assertDb(await dispatcherQuery) ?? []) as Array<{
    id: string;
    user: { fullName: string } | Array<{ fullName: string }>;
    team: { name: string } | Array<{ name: string }>;
  }>;
  const dispatcherIds = dispatchers.map((dispatcher) => dispatcher.id);
  const carrierCountByDispatcher = new Map<string, number>();

  if (dispatcherIds.length > 0) {
    const carriers = (assertDb(
      await db()
        .from(T.Carrier)
        .select("dispatcherId")
        .in("dispatcherId", dispatcherIds)
        .eq("status", "ACTIVE")
        .is("deletedAt", null),
    ) ?? []) as Array<{ dispatcherId: string | null }>;

    for (const carrier of carriers) {
      if (!carrier.dispatcherId) {
        continue;
      }

      carrierCountByDispatcher.set(
        carrier.dispatcherId,
        (carrierCountByDispatcher.get(carrier.dispatcherId) ?? 0) + 1,
      );
    }
  }

  return dispatchers
    .map((dispatcher) => ({
      id: dispatcher.id,
      name: unwrapRelation(dispatcher.user)?.fullName ?? "",
      team: unwrapRelation(dispatcher.team)?.name ?? "",
      carriers: carrierCountByDispatcher.get(dispatcher.id) ?? 0,
    }))
    .sort((a, b) => b.carriers - a.carriers)
    .map((dispatcher, index) => ({
      rank: index + 1,
      ...dispatcher,
    }));
}

export async function getCarrierRankings(
  scope: AccessScope,
  filters: RankingFilters = {},
): Promise<CarrierRanking[]> {
  const scopedFilters = buildScopedRankingFilters(scope, filters);

  let carrierQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Carrier)
        .select(
          "id, carrierName, dispatcher:Dispatcher!Carrier_dispatcherId_fkey(user:User!Dispatcher_userId_fkey(fullName))",
        )
        .eq("organizationId", scope.organizationId)
        .is("deletedAt", null),
    ),
    carrierScopeFilter(scope),
  );

  if (scopedFilters.teamId) {
    carrierQuery = carrierQuery.eq(
      "teamId",
      scopedFilters.teamId,
    ) as typeof carrierQuery;
  }

  if (scopedFilters.dispatcherId) {
    carrierQuery = carrierQuery.eq(
      "dispatcherId",
      scopedFilters.dispatcherId,
    ) as typeof carrierQuery;
  }

  const carriers = (assertDb(await carrierQuery) ?? []) as Array<{
    id: string;
    carrierName: string;
    dispatcher:
      | { user: { fullName: string } | Array<{ fullName: string }> }
      | Array<{ user: { fullName: string } | Array<{ fullName: string }> }>
      | null;
  }>;
  const carrierIds = carriers.map((carrier) => carrier.id);
  const activitiesByCarrier = new Map<string, Array<{ status: string }>>();

  if (carrierIds.length > 0) {
    const activityQuery = applyScopeWhere(
      asFilterable(
        db()
          .from(T.DailyActivity)
          .select("carrierId, status")
          .in("carrierId", carrierIds)
          .eq("organizationId", scope.organizationId)
          .eq("approvalStatus", APPROVED),
      ),
      activityScopeFilter(scope),
    );

    const activities = (assertDb(await activityQuery) ?? []) as Array<{
      carrierId: string;
      status: string;
    }>;

    for (const activity of activities) {
      const list = activitiesByCarrier.get(activity.carrierId) ?? [];
      list.push({ status: activity.status });
      activitiesByCarrier.set(activity.carrierId, list);
    }
  }

  const ranked = carriers
    .map((carrier) => {
      const dailyActivities = activitiesByCarrier.get(carrier.id) ?? [];
      const total = dailyActivities.length;
      const delivered = dailyActivities.filter(
        (activity) => activity.status === DELIVERED,
      ).length;

      const dispatcherUser = unwrapRelation(
        unwrapRelation(carrier.dispatcher)?.user,
      );

      return {
        carrierName: carrier.carrierName,
        dispatcherName: dispatcherUser?.fullName ?? "Unassigned",
        activityScore: computeActivityScore(delivered, total),
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore);

  return ranked.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}

export async function getTeamRankings(
  scope: AccessScope,
  filters: RankingFilters = {},
): Promise<TeamRanking[]> {
  const scopedFilters = buildScopedRankingFilters(scope, filters);

  let teamQuery = applyScopeWhere(
    asFilterable(
      db()
        .from(T.Team)
        .select("id, name, teamLead:User!Team_teamLeadUserId_fkey(fullName)")
        .eq("organizationId", scope.organizationId)
        .is("deletedAt", null)
        .eq("status", "ACTIVE"),
    ),
    teamScopeFilter(scope),
  );

  if (scopedFilters.teamId) {
    teamQuery = teamQuery.eq("id", scopedFilters.teamId) as typeof teamQuery;
  }

  const teams = (assertDb(await teamQuery) ?? []) as Array<{
    id: string;
    name: string;
    teamLead: { fullName: string } | Array<{ fullName: string }> | null;
  }>;
  const teamIds = teams.map((team) => team.id);
  const activitiesByTeam = new Map<
    string,
    Array<{ status: string; loadAmount: string | null }>
  >();

  if (teamIds.length > 0) {
    const activityQuery = applyScopeWhere(
      asFilterable(
        db()
          .from(T.DailyActivity)
          .select("teamId, status, loadAmount")
          .in("teamId", teamIds)
          .eq("organizationId", scope.organizationId)
          .eq("approvalStatus", APPROVED),
      ),
      activityScopeFilter(scope),
    );

    const activities = (assertDb(await activityQuery) ?? []) as Array<{
      teamId: string;
      status: string;
      loadAmount: string | null;
    }>;

    for (const activity of activities) {
      const list = activitiesByTeam.get(activity.teamId) ?? [];
      list.push({ status: activity.status, loadAmount: activity.loadAmount });
      activitiesByTeam.set(activity.teamId, list);
    }
  }

  const ranked = teams
    .map((team) => {
      const dailyActivities = activitiesByTeam.get(team.id) ?? [];
      const revenue = dailyActivities
        .filter((activity) => activity.status === DELIVERED)
        .reduce(
          (sum, activity) => sum + (decimalToNumber(activity.loadAmount) ?? 0),
          0,
        );

      return {
        teamName: team.name,
        teamLeadName: unwrapRelation(team.teamLead)?.fullName ?? "Unassigned",
        revenue: Math.round(revenue * 100) / 100,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return ranked.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}
