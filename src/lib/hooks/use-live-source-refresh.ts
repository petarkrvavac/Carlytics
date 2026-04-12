"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  useLiveUpdates,
  type LiveUpdateEvent,
} from "@/components/layout/live-updates-provider";

interface UseLiveSourceRefreshOptions {
  sourceTables: string[];
  onRefresh: (event: LiveUpdateEvent) => Promise<void> | void;
  enabled?: boolean;
  cooldownMs?: number;
}

export function useLiveSourceRefresh({
  sourceTables,
  onRefresh,
  enabled = true,
  cooldownMs = 300,
}: UseLiveSourceRefreshOptions) {
  const { latestEvent, eventVersion } = useLiveUpdates();
  const lastHandledEventIdRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);

  const sourceTableSet = useMemo(() => new Set(sourceTables), [sourceTables]);

  useEffect(() => {
    if (!enabled || !latestEvent || eventVersion <= 0) {
      return;
    }

    if (!sourceTableSet.has(latestEvent.sourceTable)) {
      return;
    }

    if (lastHandledEventIdRef.current === latestEvent.id) {
      return;
    }

    const now = Date.now();

    if (now - lastRefreshAtRef.current < cooldownMs) {
      return;
    }

    lastHandledEventIdRef.current = latestEvent.id;
    lastRefreshAtRef.current = now;

    const timeout = window.setTimeout(() => {
      void onRefresh(latestEvent);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cooldownMs, enabled, eventVersion, latestEvent, onRefresh, sourceTableSet]);
}
