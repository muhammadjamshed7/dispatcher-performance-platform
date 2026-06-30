"use client";

import { useEffect } from "react";

import { useRoleScope } from "@/hooks/use-role-scope";
import { useEntityOptionsContext } from "@/components/providers/entity-options-provider";

export function useEntityOptions() {
  const { filterTeams, filterDispatchers, filterCarriers } = useRoleScope();
  const { teams, dispatchers, carriers, isLoading, reload, ensureLoaded } =
    useEntityOptionsContext();

  // Fetch-on-first-consume: signal demand as soon as a consumer mounts so the
  // provider kicks off the entity fetches with the same timing as an eager
  // mount load. Pages without any consumer never reach this effect, so they
  // never trigger the teams/dispatchers/carriers requests.
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  return {
    teams: filterTeams(teams),
    dispatchers: filterDispatchers(dispatchers),
    carriers: filterCarriers(carriers),
    isLoading,
    reload,
  };
}
