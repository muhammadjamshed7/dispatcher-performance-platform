"use client";

import { useMemo } from "react";

import { ADMIN } from "@/lib/constants/roles";
import { useMockSession } from "@/components/auth/mock-session-provider";
import {
  buildRoleScope,
  buildRoleScopeFromSession,
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
  const { session } = useMockSession();

  return useMemo(() => {
    const scope = session
      ? buildRoleScopeFromSession(session)
      : buildRoleScope(ADMIN);

    return {
      ...scope,
      filterTeams: (teams: Team[]) => filterTeamsByScope(teams, scope),
      filterDispatchers: (dispatchers: Dispatcher[]) =>
        filterDispatchersByScope(dispatchers, scope),
      filterCarriers: (carriers: Carrier[]) => filterCarriersByScope(carriers, scope),
      filterActivities: (activities: DailyActivity[]) =>
        filterActivitiesByScope(activities, scope),
    };
  }, [session]);
}
