"use client";

import { useActionState, useEffect, useState } from "react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { recordVehicleServiceAction } from "@/lib/actions/fault-actions";
import type { VehicleListItem } from "@/lib/fleet/types";

interface VehicleServiceRecordFormProps {
  vehicle: VehicleListItem;
}

function getResolvedServiceType(vehicle: VehicleListItem) {
  return vehicle.serviceDueType === "mali" ? "mali" : "veliki";
}

function getServiceBadgeLabel(vehicle: VehicleListItem) {
  return getResolvedServiceType(vehicle) === "mali" ? "Mali servis" : "Veliki servis";
}

function getDefaultServiceDate() {
  return new Date().toISOString().slice(0, 10);
}

function VehicleServiceModalContent({
  vehicle,
  serviceType,
  onClose,
}: {
  vehicle: VehicleListItem;
  serviceType: "mali" | "veliki";
  onClose: () => void;
}) {
  const [state, action, isPending] = useActionState(recordVehicleServiceAction, INITIAL_ACTION_STATE);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state.status]);

  return (
    <form action={action} className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-[0_0_0_1px_rgba(15,23,42,0.6),0_28px_80px_rgba(2,6,23,0.7)]">
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      <input type="hidden" name="serviceType" value={serviceType} />

      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Servis vozila</p>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            {serviceType === "mali" ? "Zapiši mali servis" : "Zapiši veliki servis"}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {serviceType === "veliki"
              ? "Veliki servis uključuje i mali servis."
              : "Unos malog servisa ažurira zadnju servisnu kilometražu vozila."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-cyan-500/45 hover:text-cyan-200"
          aria-label="Zatvori popup servisa"
        >
          ×
        </button>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Vrsta servisa
          <div className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground">
            {getServiceBadgeLabel(vehicle)}
          </div>
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Datum servisa
          <input
            type="date"
            name="serviceDate"
            defaultValue={getDefaultServiceDate()}
            required
            disabled={isPending}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Kilometraža nakon servisa
          <input
            type="number"
            name="serviceKm"
            min={vehicle.km}
            step="1"
            defaultValue={vehicle.km}
            required
            disabled={isPending}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Cijena servisa (EUR)
          <input
            type="number"
            name="serviceCost"
            min="0"
            step="0.01"
            required
            disabled={isPending}
            placeholder="0.00"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 px-5 py-4">
        <p className="text-xs text-muted">
          Upis odmah ažurira vozilo i zapisuje servisnu intervenciju u povijest.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-lg border border-cyan-300 bg-cyan-400 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Spremam..." : "Zapiši servis"}
        </button>
      </div>

      {state.fieldErrors?.serviceKm?.[0] ? (
        <p className="px-5 pb-1 text-xs text-rose-300">{state.fieldErrors.serviceKm[0]}</p>
      ) : null}
      {state.fieldErrors?.serviceCost?.[0] ? (
        <p className="px-5 pb-1 text-xs text-rose-300">{state.fieldErrors.serviceCost[0]}</p>
      ) : null}
      {state.fieldErrors?.serviceDate?.[0] ? (
        <p className="px-5 pb-1 text-xs text-rose-300">{state.fieldErrors.serviceDate[0]}</p>
      ) : null}
      {state.message ? (
        <p className={`px-5 pb-4 text-sm ${state.status === "success" ? "text-emerald-300" : "text-rose-300"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function VehicleServiceRecordForm({ vehicle }: VehicleServiceRecordFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const serviceType = getResolvedServiceType(vehicle);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-300 bg-cyan-400 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300"
      >
        Evidentiraj servis
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:p-6">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Zatvori popup servisa"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <VehicleServiceModalContent
            vehicle={vehicle}
            serviceType={serviceType}
            onClose={() => setIsOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}