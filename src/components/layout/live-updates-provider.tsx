"use client";

import { createClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Database } from "@/types/database";

const TRACKED_SOURCE_TABLES = new Set([
  "evidencija_goriva",
  "servisne_intervencije",
  "zaduzenja",
  "vozila",
  "registracije",
  "zaposlenici",
  "uloge",
  "mjesta",
  "zupanije",
  "drzave",
]);

export interface LiveUpdateEvent {
  id: number;
  sourceTable: string;
  operation: string;
  eventType: string;
  recordId: number | null;
  createdAtIso: string;
}

interface LiveUpdatesContextValue {
  latestEvent: LiveUpdateEvent | null;
  latestEventAtIso: string | null;
  eventVersion: number;
}

const DEFAULT_VALUE: LiveUpdatesContextValue = {
  latestEvent: null,
  latestEventAtIso: null,
  eventVersion: 0,
};

const LiveUpdatesContext = createContext<LiveUpdatesContextValue>(DEFAULT_VALUE);

interface LiveUpdatesProviderProps {
  children: ReactNode;
}

export function LiveUpdatesProvider({ children }: LiveUpdatesProviderProps) {
  const [latestEvent, setLatestEvent] = useState<LiveUpdateEvent | null>(null);
  const [eventVersion, setEventVersion] = useState(0);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const channel = supabase
      .channel("carlytics-live-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_events",
        },
        (payload) => {
          const row = payload.new as Database["public"]["Tables"]["app_events"]["Row"] | null;

          if (!row) {
            return;
          }

          if (!TRACKED_SOURCE_TABLES.has(row.izvorna_tablica)) {
            return;
          }

          setLatestEvent({
            id: row.id,
            sourceTable: row.izvorna_tablica,
            operation: row.operacija,
            eventType: row.tip_dogadjaja,
            recordId: row.id_zapisa,
            createdAtIso: row.kreirano_u,
          });
          setEventVersion((current) => current + 1);
        },
      );

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn("[carlytics] Live update kanal:", status);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabaseAnonKey, supabaseUrl]);

  const contextValue = useMemo<LiveUpdatesContextValue>(
    () => ({
      latestEvent,
      latestEventAtIso: latestEvent?.createdAtIso ?? null,
      eventVersion,
    }),
    [eventVersion, latestEvent],
  );

  return <LiveUpdatesContext.Provider value={contextValue}>{children}</LiveUpdatesContext.Provider>;
}

export function useLiveUpdates() {
  return useContext(LiveUpdatesContext);
}
