"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  getMockSession,
  notifyMockSessionChange,
  setMockSession,
  signOutMockSession,
  subscribeMockSession,
  type MockSession,
} from "@/lib/auth/mock-session";

type MockSessionContextValue = {
  session: MockSession | null;
  isLoading: boolean;
  refreshSession: () => void;
  signOut: () => void;
  setSession: (session: MockSession | null) => void;
};

const MockSessionContext = createContext<MockSessionContextValue | null>(null);

type MockSessionProviderProps = {
  children: ReactNode;
};

function getServerSessionSnapshot(): MockSession | null {
  return null;
}

function getServerLoadingSnapshot(): boolean {
  return true;
}

function getClientLoadingSnapshot(): boolean {
  return false;
}

export function MockSessionProvider({ children }: MockSessionProviderProps) {
  const session = useSyncExternalStore(
    subscribeMockSession,
    getMockSession,
    getServerSessionSnapshot,
  );
  const isLoading = useSyncExternalStore(
    subscribeMockSession,
    getClientLoadingSnapshot,
    getServerLoadingSnapshot,
  );

  const refreshSession = useCallback(() => {
    notifyMockSessionChange();
  }, []);

  const setSession = useCallback((nextSession: MockSession | null) => {
    setMockSession(nextSession);
  }, []);

  const signOut = useCallback(() => {
    signOutMockSession();
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
    <MockSessionContext.Provider value={value}>{children}</MockSessionContext.Provider>
  );
}

export function useMockSession(): MockSessionContextValue {
  const context = useContext(MockSessionContext);

  if (!context) {
    throw new Error("useMockSession must be used within MockSessionProvider.");
  }

  return context;
}
