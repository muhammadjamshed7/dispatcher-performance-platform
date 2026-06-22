"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { useApiData } from "@/hooks/use-api-data";
import {
  fetchCarriers,
  fetchDispatchers,
  fetchTeams,
} from "@/lib/api/resources";
import type { Carrier, Dispatcher, Team } from "@/lib/types";

type EntityOptionsContextValue = {
  teams: Team[];
  dispatchers: Dispatcher[];
  carriers: Carrier[];
  isLoading: boolean;
  reload: () => Promise<void>;
};

const EntityOptionsContext = createContext<EntityOptionsContextValue | null>(null);

export function EntityOptionsProvider({ children }: { children: ReactNode }) {
  const loadTeams = useCallback(() => fetchTeams(), []);
  const loadDispatchers = useCallback(() => fetchDispatchers(), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);

  const {
    data: teams = [],
    isLoading: teamsLoading,
    reload: reloadTeams,
  } = useApiData(loadTeams, []);
  const {
    data: dispatchers = [],
    isLoading: dispatchersLoading,
    reload: reloadDispatchers,
  } = useApiData(loadDispatchers, []);
  const {
    data: carriers = [],
    isLoading: carriersLoading,
    reload: reloadCarriers,
  } = useApiData(loadCarriers, []);

  const reload = useCallback(async () => {
    await Promise.all([reloadTeams(), reloadDispatchers(), reloadCarriers()]);
  }, [reloadCarriers, reloadDispatchers, reloadTeams]);

  const isLoading = teamsLoading || dispatchersLoading || carriersLoading;

  const value = useMemo(
    () => ({
      teams,
      dispatchers,
      carriers,
      isLoading,
      reload,
    }),
    [carriers, dispatchers, isLoading, reload, teams],
  );

  return (
    <EntityOptionsContext.Provider value={value}>
      {children}
    </EntityOptionsContext.Provider>
  );
}

export function useEntityOptionsContext() {
  const context = useContext(EntityOptionsContext);

  if (!context) {
    throw new Error("useEntityOptions must be used within EntityOptionsProvider.");
  }

  return context;
}
