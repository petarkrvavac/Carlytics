"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useLiveUpdates } from "@/components/layout/live-updates-provider";

const LIVE_UPDATE_PULSE_MS = 1000;

interface DataFreshnessIndicatorProps {
  updatedAtIso: string;
  isUsingFallbackData: boolean;
}

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
}: DataFreshnessIndicatorProps) {
  const { latestEventAtIso, eventVersion } = useLiveUpdates();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isLivePulseActive, setIsLivePulseActive] = useState(false);

  const dashboardUpdatedAtMs = useMemo(() => {
    const parsed = new Date(updatedAtIso).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [updatedAtIso]);

  const liveUpdatedAtMs = useMemo(() => {
    if (!latestEventAtIso) {
      return 0;
    }

    const parsed = new Date(latestEventAtIso).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [latestEventAtIso]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(ticker);
    };
  }, []);

  useEffect(() => {
    if (isUsingFallbackData || eventVersion <= 0) {
      return;
    }

    const activatePulseTimeout = window.setTimeout(() => {
      setNowMs(Date.now());
      setIsLivePulseActive(true);
    }, 0);

    const deactivatePulseTimeout = window.setTimeout(() => {
      setIsLivePulseActive(false);
    }, LIVE_UPDATE_PULSE_MS);

    return () => {
      window.clearTimeout(activatePulseTimeout);
      window.clearTimeout(deactivatePulseTimeout);
    };
  }, [eventVersion, isUsingFallbackData]);

  if (isUsingFallbackData) {
    return (
      <span className="inline-flex h-8 items-center rounded-lg border border-amber-500/30 bg-amber-500/12 px-3 text-xs font-medium text-amber-200">
        Demo podaci
      </span>
    );
  }

  const referenceNowMs = nowMs;
  const bestKnownUpdatedAtMs = Math.max(dashboardUpdatedAtMs, liveUpdatedAtMs);
  const effectiveUpdatedAtMs = bestKnownUpdatedAtMs > 0 ? bestKnownUpdatedAtMs : referenceNowMs;
  const secondsOld = Math.max(0, Math.floor((referenceNowMs - effectiveUpdatedAtMs) / 1000));
  const relative = formatRelativeAge(secondsOld);

  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-muted">
      <RefreshCcw
        size={12}
        className={isLivePulseActive ? "animate-spin text-cyan-300" : "text-cyan-300"}
      />
      <span>{isLivePulseActive ? "Primljen novi događaj" : `Ažurirano ${relative}`}</span>
    </div>
  );
}
