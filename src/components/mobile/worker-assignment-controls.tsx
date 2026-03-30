"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import {
  assignWorkerVehicleAction,
  releaseWorkerVehicleAction,
} from "@/lib/actions/assignment-actions";
import type {
  ActiveWorkerVehicleContext,
  AssignableWorkerVehicleOption,
} from "@/lib/fleet/worker-context-service";

interface WorkerAssignmentControlsProps {
  activeContext: ActiveWorkerVehicleContext | null;
  availableVehicles: AssignableWorkerVehicleOption[];
}

function MessageBox({
  status,
  message,
}: {
  status: "idle" | "success" | "error";
  message: string;
}) {
  if (!message) {
    return null;
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
        {message}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
        {message}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground">
      {message}
    </div>
  );
}

export function WorkerAssignmentControls({
  activeContext,
  availableVehicles,
}: WorkerAssignmentControlsProps) {
  const router = useRouter();
  const lastRefreshKeyRef = useRef("");

  const [releaseState, releaseAction, isReleasing] = useActionState(
    releaseWorkerVehicleAction,
    INITIAL_ACTION_STATE,
  );
  const [assignState, assignAction, isAssigning] = useActionState(
    assignWorkerVehicleAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    const releaseKey =
      releaseState.status === "success" && releaseState.message
        ? `release:${releaseState.message}`
        : "";
    const assignKey =
      assignState.status === "success" && assignState.message
        ? `assign:${assignState.message}`
        : "";

    const refreshKey = releaseKey || assignKey;

    if (!refreshKey) {
      return;
    }

    if (lastRefreshKeyRef.current === refreshKey) {
      return;
    }

    lastRefreshKeyRef.current = refreshKey;
    router.refresh();
  }, [assignState.message, assignState.status, releaseState.message, releaseState.status, router]);

  if (activeContext) {
    return (
      <div className="space-y-3">
        <p className="mt-2 text-sm leading-6 text-muted">
          Trenutačno zaduženje:
          <span className="ml-1 font-semibold text-foreground">{activeContext.vehicleLabel}</span>
          <span className="text-muted"> ({activeContext.plate})</span>
          <span className="data-font"> - {activeContext.currentKm.toLocaleString("hr-HR")} km</span>
        </p>

        <form action={releaseAction}>
          <button
            type="submit"
            disabled={isReleasing}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-rose-400/45 bg-rose-100 text-sm font-semibold text-rose-800 transition hover:border-rose-500/70 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
          >
            {isReleasing ? "Razduživanje..." : "Razduži vozilo"}
          </button>
        </form>

        <MessageBox status={releaseState.status} message={releaseState.message} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="mt-2 text-sm leading-6 text-amber-700 dark:text-amber-300">
        Nemate aktivno zaduženje. Odaberite slobodno vozilo i zadužite ga.
      </p>

      {availableVehicles.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-muted">
          Trenutačno nema slobodnih vozila za zaduženje.
        </div>
      ) : (
        <form action={assignAction} className="space-y-3 rounded-xl border border-border bg-surface/90 p-3">
          <label className="block text-xs uppercase tracking-[0.2em] text-muted">
            Slobodna vozila
            <select
              name="vehicleId"
              defaultValue=""
              className="carlytics-select mt-2 w-full px-3 py-2.5 text-sm"
            >
              <option value="">Odaberi vozilo</option>
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                  {vehicle.vehicleLabel} ({vehicle.plate}) - {vehicle.currentKm.toLocaleString("hr-HR")} km
                </option>
              ))}
            </select>
          </label>

          {assignState.fieldErrors?.vehicleId?.[0] ? (
            <p className="text-xs text-rose-700 dark:text-rose-300">{assignState.fieldErrors.vehicleId[0]}</p>
          ) : null}

          <button
            type="submit"
            disabled={isAssigning}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-100 text-sm font-medium text-cyan-800 transition hover:border-cyan-500/55 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cyan-500/16 dark:text-cyan-200 dark:hover:bg-cyan-500/28"
          >
            {isAssigning ? "Spremanje zaduženja..." : "Zaduži odabrano vozilo"}
          </button>
        </form>
      )}

      <MessageBox status={assignState.status} message={assignState.message} />
    </div>
  );
}
