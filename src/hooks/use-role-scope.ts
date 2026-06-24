"use client";

import { useMemo } from "react";

import { useSession } from "@/components/auth/session-provider";
import {
  buildRoleScopeFromSession,
  emptyRoleScope,
  filterActivitiesByScope,
  filterCarriersByScope,
  filterDispatchersByScope,
  filterTeamsByScope,
} from "@/lib/role-scope";
import type {
  Carrier,
  DailyActivity,
  Dispatcher,
  RoleScope,
  Team,
} from "@/lib/types";

export function useRoleScope(): RoleScope & {
  filterTeams: (teams: Team[]) => Team[];
  filterDispatchers: (dispatchers: Dispatcher[]) => Dispatcher[];
  filterCarriers: (carriers: Carrier[]) => Carrier[];
  filterActivities: (activities: DailyActivity[]) => DailyActivity[];
} {
  const { session } = useSession();

  return useMemo(() => {
    const scope = session
      ? buildRoleScopeFromSession(session)
      : emptyRoleScope();

    return {
      ...scope,
      filterTeams: (teams: Team[]) => filterTeamsByScope(teams, scope),
      filterDispatchers: (dispatchers: Dispatcher[]) =>
        filterDispatchersByScope(dispatchers, scope),
      filterCarriers: (carriers: Carrier[]) =>
        filterCarriersByScope(carriers, scope),
      filterActivities: (activities: DailyActivity[]) =>
        filterActivitiesByScope(activities, scope),
    };
  }, [session]);
}
