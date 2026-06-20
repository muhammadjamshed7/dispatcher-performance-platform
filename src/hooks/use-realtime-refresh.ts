"use client";

import { useEffect } from "react";

import { createBrowserClient } from "@/lib/supabase/client";

type RealtimeTable =
  | "DailyActivity"
  | "DailySubmission"
  | "Carrier"
  | "Team"
  | "RegistrationRequest"
  | "User";

export function useRealtimeRefresh(
  tables: RealtimeTable[],
  onRefresh: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || tables.length === 0) {
      return;
    }

    let supabase: ReturnType<typeof createBrowserClient> | null = null;

    try {
      supabase = createBrowserClient();
    } catch {
      return;
    }

    const channel = supabase.channel(`dpp-realtime-${tables.join("-")}`);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          onRefresh();
        },
      );
    });

    channel.subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [enabled, onRefresh, tables]);
}
