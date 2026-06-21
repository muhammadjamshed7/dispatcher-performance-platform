"use client";

import { useEffect } from "react";

import { createBrowserClient } from "@/lib/supabase/client";

type UseDailyReportRealtimeOptions = {
  enabled?: boolean;
  onRefresh: () => void;
};

export function useDailyReportRealtime({
  enabled = true,
  onRefresh,
}: UseDailyReportRealtimeOptions) {
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

    const channel = supabase
      .channel("admin-daily-report-activities")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "DailyActivity" },
        () => {
          onRefresh();
        },
      );

    channel.subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [enabled, onRefresh]);
}
