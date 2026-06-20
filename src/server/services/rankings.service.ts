import "server-only";

import { DELIVERED } from "@/lib/constants/statuses";
import { db } from "@/lib/db/prisma";
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

function decimalToNumber(value: { toNumber(): number } | null | undefined): number {
  if (!value) {
    return 0;
  }

  return value.toNumber();
}

function computeActivityScore(delivered: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((delivered / total) * 100);
}

export async function getDispatcherRankings(
  scope: AccessScope,
): Promise<DispatcherRanking[]> {
  const dispatchers = await db.dispatcher.findMany({
    where: {
      organizationId: scope.organizationId,
      status: "ACTIVE",
      deletedAt: null,
      ...dispatcherScopeFilter(scope),
    },
    include: {
      user: { select: { fullName: true } },
      team: { select: { name: true } },
      _count: { select: { carriers: { where: { status: "ACTIVE", deletedAt: null } } } },
    },
  });

  return dispatchers
    .sort((a, b) => b._count.carriers - a._count.carriers)
    .map((dispatcher, index) => ({
      rank: index + 1,
      name: dispatcher.user.fullName,
      team: dispatcher.team.name,
      carriers: dispatcher._count.carriers,
    }));
}

export async function getCarrierRankings(scope: AccessScope): Promise<CarrierRanking[]> {
  const carriers = await db.carrier.findMany({
    where: {
      organizationId: scope.organizationId,
      deletedAt: null,
      ...carrierScopeFilter(scope),
    },
    include: {
      dispatcher: { include: { user: { select: { fullName: true } } } },
      dailyActivities: {
        where: {
          organizationId: scope.organizationId,
          ...activityScopeFilter(scope),
        },
        select: { status: true },
      },
    },
  });

  const ranked = carriers
    .map((carrier) => {
      const total = carrier.dailyActivities.length;
      const delivered = carrier.dailyActivities.filter(
        (activity) => activity.status === DELIVERED,
      ).length;

      return {
        carrierName: carrier.carrierName,
        dispatcherName: carrier.dispatcher?.user.fullName ?? "Unassigned",
        activityScore: computeActivityScore(delivered, total),
      };
    })
    .sort((a, b) => b.activityScore - a.activityScore);

  return ranked.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}

export async function getTeamRankings(scope: AccessScope): Promise<TeamRanking[]> {
  const teams = await db.team.findMany({
    where: {
      organizationId: scope.organizationId,
      deletedAt: null,
      status: "ACTIVE",
      ...teamScopeFilter(scope),
    },
    include: {
      teamLead: { select: { fullName: true } },
      dailyActivities: {
        where: {
          organizationId: scope.organizationId,
          ...activityScopeFilter(scope),
        },
        select: { status: true, loadAmount: true },
      },
    },
  });

  const ranked = teams
    .map((team) => {
      const revenue = team.dailyActivities
        .filter((activity) => activity.status === DELIVERED)
        .reduce((sum, activity) => sum + decimalToNumber(activity.loadAmount), 0);

      return {
        teamName: team.name,
        teamLeadName: team.teamLead?.fullName ?? "Unassigned",
        revenue: Math.round(revenue * 100) / 100,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return ranked.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}
