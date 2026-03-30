"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { INITIAL_ACTION_STATE } from "@/lib/actions/action-state";
import { submitNewVehicleAction } from "@/lib/actions/vehicle-actions";
import { cn } from "@/lib/utils/cn";
import type {
  VehicleManufacturerOption,
  VehicleModelOption,
  VehicleStatusOption,
} from "@/lib/fleet/vehicle-form-context-service";

interface AddVehicleFormProps {
  modelOptions: VehicleModelOption[];
  statusOptions: VehicleStatusOption[];
  manufacturerOptions: VehicleManufacturerOption[];
  cancelHref?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
  mode?: "page" | "modal";
}

export function AddVehicleForm({
  modelOptions,
  statusOptions,
  manufacturerOptions,
  cancelHref = "/flota",
  onCancel,
  onSuccess,
  mode = "page",
}: AddVehicleFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    submitNewVehicleAction,
    INITIAL_ACTION_STATE,
  );
  const hasRequiredContext = statusOptions.length > 0;
  const isModalMode = mode === "modal";
  const [selectedManufacturerId, setSelectedManufacturerId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [isCreateModelOpen, setIsCreateModelOpen] = useState(false);

  const filteredModelOptions = useMemo(() => {
    if (!selectedManufacturerId) {
      return [];
    }

    return modelOptions.filter(
      (model) => String(model.manufacturerId ?? "") === selectedManufacturerId,
    );
  }, [modelOptions, selectedManufacturerId]);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    router.refresh();
    onSuccess?.();
  }, [onSuccess, router, state.status]);

  useEffect(() => {
    setSelectedModelId("");
  }, [selectedManufacturerId]);

  const inputClassName =
    "mt-1.5 w-full rounded-xl border border-border bg-surface-elevated px-3 py-1.5 text-xs text-foreground placeholder:text-muted xl:py-2 xl:text-sm";
  const sectionClassName = "rounded-xl border border-border/80 bg-surface/70 p-3 xl:p-4";

  return (
    <form
      action={formAction}
      className={cn(
        "rounded-2xl border border-border bg-surface/95",
        isModalMode
          ? "flex h-full min-h-0 flex-col overflow-y-auto p-3 sm:p-4"
          : "space-y-4 p-5",
      )}
    >
      <div className={cn(isModalMode ? "space-y-3 pr-1 xl:space-y-4" : "space-y-3") }>
        <section className={sectionClassName}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
              Osnovni podaci
            </h2>
            <p className="text-xs text-muted">Identifikacija i status vozila</p>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:gap-3">
            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              VIN (broj šasije)
              <input
                name="brojSasije"
                required
                maxLength={17}
                className={cn("data-font", inputClassName)}
                placeholder="WVWZZZ1KZ6W000001"
              />
              {state.fieldErrors?.brojSasije?.[0] ? (
                <span className="mt-1 block text-xs normal-case tracking-normal text-red-400">
                  {state.fieldErrors.brojSasije[0]}
                </span>
              ) : null}
            </label>

            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Registracijska oznaka
              <input
                name="registracijskaOznaka"
                required
                className={cn("data-font", inputClassName)}
                placeholder="npr. X00-X-000"
              />
              {state.fieldErrors?.registracijskaOznaka?.[0] ? (
                <span className="mt-1 block text-xs normal-case tracking-normal text-red-400">
                  {state.fieldErrors.registracijskaOznaka[0]}
                </span>
              ) : null}
            </label>

            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Status
              <select
                name="statusId"
                defaultValue={statusOptions[0]?.id ?? ""}
                required
                disabled={!hasRequiredContext}
                className="carlytics-select mt-1.5 w-full px-3 py-1.5 text-xs xl:py-2 xl:text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.statusId?.[0] ? (
                <span className="mt-1 block text-xs normal-case tracking-normal text-red-400">
                  {state.fieldErrors.statusId[0]}
                </span>
              ) : null}
            </label>
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
              Tehnički detalji
            </h2>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:gap-3">
            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Proizvođač
              <select
                name="proizvodjacId"
                value={selectedManufacturerId}
                onChange={(event) => setSelectedManufacturerId(event.target.value)}
                className="carlytics-select mt-1.5 w-full px-3 py-1.5 text-xs xl:py-2 xl:text-sm"
              >
                <option value="">Odaberi proizvođača</option>
                {manufacturerOptions.map((manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Model vozila
              <select
                name="modelId"
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
                disabled={!selectedManufacturerId || isCreateModelOpen}
                className="carlytics-select mt-1.5 w-full px-3 py-1.5 text-xs xl:py-2 xl:text-sm"
              >
                <option value="">
                  {isCreateModelOpen
                    ? "Za novi model ostavi prazno"
                    : !selectedManufacturerId
                      ? "Prvo odaberi proizvođača"
                      : filteredModelOptions.length === 0
                        ? "Nema modela za odabranog proizvođača"
                        : "Odaberi model"}
                </option>
                {filteredModelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.modelLabel}
                    {model.fuelCapacity ? ` (${model.fuelCapacity} L)` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Trenutna kilometraža
              <input
                type="number"
                name="trenutnaKm"
                required
                min={0}
                className={cn("data-font", inputClassName)}
                placeholder="0"
              />
              {state.fieldErrors?.trenutnaKm?.[0] ? (
                <span className="mt-1 block text-xs normal-case tracking-normal text-red-400">
                  {state.fieldErrors.trenutnaKm[0]}
                </span>
              ) : null}
            </label>
          </div>

          <div className="mt-2 flex items-center justify-start">
            <button
              type="button"
              onClick={() => {
                setIsCreateModelOpen((current) => !current);
                setSelectedModelId("");
              }}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-100 px-3 text-xs font-semibold uppercase tracking-[0.13em] text-cyan-800 transition hover:border-cyan-500/55 hover:bg-cyan-200 xl:h-10 xl:text-sm dark:bg-cyan-500/16 dark:text-cyan-200 dark:hover:bg-cyan-500/24"
            >
              {isCreateModelOpen
                ? "Zatvori novi model"
                : "Kreiraj novi model/proizvođač"}
            </button>
          </div>

          {state.fieldErrors?.proizvodjacId?.[0] ? (
            <p className="mt-2 text-xs text-red-400">{state.fieldErrors.proizvodjacId[0]}</p>
          ) : null}

          {state.fieldErrors?.modelId?.[0] ? (
            <p className="mt-2 text-xs text-red-400">{state.fieldErrors.modelId[0]}</p>
          ) : null}

          {state.fieldErrors?.modelSelection?.[0] ? (
            <p className="mt-2 text-xs text-red-400">{state.fieldErrors.modelSelection[0]}</p>
          ) : null}

          {isCreateModelOpen ? (
            <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">
                Novi model / proizvođač
              </p>

              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4 xl:gap-3">
                <label className="text-xs uppercase tracking-[0.2em] text-muted xl:col-span-2">
                  Novi model (naziv)
                  <input
                    name="noviModelNaziv"
                    className={inputClassName}
                    placeholder="Npr. Transporter T6"
                  />
                  {state.fieldErrors?.noviModelNaziv?.[0] ? (
                    <span className="mt-1 block text-xs normal-case tracking-normal text-red-400">
                      {state.fieldErrors.noviModelNaziv[0]}
                    </span>
                  ) : null}
                </label>

                <label className="text-xs uppercase tracking-[0.2em] text-muted xl:col-span-2">
                  Novi proizvođač (ako nije na listi)
                  <input
                    name="noviProizvodjacNaziv"
                    disabled={Boolean(selectedManufacturerId)}
                    className={cn(inputClassName, Boolean(selectedManufacturerId) && "opacity-60")}
                    placeholder={
                      selectedManufacturerId
                        ? "Koristi se odabrani proizvođač"
                        : "Npr. Volkswagen"
                    }
                  />
                  {state.fieldErrors?.noviProizvodjacNaziv?.[0] ? (
                    <span className="mt-1 block text-xs normal-case tracking-normal text-red-400">
                      {state.fieldErrors.noviProizvodjacNaziv[0]}
                    </span>
                  ) : null}
                </label>

                <label className="text-xs uppercase tracking-[0.2em] text-muted">
                  Kapacitet rezervoara (L)
                  <input
                    type="number"
                    name="kapacitetRezervoara"
                    min={0}
                    step="0.1"
                    className={cn("data-font", inputClassName)}
                    placeholder="70"
                  />
                </label>

                <label className="text-xs uppercase tracking-[0.2em] text-muted">
                  Mali servis interval
                  <input
                    type="number"
                    name="maliServisIntervalKm"
                    min={0}
                    step="100"
                    className={cn("data-font", inputClassName)}
                    placeholder="15000"
                  />
                </label>

                <label className="text-xs uppercase tracking-[0.2em] text-muted">
                  Veliki servis interval
                  <input
                    type="number"
                    name="velikiServisIntervalKm"
                    min={0}
                    step="100"
                    className={cn("data-font", inputClassName)}
                    placeholder="90000"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </section>

        <section className={sectionClassName}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
              Nabavka i registracija
            </h2>
          </div>

          <div className="grid gap-2 md:grid-cols-3 xl:gap-3">
            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Datum nabavke
              <input
                type="date"
                name="datumKupovine"
                className={inputClassName}
              />
            </label>

            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Nabavna cijena (EUR)
              <input
                type="number"
                name="nabavnaVrijednost"
                min={0}
                step="0.01"
                className={cn("data-font", inputClassName)}
                placeholder="0.00"
              />
            </label>

            <label className="text-xs uppercase tracking-[0.2em] text-muted">
              Datum isteka registracije
              <input
                type="date"
                name="datumIstekaRegistracije"
                required
                className={inputClassName}
              />
              {state.fieldErrors?.datumIstekaRegistracije?.[0] ? (
                <span className="mt-1 block text-xs normal-case tracking-normal text-red-400">
                  {state.fieldErrors.datumIstekaRegistracije[0]}
                </span>
              ) : null}
            </label>
          </div>
        </section>
      </div>

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              : state.status === "error"
                ? "rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                : "rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground"
          }
        >
          {state.message}
        </div>
      ) : null}

      {!hasRequiredContext ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Nedostaju statusi vozila u bazi. Unos je privremeno onemogućen.
        </div>
      ) : null}

      <div className={cn("mt-2 flex items-center justify-end gap-2", isModalMode && "border-t border-border pt-3")}>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground transition hover:border-cyan-500/35 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            Odustani
          </button>
        ) : (
          <Link
            href={cancelHref}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-surface-elevated px-4 text-sm text-foreground transition hover:border-cyan-500/35 hover:text-cyan-700 dark:hover:text-cyan-200"
          >
            Odustani
          </Link>
        )}
        <button
          type="submit"
          disabled={isPending || !hasRequiredContext}
          className="inline-flex h-10 items-center rounded-xl border border-cyan-300 bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Spremanje..." : "Spremi vozilo"}
        </button>
      </div>
    </form>
  );
}
