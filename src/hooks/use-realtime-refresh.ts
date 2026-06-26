"use client";

import { useEffect, useMemo, useRef } from "react";

import { createBrowserClient } from "@/lib/supabase/client";

const REALTIME_DEBOUNCE_MS = 400;

export type RealtimeTable =
  | "DailyActivity"
  | "DailySubmission"
  | "Carrier"
  | "Team"
  | "RegistrationRequest"
  | "User"
  | "Notification"
  | "ActivityEditRequest"
  | "AuditLog";

export function useRealtimeRefresh(
  tables: readonly RealtimeTable[],
  onRefresh: () => void,
  enabled = true,
) {
  const tablesKey = useMemo(() => tables.join(","), [tables]);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    // Rebuild the table list from the stable key so the effect only re-runs when
    // the set of tables actually changes — even if the caller passes a new array
    // reference on every render.
    const tableList = (
      tablesKey ? tablesKey.split(",") : []
    ) as RealtimeTable[];

    if (!enabled || tableList.length === 0) {
      return;
    }

    let supabase: ReturnType<typeof createBrowserClient> | null = null;

    try {
      supabase = createBrowserClient();
    } catch {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        onRefreshRef.current();
      }, REALTIME_DEBOUNCE_MS);
    };

    // Unique topic per subscription instance. The browser Supabase client is a
    // singleton, so a deterministic topic can collide with a not-yet-removed
    // channel (removeChannel is async) and Supabase forbids adding
    // postgres_changes listeners after subscribe().
    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(`dpp-realtime-${tablesKey}-${uniqueId}`);

    tableList.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    });

    channel.subscribe();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      void supabase?.removeChannel(channel);
    };
  }, [enabled, tablesKey]);
}
