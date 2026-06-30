"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useSession } from "@/components/auth/session-provider";
import { ACTIVE } from "@/lib/auth/user-statuses";
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
  /**
   * Signals that a consumer needs the entity lists. The first call (once the
   * session is active) kicks off the network fetches; subsequent calls are
   * no-ops. Pages with no `useEntityOptions()` consumer never call this, so
   * they never trigger the /api/teams, /api/dispatchers, or /api/carriers
   * requests.
   */
  ensureLoaded: () => void;
};

const EntityOptionsContext = createContext<EntityOptionsContextValue | null>(
  null,
);

/**
 * Lazily loaded list. The fetch is deferred until `ensure()` (or `reload()`)
 * is first invoked while fetching is enabled, instead of firing on mount.
 * `ensure()` is idempotent and synchronously flips `isLoading` so consumers
 * never observe a "ready but empty" frame before the request starts.
 */
function useLazyList<T>(loader: () => Promise<T[]>, fetchEnabled: boolean) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Whether a load has been kicked off for the current enabled session.
  const startedRef = useRef(false);
  // Monotonic id of the most recent request so superseded responses are
  // ignored (mirrors the guard in use-api-data).
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const next = await loader();
      if (requestId === requestIdRef.current) {
        setData(next);
      }
    } catch {
      // The provider only surfaces a combined loading flag (no error state),
      // matching the previous behavior where a failed list resolved to [].
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [loader]);

  const ensure = useCallback(() => {
    if (startedRef.current || !fetchEnabled) {
      return;
    }

    startedRef.current = true;
    void load();
  }, [fetchEnabled, load]);

  const reload = useCallback(async () => {
    if (!fetchEnabled) {
      return;
    }

    startedRef.current = true;
    await load();
  }, [fetchEnabled, load]);

  return { data, isLoading, ensure, reload };
}

export function EntityOptionsProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: sessionLoading } = useSession();
  const fetchEnabled = !sessionLoading && session?.status === ACTIVE;

  const loadTeams = useCallback(() => fetchTeams(), []);
  const loadDispatchers = useCallback(() => fetchDispatchers(), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);

  const {
    data: teams,
    isLoading: teamsLoading,
    ensure: ensureTeams,
    reload: reloadTeams,
  } = useLazyList<Team>(loadTeams, fetchEnabled);
  const {
    data: dispatchers,
    isLoading: dispatchersLoading,
    ensure: ensureDispatchers,
    reload: reloadDispatchers,
  } = useLazyList<Dispatcher>(loadDispatchers, fetchEnabled);
  const {
    data: carriers,
    isLoading: carriersLoading,
    ensure: ensureCarriers,
    reload: reloadCarriers,
  } = useLazyList<Carrier>(loadCarriers, fetchEnabled);

  const ensureLoaded = useCallback(() => {
    ensureTeams();
    ensureDispatchers();
    ensureCarriers();
  }, [ensureCarriers, ensureDispatchers, ensureTeams]);

  const reload = useCallback(async () => {
    await Promise.all([reloadTeams(), reloadDispatchers(), reloadCarriers()]);
  }, [reloadCarriers, reloadDispatchers, reloadTeams]);

  const isLoading =
    sessionLoading ||
    (fetchEnabled && (teamsLoading || dispatchersLoading || carriersLoading));

  const value = useMemo(
    () => ({
      teams,
      dispatchers,
      carriers,
      isLoading,
      reload,
      ensureLoaded,
    }),
    [carriers, dispatchers, ensureLoaded, isLoading, reload, teams],
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
    throw new Error(
      "useEntityOptions must be used within EntityOptionsProvider.",
    );
  }

  return context;
}
