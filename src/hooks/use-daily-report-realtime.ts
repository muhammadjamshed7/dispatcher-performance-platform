"use client";

import { useEffect, useRef } from "react";

import { createBrowserClient } from "@/lib/supabase/client";

const REALTIME_DEBOUNCE_MS = 400;

type UseDailyReportRealtimeOptions = {
  enabled?: boolean;
  onRefresh: () => void;
};

export function useDailyReportRealtime({
  enabled = true,
  onRefresh,
}: UseDailyReportRealtimeOptions) {
  // Hold the latest callback in a ref so a new `onRefresh` identity (e.g. the
  // report's `reload` changing when filters change) does not tear down and
  // re-create the realtime subscription on every render.
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let supabase: ReturnType<typeof createBrowserClient> | null = null;

    try {
      supabase = createBrowserClient();
    } catch {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Debounce bursts of DailyActivity changes into a single reload instead of
    // refetching the whole report on every individual postgres event.
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
    // channel (removeChannel is async).
    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`admin-daily-report-activities-${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "DailyActivity" },
        scheduleRefresh,
      );

    channel.subscribe();

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      void supabase?.removeChannel(channel);
    };
  }, [enabled]);
}
