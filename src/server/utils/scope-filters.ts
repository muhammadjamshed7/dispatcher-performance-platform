import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AccessScope } from "@/server/auth/types";

export function teamScopeFilter(scope: AccessScope): Prisma.TeamWhereInput {
  if (scope.isCompanyWide) {
    return { deletedAt: null };
  }

  if (scope.teamId) {
    return { id: scope.teamId, deletedAt: null };
  }

  return { id: "__none__" };
}

export function dispatcherScopeFilter(scope: AccessScope): Prisma.DispatcherWhereInput {
  const base: Prisma.DispatcherWhereInput = { deletedAt: null };

  if (scope.isCompanyWide) {
    return base;
  }

  if (scope.role === "DISPATCHER" && scope.dispatcherId) {
    return { ...base, id: scope.dispatcherId };
  }

  if (scope.teamId) {
    return { ...base, teamId: scope.teamId };
  }

  return { ...base, id: "__none__" };
}

export function carrierScopeFilter(scope: AccessScope): Prisma.CarrierWhereInput {
  const base: Prisma.CarrierWhereInput = { deletedAt: null };

  if (scope.isCompanyWide) {
    return base;
  }

  if (scope.role === "DISPATCHER" && scope.dispatcherId) {
    return { ...base, dispatcherId: scope.dispatcherId };
  }

  if (scope.teamId) {
    return { ...base, teamId: scope.teamId };
  }

  return { ...base, id: "__none__" };
}

export function activityScopeFilter(scope: AccessScope): Prisma.DailyActivityWhereInput {
  if (scope.isCompanyWide) {
    return {};
  }

  if (scope.role === "DISPATCHER" && scope.dispatcherId) {
    return { dispatcherId: scope.dispatcherId };
  }

  if (scope.teamId) {
    return { teamId: scope.teamId };
  }

  return { id: "__none__" };
}
