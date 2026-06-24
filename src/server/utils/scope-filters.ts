import "server-only";

import type { AccessScope } from "@/server/auth/types";

export function teamScopeFilter(scope: AccessScope) {
  if (scope.isCompanyWide) {
    return { deletedAt: null as string | null };
  }

  if (scope.teamId) {
    return { id: scope.teamId, deletedAt: null as string | null };
  }

  return { id: "__none__", deletedAt: null as string | null };
}

export function dispatcherScopeFilter(scope: AccessScope) {
  if (scope.isCompanyWide) {
    return { deletedAt: null as string | null };
  }

  if (scope.role === "DISPATCHER" && scope.dispatcherId) {
    return { id: scope.dispatcherId, deletedAt: null as string | null };
  }

  if (scope.teamId) {
    return { teamId: scope.teamId, deletedAt: null as string | null };
  }

  return { id: "__none__", deletedAt: null as string | null };
}

export function carrierScopeFilter(scope: AccessScope) {
  if (scope.isCompanyWide) {
    return { deletedAt: null as string | null };
  }

  if (scope.role === "DISPATCHER" && scope.dispatcherId) {
    return {
      dispatcherId: scope.dispatcherId,
      deletedAt: null as string | null,
    };
  }

  if (scope.teamId) {
    return { teamId: scope.teamId, deletedAt: null as string | null };
  }

  return { id: "__none__", deletedAt: null as string | null };
}

export function activityScopeFilter(scope: AccessScope) {
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
