"use client";

import { useActionState } from "react";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { updateVehicleAction } from "@/lib/actions/vehicle-actions";
import type { VehicleListItem } from "@/lib/fleet/types";
import type { VehicleFormContext } from "@/lib/fleet/vehicle-form-context-service";

interface EditVehicleFormProps {
  vehicle: VehicleListItem;
  formContext: VehicleFormContext;
}

function toInputDate(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function EditVehicleForm({ vehicle, formContext }: EditVehicleFormProps) {
  const [state, action, isPending] = useActionState(updateVehicleAction, INITIAL_ACTION_STATE);

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="vehicleId" value={vehicle.id} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          VIN
          <input
            name="brojSasije"
            defaultValue={vehicle.vin ?? ""}
            required
            maxLength={17}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Model
          <select
            name="modelId"
            defaultValue={vehicle.modelId ?? ""}
            required
            className="carlytics-select h-10 rounded-lg px-3 text-sm normal-case tracking-normal"
          >
            <option value="">Odaberi model</option>
            {formContext.modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Status
          <select
            name="statusId"
            defaultValue={vehicle.statusId ?? ""}
            required
            className="carlytics-select h-10 rounded-lg px-3 text-sm normal-case tracking-normal"
          >
            <option value="">Odaberi status</option>
            {formContext.statusOptions.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Lokacija
          <select
            name="mjestoId"
            defaultValue={vehicle.placeId ?? ""}
            className="carlytics-select h-10 rounded-lg px-3 text-sm normal-case tracking-normal"
          >
            <option value="">Nije definirano</option>
            {formContext.placeOptions.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Trenutna km
          <input
            type="number"
            name="trenutnaKm"
            min="0"
            step="1"
            defaultValue={vehicle.km}
            required
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Godina proizvodnje
          <input
            type="number"
            name="godinaProizvodnje"
            min="1950"
            max="2100"
            defaultValue={vehicle.productionYear ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Datum kupovine
          <input
            type="date"
            name="datumKupovine"
            defaultValue={toInputDate(vehicle.purchaseDateIso)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Nabavna vrijednost
          <input
            type="number"
            name="nabavnaVrijednost"
            min="0"
            step="0.01"
            defaultValue={vehicle.acquisitionValue ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Zadnji mali servis
          <input
            type="date"
            name="zadnjiMaliServisDatum"
            defaultValue={toInputDate(vehicle.lastSmallServiceDate)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          KM mali servis
          <input
            type="number"
            name="zadnjiMaliServisKm"
            min="0"
            step="1"
            defaultValue={vehicle.lastSmallServiceKm ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          Zadnji veliki servis
          <input
            type="date"
            name="zadnjiVelikiServisDatum"
            defaultValue={toInputDate(vehicle.lastLargeServiceDate)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>

        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted">
          KM veliki servis
          <input
            type="number"
            name="zadnjiVelikiServisKm"
            min="0"
            step="1"
            defaultValue={vehicle.lastLargeServiceKm ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none focus:border-cyan-500/45"
          />
        </label>
      </div>

      {state.message ? (
        <p className={state.status === "success" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-lg border border-cyan-300 bg-cyan-400 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Spremam..." : "Spremi izmjene"}
        </button>
      </div>
    </form>
  );
}
