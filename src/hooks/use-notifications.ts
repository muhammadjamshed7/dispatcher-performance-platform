"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchNotifications } from "@/lib/api/resources";
import type { AppNotification } from "@/lib/types";

type NotificationsData = {
  notifications: AppNotification[];
  unreadCount: number;
};

type Listener = (state: NotificationsState) => void;

type NotificationsState = {
  data: NotificationsData | undefined;
  error: string | null;
  isLoading: boolean;
};

const STALE_TIME_MS = 30_000;

let cache: NotificationsData | undefined;
let cacheUpdatedAt = 0;
let inflight: Promise<NotificationsData> | null = null;
let state: NotificationsState = {
  data: undefined,
  error: null,
  isLoading: false,
};
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener(state);
  }
}

function setState(next: NotificationsState) {
  state = next;
  notify();
}

async function loadNotifications(force = false) {
  const now = Date.now();

  if (!force && cache && now - cacheUpdatedAt < STALE_TIME_MS) {
    setState({ data: cache, error: null, isLoading: false });
    return cache;
  }

  if (!force && inflight) {
    return inflight;
  }

  setState({ data: cache, error: null, isLoading: true });
  inflight = fetchNotifications()
    .then((data) => {
      cache = data;
      cacheUpdatedAt = Date.now();
      setState({ data, error: null, isLoading: false });
      return data;
    })
    .catch((error: unknown) => {
      setState({
        data: cache,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load notifications.",
        isLoading: false,
      });
      throw error;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useNotifications(enabled = true) {
  const [localState, setLocalState] = useState<NotificationsState>(state);

  useEffect(() => {
    listeners.add(setLocalState);
    return () => {
      listeners.delete(setLocalState);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void loadNotifications().catch(() => undefined);
  }, [enabled]);

  const reload = useCallback(async () => {
    await loadNotifications(true);
  }, []);

  return {
    data: localState.data,
    error: localState.error,
    isLoading: enabled && localState.isLoading,
    isEmpty:
      !localState.isLoading &&
      !localState.error &&
      Array.isArray(localState.data?.notifications) &&
      localState.data.notifications.length === 0,
    reload,
  };
}

export function invalidateNotificationsCache() {
  cache = undefined;
  cacheUpdatedAt = 0;
}
