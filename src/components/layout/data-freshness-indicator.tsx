"use client";

import { createClient } from "@supabase/supabase-js";
import { RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { Database } from "@/types/database";

const ALLOWED_SOURCE_TABLES = new Set([
  "evidencija_goriva",
  "prijave_kvarova",
  "zaduzenja",
]);

interface DataFreshnessIndicatorProps {
  updatedAtIso: string;
  isUsingFallbackData: boolean;
  refreshCooldownMs?: number;
}

const DEFAULT_REFRESH_COOLDOWN_MS = 1200;

function formatRelativeAge(secondsOld: number) {
  if (secondsOld < 2) {
    return "upravo sada";
  }

  if (secondsOld < 60) {
    return `prije ${secondsOld}s`;
  }

  const minutes = Math.floor(secondsOld / 60);

  if (minutes < 60) {
    return `prije ${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `prije ${hours}h`;
  }

  return `prije ${Math.floor(hours / 24)}d`;
}

export function DataFreshnessIndicator({
  updatedAtIso,
  isUsingFallbackData,
  refreshCooldownMs = DEFAULT_REFRESH_COOLDOWN_MS,
}: DataFreshnessIndicatorProps) {
  const router = useRouter();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const lastRefreshMsRef = useRef(0);
  const [isPending, startTransition] = useTransition();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const updatedAtMs = useMemo(() => {
    const parsed = new Date(updatedAtIso).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [updatedAtIso]);

  const triggerRefresh = useCallback(() => {
    const now = Date.now();

    // U istom valu događaja može stići više promjena; ograniči broj refresh poziva.
    if (now - lastRefreshMsRef.current < refreshCooldownMs) {
      return;
    }

    lastRefreshMsRef.current = now;

    startTransition(() => {
      router.refresh();
    });
  }, [refreshCooldownMs, router]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(ticker);
    };
  }, []);

  useEffect(() => {
    if (isUsingFallbackData || !supabaseUrl || !supabaseAnonKey) {
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
      .channel("dashboard-live-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_events",
          filter: "izvorna_tablica=in.(evidencija_goriva,prijave_kvarova,zaduzenja)",
        },
        (payload) => {
          const eventData = payload.new as Database["public"]["Tables"]["app_events"]["Row"] | null;

          if (!eventData) {
            return;
          }

          if (!ALLOWED_SOURCE_TABLES.has(eventData.izvorna_tablica)) {
            return;
          }

          triggerRefresh();
        },
      );

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn("[carlytics] Dashboard realtime kanal:", status);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isUsingFallbackData, supabaseAnonKey, supabaseUrl, triggerRefresh]);

  if (isUsingFallbackData) {
    return (
      <span className="inline-flex h-8 items-center rounded-lg border border-amber-500/30 bg-amber-500/12 px-3 text-xs font-medium text-amber-200">
        Demo podaci
      </span>
    );
  }

  const referenceNowMs = nowMs;
  const effectiveUpdatedAtMs = updatedAtMs > 0 ? updatedAtMs : referenceNowMs;
  const secondsOld = Math.max(0, Math.floor((referenceNowMs - effectiveUpdatedAtMs) / 1000));
  const relative = formatRelativeAge(secondsOld);

  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-muted">
      <RefreshCcw
        size={12}
        className={isPending ? "animate-spin text-cyan-300" : "text-cyan-300"}
      />
      <span>{isPending ? "Ažuriranje..." : `Ažurirano ${relative}`}</span>
    </div>
  );
}
