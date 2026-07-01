"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  ensureLoaded: (options?: EntityOptionsLoadOptions) => void;
};

export type EntityOptionsLoadOptions = {
  teams?: boolean;
  dispatchers?: boolean;
  carriers?: boolean;
};

const EntityOptionsContext = createContext<EntityOptionsContextValue | null>(
  null,
);

const ENTITY_OPTIONS_STALE_TIME_MS = 5 * 60_000;

type CachedList = {
  data: unknown[];
  updatedAt: number;
};

const listCache = new Map<string, CachedList>();
const inflightRequests = new Map<string, Promise<unknown[]>>();

/**
 * Lazily loaded list. The fetch is deferred until `ensure()` (or `reload()`)
 * is first invoked while fetching is enabled, instead of firing on mount.
 * `ensure()` is idempotent and synchronously flips `isLoading` so consumers
 * never observe a "ready but empty" frame before the request starts.
 */
function useLazyList<T>(
  loader: () => Promise<T[]>,
  fetchEnabled: boolean,
  cacheKey: string,
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Whether a load has been kicked off for the current enabled session.
  const startedRef = useRef(false);
  // Monotonic id of the most recent request so superseded responses are
  // ignored (mirrors the guard in use-api-data).
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!fetchEnabled) {
      startedRef.current = false;
      queueMicrotask(() => {
        setData([]);
        setIsLoading(false);
      });
    }
  }, [fetchEnabled, cacheKey]);

  const load = useCallback(async (force = false) => {
    if (!fetchEnabled || !cacheKey) {
      return;
    }

    const cached = listCache.get(cacheKey);
    if (
      !force &&
      cached &&
      Date.now() - cached.updatedAt < ENTITY_OPTIONS_STALE_TIME_MS
    ) {
      setData(cached.data as T[]);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    let currentRequest: Promise<T[]> | undefined;

    try {
      let request = inflightRequests.get(cacheKey) as Promise<T[]> | undefined;
      if (!request || force) {
        request = loader();
        inflightRequests.set(cacheKey, request as Promise<unknown[]>);
      }
      currentRequest = request;

      const next = await request;
      if (requestId === requestIdRef.current) {
        listCache.set(cacheKey, { data: next, updatedAt: Date.now() });
        setData(next);
      }
    } catch {
      // The provider only surfaces a combined loading flag (no error state),
      // matching the previous behavior where a failed list resolved to [].
    } finally {
      if (currentRequest && inflightRequests.get(cacheKey) === currentRequest) {
        inflightRequests.delete(cacheKey);
      }
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [cacheKey, fetchEnabled, loader]);

  const ensure = useCallback(() => {
    if (startedRef.current || !fetchEnabled) {
      return;
    }

    startedRef.current = true;
    void load(false);
  }, [fetchEnabled, load]);

  const reload = useCallback(async () => {
    if (!fetchEnabled) {
      return;
    }

    startedRef.current = true;
    await load(true);
  }, [fetchEnabled, load]);

  return { data, isLoading, ensure, reload };
}

export function EntityOptionsProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: sessionLoading } = useSession();
  const fetchEnabled = !sessionLoading && session?.status === ACTIVE;
  const cacheScope = session
    ? [
        session.userId,
        session.role,
        session.teamId ?? "all-teams",
        session.dispatcherId ?? "all-dispatchers",
      ].join(":")
    : "anonymous";

  const loadTeams = useCallback(() => fetchTeams(), []);
  const loadDispatchers = useCallback(() => fetchDispatchers(), []);
  const loadCarriers = useCallback(() => fetchCarriers(), []);

  const {
    data: teams,
    isLoading: teamsLoading,
    ensure: ensureTeams,
    reload: reloadTeams,
  } = useLazyList<Team>(loadTeams, fetchEnabled, `${cacheScope}:teams`);
  const {
    data: dispatchers,
    isLoading: dispatchersLoading,
    ensure: ensureDispatchers,
    reload: reloadDispatchers,
  } = useLazyList<Dispatcher>(
    loadDispatchers,
    fetchEnabled,
    `${cacheScope}:dispatchers`,
  );
  const {
    data: carriers,
    isLoading: carriersLoading,
    ensure: ensureCarriers,
    reload: reloadCarriers,
  } = useLazyList<Carrier>(loadCarriers, fetchEnabled, `${cacheScope}:carriers`);

  const ensureLoaded = useCallback((options?: EntityOptionsLoadOptions) => {
    const shouldLoadTeams = options?.teams ?? true;
    const shouldLoadDispatchers = options?.dispatchers ?? true;
    const shouldLoadCarriers = options?.carriers ?? true;

    if (shouldLoadTeams) {
      ensureTeams();
    }
    if (shouldLoadDispatchers) {
      ensureDispatchers();
    }
    if (shouldLoadCarriers) {
      ensureCarriers();
    }
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
