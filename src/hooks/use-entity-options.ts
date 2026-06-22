"use client";

import { useRoleScope } from "@/hooks/use-role-scope";
import { useEntityOptionsContext } from "@/components/providers/entity-options-provider";

export function useEntityOptions() {
  const { filterTeams, filterDispatchers, filterCarriers } = useRoleScope();
  const { teams, dispatchers, carriers, isLoading, reload } =
    useEntityOptionsContext();

  return {
    teams: filterTeams(teams),
    dispatchers: filterDispatchers(dispatchers),
    carriers: filterCarriers(carriers),
    isLoading,
    reload,
  };
}
