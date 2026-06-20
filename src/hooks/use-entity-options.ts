"use client";

import { useCallback } from "react";

import { useApiData } from "@/hooks/use-api-data";
import { useRoleScope } from "@/hooks/use-role-scope";
import {
  fetchCarriers,
  fetchDispatchers,
  fetchTeams,
} from "@/lib/api/resources";

export function useEntityOptions() {
  const { filterTeams, filterDispatchers, filterCarriers } = useRoleScope();

  const loadTeams = useCallback(() => fetchTeams(), []);
  const loadDispatchers = useCallback(() => fetchDispatchers(), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);

  const { data: teams = [], isLoading: teamsLoading } = useApiData(loadTeams, []);
  const { data: dispatchers = [], isLoading: dispatchersLoading } = useApiData(
    loadDispatchers,
    [],
  );
  const { data: carriers = [], isLoading: carriersLoading } = useApiData(
    loadCarriers,
    [],
  );

  return {
    teams: filterTeams(teams),
    dispatchers: filterDispatchers(dispatchers),
    carriers: filterCarriers(carriers),
    isLoading: teamsLoading || dispatchersLoading || carriersLoading,
  };
}
