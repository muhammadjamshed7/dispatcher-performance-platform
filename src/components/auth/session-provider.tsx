"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import {
  fetchSession,
  logoutRequest,
  type SessionUser,
} from "@/lib/api/resources";
import { isPublicAuthPath } from "@/lib/auth/roles";
import { hasSupabaseAuthCookiesInDocument } from "@/lib/supabase/auth-cookies";
import { setDefaultCurrency } from "@/lib/utils/format-currency";

type SessionContextValue = {
  session: SessionUser | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: SessionUser | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSessionState] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const nextSession = await fetchSession().catch(() => null);
    setDefaultCurrency(nextSession?.currency);
    setSessionState(nextSession);
  }, []);

  useEffect(() => {
    let active = true;

    const shouldSkipSessionFetch =
      isPublicAuthPath(pathname) && !hasSupabaseAuthCookiesInDocument();

    if (shouldSkipSessionFetch) {
      queueMicrotask(() => {
        if (active) {
          setIsLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }

    queueMicrotask(() => {
      refreshSession()
        .catch(() => undefined)
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
    });

    return () => {
      active = false;
    };
  }, [pathname, refreshSession]);

  const signOut = useCallback(async () => {
    await logoutRequest();
    setDefaultCurrency(null);
    setSessionState(null);
  }, []);

  const setSession = useCallback((nextSession: SessionUser | null) => {
    setDefaultCurrency(nextSession?.currency);
    setSessionState(nextSession);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isLoading,
      refreshSession,
      signOut,
      setSession,
    }),
    [session, isLoading, refreshSession, signOut, setSession],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return context;
}
