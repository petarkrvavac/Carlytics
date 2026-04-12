"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import {
  assignWorkerVehicleAction,
  releaseWorkerVehicleAction,
} from "@/lib/actions/assignment-actions";
import type {
  ActiveWorkerVehicleContext,
  AssignableWorkerVehicleOption,
} from "@/lib/fleet/worker-context-service";
import { useLiveSourceRefresh } from "@/lib/hooks/use-live-source-refresh";

const LIVE_WORKER_CONTEXT_SOURCE_TABLES = [
  "evidencija_goriva",
  "servisne_intervencije",
  "zaduzenja",
  "vozila",
  "registracije",
];

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
  const lastHandledSuccessKeyRef = useRef("");
  const pendingAssignedVehicleIdRef = useRef<number | null>(null);
  const releaseSnapshotRef = useRef<ActiveWorkerVehicleContext | null>(null);
  const [localActiveContext, setLocalActiveContext] = useState(activeContext);
  const [localAvailableVehicles, setLocalAvailableVehicles] = useState(availableVehicles);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const refreshWorkerContext = useCallback(async () => {
    const response = await fetch("/api/live/worker-context", {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      activeContext?: ActiveWorkerVehicleContext | null;
      availableVehicles?: AssignableWorkerVehicleOption[];
    };

    setLocalActiveContext(payload.activeContext ?? null);

    if (Array.isArray(payload.availableVehicles)) {
      setLocalAvailableVehicles(payload.availableVehicles);
    }
  }, []);

  useLiveSourceRefresh({
    sourceTables: LIVE_WORKER_CONTEXT_SOURCE_TABLES,
    onRefresh: refreshWorkerContext,
  });

  const [releaseState, releaseAction, isReleasing] = useActionState(
    releaseWorkerVehicleAction,
    INITIAL_ACTION_STATE,
  );
  const [assignState, assignAction, isAssigning] = useActionState(
    assignWorkerVehicleAction,
    INITIAL_ACTION_STATE,
  );

  useEffect(() => {
    setLocalActiveContext(activeContext);
  }, [activeContext]);

  useEffect(() => {
    setLocalAvailableVehicles(availableVehicles);
  }, [availableVehicles]);

  useEffect(() => {
    if (releaseState.status !== "success" || !releaseState.message) {
      return;
    }

    const successKey = `release:${releaseState.message}`;

    if (lastHandledSuccessKeyRef.current === successKey) {
      return;
    }

    lastHandledSuccessKeyRef.current = successKey;

    const releasedContext = releaseSnapshotRef.current ?? localActiveContext;

    if (releasedContext) {
      setLocalAvailableVehicles((current) => {
        if (current.some((vehicle) => vehicle.vehicleId === releasedContext.vehicleId)) {
          return current;
        }

        const next = [
          ...current,
          {
            vehicleId: releasedContext.vehicleId,
            vehicleLabel: releasedContext.vehicleLabel,
            plate: releasedContext.plate,
            currentKm: releasedContext.currentKm,
            fuelCapacity: releasedContext.fuelCapacity,
          },
        ];

        next.sort((left, right) => left.vehicleLabel.localeCompare(right.vehicleLabel, "hr-HR"));
        return next;
      });
    }

    setLocalActiveContext(null);
    releaseSnapshotRef.current = null;
  }, [localActiveContext, releaseState.message, releaseState.status]);

  useEffect(() => {
    if (assignState.status !== "success" || !assignState.message) {
      return;
    }

    const successKey = `assign:${assignState.message}`;

    if (lastHandledSuccessKeyRef.current === successKey) {
      return;
    }

    lastHandledSuccessKeyRef.current = successKey;

    const payload = assignState.payload;
    const assignedVehicleIdFromPayload =
      typeof payload?.vehicleId === "number" ? payload.vehicleId : null;
    const assignmentIdFromPayload =
      typeof payload?.assignmentId === "number" ? payload.assignmentId : null;
    const kmStartFromPayload = typeof payload?.kmStart === "number" ? payload.kmStart : null;

    const assignedVehicleId = assignedVehicleIdFromPayload ?? pendingAssignedVehicleIdRef.current;

    if (!assignedVehicleId || !assignmentIdFromPayload) {
      return;
    }

    const selectedVehicle = localAvailableVehicles.find(
      (vehicle) => vehicle.vehicleId === assignedVehicleId,
    );

    if (!selectedVehicle) {
      return;
    }

    setLocalAvailableVehicles((current) =>
      current.filter((vehicle) => vehicle.vehicleId !== assignedVehicleId),
    );

    setLocalActiveContext({
      assignmentId: assignmentIdFromPayload,
      vehicleId: selectedVehicle.vehicleId,
      vehicleLabel: selectedVehicle.vehicleLabel,
      plate: selectedVehicle.plate,
      currentKm: kmStartFromPayload ?? selectedVehicle.currentKm,
      fuelCapacity: selectedVehicle.fuelCapacity,
    });

    setSelectedVehicleId("");
    pendingAssignedVehicleIdRef.current = null;
  }, [assignState.message, assignState.payload, assignState.status, localAvailableVehicles]);

  if (localActiveContext) {
    return (
      <div className="space-y-3">
        <p className="mt-2 text-sm leading-6 text-muted">
          Trenutačno zaduženje:
          <span className="ml-1 font-semibold text-foreground">{localActiveContext.vehicleLabel}</span>
          <span className="text-muted"> ({localActiveContext.plate})</span>
          <span className="data-font"> - {localActiveContext.currentKm.toLocaleString("hr-HR")} km</span>
        </p>

        <form
          key={localActiveContext.assignmentId}
          action={releaseAction}
          onSubmit={() => {
            releaseSnapshotRef.current = localActiveContext;
          }}
          className="space-y-2 rounded-xl border border-border bg-surface/90 p-3"
        >
          <label className="block text-xs uppercase tracking-[0.2em] text-muted">
            Završna kilometraža
            <input
              type="number"
              name="kmZavrsna"
              disabled={isReleasing}
              required
              min={localActiveContext.currentKm}
              step={1}
              inputMode="numeric"
              defaultValue={localActiveContext.currentKm}
              className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:opacity-70"
              placeholder={`Upiši minimalno ${localActiveContext.currentKm.toLocaleString("hr-HR")} km`}
            />
          </label>

          <p className="text-xs text-muted">
            Unos kilometraže je obavezan prije razduživanja.
          </p>

          {releaseState.fieldErrors?.kmZavrsna?.[0] ? (
            <p className="text-xs text-rose-700 dark:text-rose-300">{releaseState.fieldErrors.kmZavrsna[0]}</p>
          ) : null}

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

      {localAvailableVehicles.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-muted">
          Trenutačno nema slobodnih vozila za zaduženje.
        </div>
      ) : (
        <form
          action={assignAction}
          onSubmit={() => {
            const parsedVehicleId = Number(selectedVehicleId);
            pendingAssignedVehicleIdRef.current = Number.isInteger(parsedVehicleId)
              ? parsedVehicleId
              : null;
          }}
          className="space-y-3 rounded-xl border border-border bg-surface/90 p-3"
        >
          <label className="block text-xs uppercase tracking-[0.2em] text-muted">
            Slobodna vozila
            <select
              name="vehicleId"
              value={selectedVehicleId}
              onChange={(event) => setSelectedVehicleId(event.target.value)}
              disabled={isAssigning}
              className="carlytics-select mt-2 w-full px-3 py-2.5 text-sm"
            >
              <option value="">Odaberi vozilo</option>
              {localAvailableVehicles.map((vehicle) => (
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
