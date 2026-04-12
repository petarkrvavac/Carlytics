"use client";

import { useActionState, useEffect } from "react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { submitDesktopFaultReportAction } from "@/lib/actions/fault-actions";
import type { VehicleListItem } from "@/lib/fleet/types";
import type { FaultCategoryOption } from "@/lib/fleet/worker-context-service";
import { cn } from "@/lib/utils/cn";

interface DesktopFaultReportFormProps {
  vehicles: VehicleListItem[];
  categories: FaultCategoryOption[];
  mode?: "page" | "modal";
  onCancel?: () => void;
  onSuccess?: (payload: DesktopFaultReportSuccessPayload | null) => void;
}

export interface DesktopFaultReportSuccessPayload {
  faultId: number | null;
  reportedAtIso: string;
  vehicleId: number;
  description: string;
  categoryId: number | null;
  priority: "nisko" | "srednje" | "visoko" | "kriticno";
  statusRaw: string;
  attachmentUrl: string | null;
  reporterName: string;
}

const PRIORITY_OPTIONS = [
  { value: "nisko", label: "Nisko" },
  { value: "srednje", label: "Srednje" },
  { value: "visoko", label: "Visoko" },
  { value: "kriticno", label: "Kritično" },
] as const;

function parseFaultSuccessPayload(
  payload: Record<string, unknown> | undefined,
): DesktopFaultReportSuccessPayload | null {
  if (!payload) {
    return null;
  }

  const vehicleId = payload.vehicleId;
  const reportedAtIso = payload.reportedAtIso;
  const description = payload.description;
  const categoryId = payload.categoryId;
  const priority = payload.priority;
  const statusRaw = payload.statusRaw;
  const reporterName = payload.reporterName;

  if (
    typeof vehicleId !== "number" ||
    typeof reportedAtIso !== "string" ||
    typeof description !== "string" ||
    typeof statusRaw !== "string" ||
    typeof reporterName !== "string"
  ) {
    return null;
  }

  if (
    priority !== "nisko" &&
    priority !== "srednje" &&
    priority !== "visoko" &&
    priority !== "kriticno"
  ) {
    return null;
  }

  return {
    faultId: typeof payload.faultId === "number" ? payload.faultId : null,
    reportedAtIso,
    vehicleId,
    description,
    categoryId: typeof categoryId === "number" ? categoryId : null,
    priority,
    statusRaw,
    attachmentUrl: typeof payload.attachmentUrl === "string" ? payload.attachmentUrl : null,
    reporterName,
  };
}

export function DesktopFaultReportForm({
  vehicles,
  categories,
  mode = "page",
  onCancel,
  onSuccess,
}: DesktopFaultReportFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitDesktopFaultReportAction,
    INITIAL_ACTION_STATE,
  );
  const isModalMode = mode === "modal";

  const isDisabled = vehicles.length === 0;

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    onSuccess?.(parseFaultSuccessPayload(state.payload));
  }, [onSuccess, state.payload, state.status]);

  return (
    <form
      action={formAction}
      className={cn(
        "space-y-3 rounded-2xl border border-border bg-surface/90 p-4",
        isModalMode && "min-h-0 overflow-y-auto",
      )}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-xs uppercase tracking-[0.2em] text-muted lg:col-span-2">
          Vozilo
          <select
            name="voziloId"
            required
            disabled={isDisabled}
            defaultValue=""
            className="carlytics-select mt-2 w-full px-3 py-2 text-sm"
          >
            <option value="">Odaberi vozilo</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.make} {vehicle.model} ({vehicle.plate}) - {vehicle.status}
              </option>
            ))}
          </select>
          {state.fieldErrors?.voziloId?.[0] ? (
            <span className="mt-1 block text-xs normal-case tracking-normal text-rose-300">
              {state.fieldErrors.voziloId[0]}
            </span>
          ) : null}
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted">
          Kategorija
          <select
            name="kategorijaId"
            disabled={isDisabled}
            defaultValue=""
            className="carlytics-select mt-2 w-full px-3 py-2 text-sm"
          >
            <option value="">Bez kategorije</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.naziv}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted">
          Hitnost
          <select
            name="hitnost"
            defaultValue="srednje"
            disabled={isDisabled}
            className="carlytics-select mt-2 w-full px-3 py-2 text-sm"
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted lg:col-span-2">
          Opis problema
          <textarea
            rows={4}
            name="opisProblema"
            required
            disabled={isDisabled}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-slate-500 disabled:opacity-60"
            placeholder="Npr. trešnja volana pri kočenju, lampica motora aktivna..."
          />
          {state.fieldErrors?.opisProblema?.[0] ? (
            <span className="mt-1 block text-xs normal-case tracking-normal text-rose-300">
              {state.fieldErrors.opisProblema[0]}
            </span>
          ) : null}
        </label>

        <label className="text-xs uppercase tracking-[0.2em] text-muted lg:col-span-2">
          Fotografija kvara (opcionalno)
          <input
            type="file"
            name="fotografija"
            accept="image/*"
            disabled={isDisabled}
            className="mt-2 block w-full rounded-xl border border-dashed border-border bg-surface px-3 py-2 text-xs text-muted disabled:opacity-60"
          />
        </label>
      </div>

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
              : state.status === "error"
                ? "rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
                : "rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted"
          }
        >
          {state.message}
        </div>
      ) : null}

      {isDisabled ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Trenutno nema dostupnih vozila za prijavu kvara.
        </div>
      ) : null}

      <div className={cn("flex justify-end", onCancel && "gap-2") }>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-4 text-sm text-foreground transition hover:border-cyan-500/45 hover:text-cyan-200"
          >
            Odustani
          </button>
        ) : null}

        <button
          type="submit"
          disabled={isPending || isDisabled}
          className="inline-flex h-10 items-center rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Spremanje..." : "Pošalji prijavu"}
        </button>
      </div>
    </form>
  );
}
